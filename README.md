# Pen to Figma Importer

Free Figma plugin that imports Pencil (.pen) design files as fully editable Figma documents.

## What it does

Drop a JSON export of a .pen file and the plugin creates:

- **Frames** with auto-layout (horizontal/vertical, gap, padding, alignment)
- **Components** from reusable .pen nodes
- **Instances** with property overrides (text, fills, sizing)
- **Text layers** with correct fonts, weights, sizes, spacing
- **Shapes** (rectangles, ellipses, polygons, lines, SVG paths)
- **Variable Collection** from .pen design tokens
- **Fills** (solid colors, linear/radial/angular gradients)
- **Strokes** (per-side thickness, dash patterns)
- **Effects** (drop shadows, inner shadows, blurs)

## Installation

### As a development plugin
1. Download or clone this folder
2. In Figma: **Plugins → Development → Import plugin from manifest**
3. Select `manifest.json` from this folder

### From Figma Community
*(Coming soon)*

## Usage

### Step 1: Export your .pen file

If you use Claude Code with the Pencil MCP server:

```
batch_get(filePath: "your-file.pen", readDepth: 10)  → nodes
get_variables(filePath: "your-file.pen")              → variables
```

Combine into one JSON: `{ "variables": {...}, "children": [...] }`

See `export-pen.md` for detailed instructions.

### Step 2: Import into Figma

1. Open any Figma file
2. Run **Plugins → Development → Pen to Figma Importer**
3. Drag your `.json` export file into the drop zone
4. Wait for the import to complete

Components are placed at x=4000 (off to the right), page frames at their original positions.

## File structure

```
figma-pen-importer/
├── manifest.json      ← Figma plugin manifest
├── ui.html            ← Drag-drop UI
├── dist/code.js       ← Built plugin code
├── src/main.ts        ← Source (TypeScript)
├── build.mjs          ← esbuild script
├── package.json
└── export-pen.md      ← How to export .pen files
```

## Developing

```bash
npm install
npm run build        # one-time build
npm run watch        # rebuild on changes
```

## Limitations

- Image fills become placeholder rectangles (no image bytes in JSON export)
- Mesh gradients approximate to the first color
- Icon fonts render as text with the icon name
- Full subtree replacement in instances is logged but not yet supported

## License

MIT
