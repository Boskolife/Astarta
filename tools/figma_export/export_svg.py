#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path


FIGMA_API_BASE = "https://api.figma.com/v1"


def log(message: str) -> None:
    sys.stdout.write(message + "\n")
    sys.stdout.flush()


def http_get_json(url: str, headers: dict, max_retries: int = 5, retry_backoff_s: float = 1.5):
    """HTTP GET that returns parsed JSON with basic retry logic for transient errors."""
    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"HTTP {resp.status} for {url}")
                data = resp.read().decode("utf-8")
                return json.loads(data)
        except Exception as err:  # noqa: BLE001 (we re-raise with context)
            last_err = err
            # Exponential backoff for transient errors (including rate limits)
            if attempt < max_retries:
                sleep_s = retry_backoff_s ** attempt
                time.sleep(sleep_s)
            else:
                break
    raise SystemExit(f"Request failed for {url}: {last_err}")


def download_file(url: str, output_path: Path, max_retries: int = 5, retry_backoff_s: float = 1.5) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            with urllib.request.urlopen(url) as resp, open(output_path, "wb") as out:
                out.write(resp.read())
            return
        except Exception as err:  # noqa: BLE001
            last_err = err
            if attempt < max_retries:
                sleep_s = retry_backoff_s ** attempt
                time.sleep(sleep_s)
            else:
                break
    raise SystemExit(f"Failed to download {url} -> {output_path}: {last_err}")


def sanitize_filename(name: str) -> str:
    # Replace path separators and trim
    name = name.replace("/", "-").replace("\\", "-").strip()
    # Keep alphanumerics, dash, underscore, dot; replace others with dash
    cleaned = []
    for ch in name:
        if ch.isalnum() or ch in ("-", "_", "."):
            cleaned.append(ch)
        else:
            cleaned.append("-")
    result = "".join(cleaned).strip("-._")
    return result or "unnamed"


RENDERABLE_TYPES_DEFAULT = {
    "FRAME",
    "GROUP",
    "COMPONENT",
    "INSTANCE",
    "VECTOR",
    "RECTANGLE",
    "ELLIPSE",
    "LINE",
    "POLYGON",
    "STAR",
    "BOOLEAN_OPERATION",
    "TEXT",
    "SLICE",
}


def should_export_node(node: dict, mode: str, allowed_types: set) -> bool:
    node_type = node.get("type")
    if node_type in {"DOCUMENT", "PAGE"}:
        return False
    if mode == "export_settings":
        export_settings = node.get("exportSettings") or []
        for setting in export_settings:
            if (setting.get("format") or "").upper() == "SVG":
                return True
        return False
    # mode == "all"
    return node_type in allowed_types


def traverse_collect(node: dict, mode: str, allowed_types: set, path_names: list[str]):
    """Traverse the node tree, collect exportable nodes and map of id->(name,path)."""
    export_nodes = []
    id_to_name = {}

    current_name = node.get("name") or node.get("id") or "node"
    current_path = path_names + [current_name]

    if should_export_node(node, mode, allowed_types):
        node_id = node.get("id")
        if node_id:
            export_nodes.append(node_id)
            id_to_name[node_id] = {
                "name": current_name,
                "path": current_path,
                "type": node.get("type"),
            }

    for child in node.get("children", []) or []:
        c_nodes, c_map = traverse_collect(child, mode, allowed_types, current_path)
        export_nodes.extend(c_nodes)
        id_to_name.update(c_map)

    return export_nodes, id_to_name


