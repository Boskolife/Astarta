#!/usr/bin/env python3
"""
Figma SVG Exporter

Downloads all renderable nodes from a Figma file as SVGs using the Figma REST API.

Usage examples:
  - From file key:
      python3 scripts/figma_export_svg.py --file-key IQgPIHYpGnotfOrtwPijJU --out /workspace/exports/figma_svgs

  - From URL (extracts the key automatically):
      python3 scripts/figma_export_svg.py --file-url "https://www.figma.com/design/IQgPIHYpGnotfOrtwPijJU/..." --out /workspace/exports/figma_svgs

Authentication:
  Provide a Figma Personal Access Token via the FIGMA_TOKEN env var, or pass --token.

Notes:
  - The script attempts to export every node; the Figma images API returns URLs only for renderable nodes.
  - Exports are organized by page and parent hierarchy.
"""

import argparse
import json
import os
import re
import sys
import time
from typing import Dict, List, Tuple
from urllib import request, error


FIGMA_API_BASE = "https://api.figma.com/v1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export all Figma nodes as SVG files.")
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--file-key", dest="file_key", help="Figma file key (e.g., IQgPIHYpGnotfOrtwPijJU)")
    src.add_argument("--file-url", dest="file_url", help="Full Figma file URL; script will extract the key.")
    parser.add_argument("--out", dest="out_dir", required=True, help="Output directory to save SVGs.")
    parser.add_argument("--token", dest="token", help="Figma Personal Access Token. Defaults to FIGMA_TOKEN env var.")
    parser.add_argument("--batch-size", dest="batch_size", type=int, default=150, help="Max node IDs per images request (<= 200).")
    parser.add_argument("--rate-delay", dest="rate_delay", type=float, default=0.6, help="Delay between API batches (seconds).")
    parser.add_argument("--timeout", dest="timeout", type=float, default=30.0, help="HTTP timeout (seconds).")
    parser.add_argument("--verbose", dest="verbose", action="store_true", help="Enable verbose logging.")
    return parser.parse_args()


def extract_key_from_url(url: str) -> str:
    # Works for both new /design and old /file URLs
    m = re.search(r"/([A-Za-z0-9]{5,})/", url)
    if not m:
        raise ValueError("Could not extract file key from URL: %s" % url)
    return m.group(1)


def get_auth_token(arg_token: str | None) -> str:
    token = arg_token or os.getenv("FIGMA_TOKEN")
    if not token:
        raise RuntimeError("Missing token. Set FIGMA_TOKEN env var or pass --token.")
    return token


def http_get_json(url: str, token: str, timeout: float) -> dict:
    req = request.Request(url, headers={"X-Figma-Token": token})
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                raise RuntimeError(f"GET {url} -> {resp.status}")
            data = resp.read()
            return json.loads(data.decode("utf-8"))
    except error.HTTPError as e:  # pragma: no cover
        body = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else ""
        raise RuntimeError(f"GET {url} -> {e.code}: {body[:300]}")


def http_get_binary(url: str, timeout: float) -> bytes:
    try:
        with request.urlopen(url, timeout=timeout) as resp:
            if resp.status != 200:
                raise RuntimeError(f"GET {url} -> {resp.status}")
            return resp.read()
    except error.HTTPError as e:  # pragma: no cover
        raise RuntimeError(f"GET {url} -> {e.code}")


def sanitize_segment(name: str) -> str:
    if not name:
        return "unnamed"
    # Replace path separators and trim
    name = name.strip().replace("/", "-")
    # Allow letters, numbers, dash, underscore, dot, and space -> convert spaces to underscore
    name = re.sub(r"[^A-Za-z0-9._\- ]+", "", name)
    name = re.sub(r"\s+", "_", name)
    return name or "unnamed"


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def traverse_collect_nodes(file_json: dict) -> List[Tuple[str, List[str]]]:
    """
    Returns a list of tuples: (node_id, path_segments)
    where path_segments is [page_name, parent1, parent2, ..., node_name]
    """
    result: List[Tuple[str, List[str]]] = []

    document = file_json.get("document")
    if not document:
        return result

    for page in document.get("children", []) or []:
        page_name = sanitize_segment(page.get("name", "Page"))

        def walk(node: dict, parent_chain: List[str]):
            node_id = node.get("id")
            node_name = sanitize_segment(node.get("name", "node"))
            visible = node.get("visible", True)
            if node_id and visible:
                result.append((node_id, parent_chain + [node_name]))
            for child in node.get("children", []) or []:
                walk(child, parent_chain + [node_name])

        walk(page, [page_name])

    return result


def batched(iterable: List, size: int) -> List[List]:
    return [iterable[i : i + size] for i in range(0, len(iterable), size)]


def fetch_image_urls_for_ids(file_key: str, ids: List[str], token: str, timeout: float, verbose: bool) -> Dict[str, str]:
    ids_param = ",".join(ids)
    url = f"{FIGMA_API_BASE}/images/{file_key}?ids={ids_param}&format=svg&svg_include_id=true"
    data = http_get_json(url, token, timeout)
    images = data.get("images", {}) or {}
    if verbose:
        missing = [nid for nid in ids if nid not in images]
        if missing:
            print(f"{len(missing)} ids not renderable; skipping.")
    return images


def save_svg(content: bytes, base_dir: str, rel_path: str) -> None:
    full_path = os.path.join(base_dir, rel_path)
    ensure_dir(os.path.dirname(full_path))
    with open(full_path, "wb") as f:
        f.write(content)


def main() -> int:
    args = parse_args()

    try:
        file_key = args.file_key or extract_key_from_url(args.file_url)
    except Exception as e:
        print(str(e), file=sys.stderr)
        return 2

    try:
        token = get_auth_token(args.token)
    except Exception as e:
        print(str(e), file=sys.stderr)
        return 2

    out_dir = os.path.abspath(args.out_dir)
    ensure_dir(out_dir)

    if args.verbose:
        print(f"Fetching Figma file: {file_key}")
    file_url = f"{FIGMA_API_BASE}/files/{file_key}"
    file_json = http_get_json(file_url, token, args.timeout)

    nodes = traverse_collect_nodes(file_json)
    if args.verbose:
        print(f"Collected nodes: {len(nodes)}")
    if not nodes:
        print("No nodes found in file.")
        return 0

    # Build mapping id -> relative output path for file naming
    id_to_relpath: Dict[str, str] = {}
    for node_id, path_segments in nodes:
        # Use nested directories by page and parent hierarchy; ensure unique filenames via node id suffix
        *dir_segments, node_name = path_segments
        dir_path = "/".join(sanitize_segment(seg) for seg in dir_segments)
        filename = f"{sanitize_segment(node_name)}__{node_id}.svg"
        rel_path = os.path.join(dir_path, filename)
        id_to_relpath[node_id] = rel_path

    all_ids = list(id_to_relpath.keys())

    total_saved = 0
    for batch in batched(all_ids, max(1, min(200, args.batch_size))):
        images = fetch_image_urls_for_ids(file_key, batch, token, args.timeout, args.verbose)
        for node_id, url in images.items():
            try:
                content = http_get_binary(url, args.timeout)
                save_svg(content, out_dir, id_to_relpath[node_id])
                total_saved += 1
            except Exception as e:
                print(f"Failed to save {node_id}: {e}", file=sys.stderr)
        time.sleep(max(0.0, args.rate_delay))

    print(f"Export complete. Saved {total_saved} SVG files to: {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

