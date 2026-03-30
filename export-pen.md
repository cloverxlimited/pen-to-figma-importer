# How to Export a .pen File for Figma Import

## Option A: Using Claude Code with Pencil MCP

If you have Claude Code with the Pencil MCP server connected, run this prompt:

```
Export my .pen file to JSON for the Figma importer.
Open [your-file.pen], then use batch_get with readDepth 10
and get_variables to create a complete export JSON.
```

Or use the `/export-pen` skill if installed.

## Option B: Manual Export via Pencil MCP Tools

Run these two MCP tool calls and combine the results:

### Step 1: Get all nodes
```
batch_get(filePath: "your-file.pen", readDepth: 10)
```

### Step 2: Get variables
```
get_variables(filePath: "your-file.pen")
```

### Step 3: Combine into one JSON file
```json
{
  "variables": { ...result from step 2... },
  "children": [ ...result from step 1... ]
}
```

Save as `export.json` and drop it into the Figma plugin.

## What Gets Imported

- All frames, text, shapes, and vectors
- Auto-layout (flexbox → Figma layoutMode)
- Reusable components → Figma Components
- Component instances (refs) → Figma Instances with overrides
- Variables → Figma Variable Collection
- Fills (solid, gradient), strokes, effects (shadows, blurs)
- Corner radius, clipping, opacity, rotation
- Font families, weights, sizes, letter spacing, line height
