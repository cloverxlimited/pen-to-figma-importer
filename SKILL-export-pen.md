---
name: export-pen
description: Export a .pen file to JSON for the Pen-to-Figma importer plugin
user_invocable: true
---

# Export .pen to Figma-importable JSON

Export the currently active .pen file (or a specified one) as a JSON file that can be dropped into the Pen-to-Figma Importer plugin.

## Steps

1. Call `get_editor_state(include_schema: false)` to find the active .pen file path
2. Call `get_variables(filePath)` to get all design tokens
3. Call `batch_get(filePath, readDepth: 10)` to get the full node tree
4. Combine into `{ "variables": {...}, "children": [...] }`
5. Write the JSON to `{filename}-export.json` next to the .pen file

If the batch_get result is too large (over 200k chars), split into multiple calls by reading top-level nodes individually with `readDepth: 8`.

Tell the user the output path and that they can drag it into the Figma plugin.