def chunked(iterable, size: int):
    chunk = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) >= size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def normalize_node_id(node_id: str) -> str:
    # Figma share links often use hyphen instead of colon in node-id
    if ":" in node_id:
        return node_id
    return node_id.replace("-", ":")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export SVGs from a Figma file using the Figma REST API.")
    parser.add_argument("file_key", help="Figma file key (e.g. IQgPIHYpGnotfOrtwPijJU)")
    parser.add_argument(
        "--node-id",
        dest="node_ids",
        action="append",
        default=[],
        help="Node id(s) to limit export scope (repeat or comma-separated). Accepts 2035-4862 or 2035:4862.",
    )
    parser.add_argument(
        "--all",
        dest="mode_all",
        action="store_true",
        help="Export all renderable nodes (not only those with SVG export settings).",
    )
    parser.add_argument(
        "--types",
        default=",")
    parser.add_argument(
        "-o",
        "--output",
        default="/workspace/exports/terra_vino_svgs",
        help="Output directory for downloaded SVGs.",
    )
    parser.add_argument(
        "--token",
        default=os.getenv("FIGMA_TOKEN"),
        help="Figma personal access token. If omitted, reads FIGMA_TOKEN from env.",
    )
    parser.add_argument(
        "--prefix",
        default="",
        help="Optional filename prefix for all exported files.",
    )

    args = parser.parse_args()

    if not args.token:
        raise SystemExit(
            "Missing Figma token. Set FIGMA_TOKEN env or pass --token.\n"
            "Create one in Figma: Settings > Personal access tokens."
        )

    headers = {
        "X-Figma-Token": args.token,
        "Accept": "application/json",
        "User-Agent": "figma-export-svg-script/1.0",
    }

    file_key = args.file_key

    # Optional: validate file access and get file name
    file_url = f"{FIGMA_API_BASE}/files/{file_key}"
    file_json = http_get_json(file_url, headers, max_retries=3)
    file_name = (file_json.get("name") or file_key).strip()
    log(f"File: {file_name}")

    # Determine traversal roots
    node_ids_flat = []
    for part in args.node_ids:
        if not part:
            continue
        node_ids_flat.extend([p.strip() for p in part.split(",") if p.strip()])
    normalized_node_ids = [normalize_node_id(nid) for nid in node_ids_flat]

    mode = "all" if args.mode_all else "export_settings"
    allowed_types = RENDERABLE_TYPES_DEFAULT
    if args.types and args.types.strip() and args.types.strip() != ",":
        allowed_types = {t.strip().upper() for t in args.types.split(",") if t.strip()}

    roots = []
    if normalized_node_ids:
        # Fetch each root node subtree via nodes endpoint (can batch by 1..n ids)
        # The endpoint allows multiple ids per request; chunk to avoid very large URLs
        all_roots = []
        for id_chunk in chunked(normalized_node_ids, 40):
            ids_param = ",".join(id_chunk)
            url = f"{FIGMA_API_BASE}/files/{file_key}/nodes?ids={urllib.parse.quote(ids_param)}"
            nodes_json = http_get_json(url, headers)
            nodes_map = nodes_json.get("nodes") or {}
            for nid in id_chunk:
                node_entry = nodes_map.get(nid)
                if not node_entry:
                    log(f"Warning: node {nid} not found or inaccessible")
                    continue
                doc = node_entry.get("document")
                if doc:
                    all_roots.append(doc)
        roots = all_roots
    else:
        # Use the whole document
        document = (file_json.get("document") or {})
        # The file document has type DOCUMENT; its children are pages
        for page in document.get("children", []) or []:
            roots.append(page)

    if not roots:
        raise SystemExit("No roots to traverse. Check file access or node-id values.")

    export_ids: list[str] = []
    id_to_meta: dict[str, dict] = {}
    for root in roots:
        root_path = [root.get("name") or root.get("id") or "root"]
        nodes, meta = traverse_collect(root, mode, allowed_types, root_path)
        export_ids.extend(nodes)
        id_to_meta.update(meta)

    # De-dup while preserving order
    seen = set()
    unique_export_ids = []
    for nid in export_ids:
        if nid not in seen:
            unique_export_ids.append(nid)
            seen.add(nid)

    if not unique_export_ids:
        raise SystemExit(
            "No exportable nodes found. Try --all or adjust --types or ensure nodes have SVG export settings."
        )

    out_dir = Path(args.output).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    log(f"Exporting {len(unique_export_ids)} nodes to {out_dir} as SVG...")

    total_downloaded = 0
    # Figma images endpoint supports batch ids. Chunk to keep URL length reasonable.
    for id_chunk in chunked(unique_export_ids, 200):
        ids_param = ",".join(id_chunk)
        query = {
            "ids": ids_param,
            "format": "svg",
            "svg_include_id": "true",
            "svg_simplify_stroke": "false",
            "svg_outline_text": "true",
            "use_relative_bounds": "false",
        }
        url = f"{FIGMA_API_BASE}/images/{file_key}?{urllib.parse.urlencode(query)}"
        images_json = http_get_json(url, headers)
        images_map = images_json.get("images") or {}

        for nid in id_chunk:
            img_url = images_map.get(nid)
            if not img_url:
                # Some nodes may not be exportable as image; skip
                continue
            meta = id_to_meta.get(nid) or {}
            node_name = meta.get("name") or nid
            node_type = meta.get("type") or "NODE"
            safe_name = sanitize_filename(node_name)

            # Compose a hierarchical-ish filename to avoid collisions
            prefix = (args.prefix.strip() + "_") if args.prefix and args.prefix.strip() else ""
            filename = f"{prefix}{safe_name}__{node_type}__{nid.replace(':', '_')}.svg"
            output_path = out_dir / filename

            download_file(img_url, output_path)
            total_downloaded += 1

    log(f"Done. Downloaded {total_downloaded} SVG files to: {out_dir}")


if __name__ == "__main__":
    main()

