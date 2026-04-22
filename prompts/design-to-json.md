# Prompt Template: Generate Figma-Importable JSON

Copy this prompt into ChatGPT, Claude, or any AI. Paste your design description after it. The output JSON can be dropped directly into the Pen to Figma Importer plugin.

---

## The Prompt

```
You are a design-to-JSON converter. Output a single JSON object that follows this exact schema. Do NOT add any explanation — only output valid JSON.

SCHEMA RULES:
- The root object must have: { "variables": {}, "children": [] }
- Every node MUST have "type" (frame|text|rectangle|ellipse|line|group) and a unique "id"
- Frames are containers. Set "layout": "vertical" or "horizontal" for auto-layout. Omit layout for absolute positioning.
- Text nodes MUST have "content", "fontFamily", "fontSize", "fontWeight", and "fill" (color as hex)
- Colors are hex strings: "#RRGGBB" or "#RRGGBBAA"
- Use "width" and "height" as numbers for fixed sizes
- Use "fill_container" to stretch to parent width/height
- Use "fit_content" to shrink-wrap children
- Reusable components: set "reusable": true on the node. Reference with { "type": "ref", "ref": "<component-id>" }
- Override instance properties via "descendants": { "<child-id>": { "content": "new text" } }

LAYOUT PROPERTIES (on frames):
- "layout": "vertical" | "horizontal" — enables auto-layout
- "gap": number — space between children
- "padding": number | [vertical, horizontal] | [top, right, bottom, left]
- "justifyContent": "start" | "center" | "end" | "space_between"
- "alignItems": "start" | "center" | "end"

SIZE PROPERTIES:
- "width": number | "fill_container" | "fit_content"
- "height": number | "fill_container" | "fit_content"

TEXT PROPERTIES:
- "content": "The text string"
- "fontFamily": "Inter" (or any Google Font)
- "fontSize": 16
- "fontWeight": "regular" | "medium" | "bold" | "300" | "600" etc.
- "fill": "#RRGGBB" — text color (REQUIRED or text is invisible)
- "letterSpacing": 0.03 (ratio, not pixels)
- "lineHeight": 1.5 (multiplier)
- "textAlign": "left" | "center" | "right"
- "textGrowth": "auto" | "fixed-width" | "fixed-width-height"
- For wrapping text: set "textGrowth": "fixed-width" AND "width": number or "fill_container"

VISUAL PROPERTIES:
- "fill": "#hex" | { "type": "gradient", "gradientType": "linear", "rotation": 180, "colors": [{"color":"#hex","position":0},{"color":"#hex","position":1}] }
- "stroke": { "fill": "#hex", "thickness": 1 }
- "cornerRadius": number | [topLeft, topRight, bottomRight, bottomLeft]
- "effect": { "type": "shadow", "color": "#00000040", "offset": {"x":0,"y":4}, "blur": 12, "spread": 0 }
- "opacity": 0.0 to 1.0
- "clip": true — clips overflow

VARIABLES (design tokens):
- Define in "variables": { "primary": {"type":"color","value":"#0066FF"}, "spacing-md": {"type":"number","value":16} }
- Reference with "$" prefix: "fill": "$primary", "gap": "$spacing-md"

EXAMPLE OUTPUT:
{
  "variables": {
    "bg": {"type":"color","value":"#0F172A"},
    "text": {"type":"color","value":"#F8FAFC"},
    "accent": {"type":"color","value":"#3B82F6"}
  },
  "children": [
    {
      "type": "frame", "id": "btn1", "name": "Component/Button",
      "reusable": true,
      "layout": "horizontal", "alignItems": "center", "justifyContent": "center",
      "padding": [12, 24], "cornerRadius": 8, "fill": "$accent",
      "children": [
        {"type":"text","id":"btnLabel","name":"label","content":"Click me","fontFamily":"Inter","fontSize":14,"fontWeight":"bold","fill":"#FFFFFF"}
      ]
    },
    {
      "type": "frame", "id": "page1", "name": "Homepage",
      "width": 1440, "height": 900, "fill": "$bg",
      "layout": "vertical", "alignItems": "center", "padding": 64, "gap": 32,
      "children": [
        {"type":"text","id":"h1","content":"Welcome","fontFamily":"Inter","fontSize":48,"fontWeight":"bold","fill":"$text"},
        {"type":"text","id":"sub","content":"Build something great","fontFamily":"Inter","fontSize":18,"fontWeight":"regular","fill":"#94A3B8"},
        {"type":"ref","id":"cta1","ref":"btn1","descendants":{"btnLabel":{"content":"Get Started"}}}
      ]
    }
  ]
}

NOW GENERATE THE JSON FOR THIS DESIGN:
```

---

## Usage

1. Copy the prompt above
2. Paste it into ChatGPT or Claude
3. After "NOW GENERATE THE JSON FOR THIS DESIGN:" describe what you want
4. Copy the JSON output
5. Save as `.json` and drop into the Pen to Figma Importer plugin

## Example descriptions to append:

**Landing page:**
```
A dark-themed SaaS landing page with a hero section (large heading, subtitle, two CTA buttons), a features grid with 3 cards, a pricing table with 3 tiers, and a footer. Use Inter font, blue accent color.
```

**Mobile app:**
```
A fitness tracking mobile app (390x844). Include: a top nav bar with back arrow and title, a circular progress ring showing 75% of daily goal, a stats row with 3 metrics (steps, calories, distance), and a scrollable activity feed with 4 workout cards. Use SF Pro, green accent.
```

**Dashboard:**
```
An analytics dashboard (1440x900) with: sidebar navigation (logo, 6 nav items, user avatar), top bar with search and notifications, main content area with 4 stat cards in a row, a large line chart placeholder below, and a recent activity table with 5 rows.
```
