Figma SVG Export Tool

Usage

1. Create a Figma Personal Access Token (PAT):
   - In Figma: Settings → Personal access tokens → Create new token
   - Copy the token value

2. Run the exporter (example for your Terra-Vino link):

```bash
FIGMA_TOKEN=YOUR_TOKEN_HERE \
python3 /workspace/tools/figma_export/export_svg.py IQgPIHYpGnotfOrtwPijJU \
  --node-id 2035-4862 \
  --all \
  -o /workspace/exports/terra_vino_svgs
```

Notes

- You can pass multiple node ids by repeating `--node-id` or with commas.
- Omit `--node-id` to scan the whole file (can be large!).
- By default the script exports only nodes with explicit SVG export settings. Use `--all` to export all renderable nodes.
- File names include the node name, type, and id to avoid collisions.

