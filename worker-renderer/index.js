/**
 * Cloudflare Worker: HTML/URL → Figma-importable JSON
 *
 * Uses Cloudflare Browser Rendering (Puppeteer) to fully render
 * a webpage, then walks the DOM to extract layout, styles, and
 * content as importable JSON for the Pen to Figma plugin.
 *
 * Requires: Workers Paid plan with Browser Rendering enabled
 */

import puppeteer from "@cloudflare/puppeteer";

var ALLOWED_ORIGINS = ["https://cloverxlimited.github.io", "http://localhost", "null"];

function corsHeaders(origin) {
  var allowed = ALLOWED_ORIGINS.some(function (o) { return origin && origin.startsWith(o); });
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders(origin)),
  });
}

export default {
  async fetch(request, env) {
    var origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "POST required" }, 405, origin);
    }

    var body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: "Invalid JSON body" }, 400, origin);
    }

    var url = (body.url || "").trim();
    var html = (body.html || "").trim();
    var maxDepth = body.maxDepth || 12;
    var includeText = body.includeText !== false;
    var includeImages = body.includeImages !== false;
    var skipHidden = body.skipHidden !== false;
    var viewportWidth = body.viewportWidth || 1440;
    var viewportHeight = body.viewportHeight || 900;

    if (!url && !html) {
      return jsonResponse({ error: "Provide url or html in request body" }, 400, origin);
    }

    var browser;
    try {
      browser = await puppeteer.launch(env.BROWSER);
      var page = await browser.newPage();
      await page.setViewport({ width: viewportWidth, height: viewportHeight });

      if (url) {
        await page.goto(url, { waitUntil: "networkidle0", timeout: 15000 });
      } else {
        await page.setContent(html, { waitUntil: "networkidle0", timeout: 10000 });
      }

      // Wait a bit for any animations/transitions to settle
      await new Promise(function(r) { setTimeout(r, 500); });

      // Walk the DOM inside the browser context
      var result = await page.evaluate(function (opts) {
        var _nid = 0;
        function nid() { return "_h" + (++_nid).toString(36); }

        function rgbToHex(rgb) {
          if (!rgb || rgb === "transparent") return null;
          if (rgb.startsWith("#")) return rgb;
          var m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
          if (!m) return rgb;
          var hex = "#" + pad(parseInt(m[1])) + pad(parseInt(m[2])) + pad(parseInt(m[3]));
          if (m[4] !== undefined && parseFloat(m[4]) < 1) hex += pad(Math.round(parseFloat(m[4]) * 255));
          return hex;
        }
        function pad(n) { var h = n.toString(16); return h.length === 1 ? "0" + h : h; }

        function cleanFont(ff) {
          if (!ff) return "Inter";
          var first = ff.split(",")[0].trim().replace(/["']/g, "");
          if (["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"].indexOf(first) !== -1) return "Inter";
          if (["Georgia", "Times New Roman", "Times", "serif"].indexOf(first) !== -1) return "Georgia";
          if (["Courier New", "Courier", "monospace"].indexOf(first) !== -1) return "Space Mono";
          return first;
        }

        function mapWeight(w) {
          var n = parseInt(w);
          if (isNaN(n)) return "regular";
          if (n <= 300) return "light";
          if (n <= 400) return "regular";
          if (n <= 500) return "medium";
          if (n <= 600) return "semibold";
          return "bold";
        }

        function parseShadow(shadow) {
          var m = shadow.match(/([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\s*(?:([-\d.]+)px)?\s*(rgba?\([^)]+\)|#[0-9a-f]+)/i);
          if (!m) return null;
          return {
            type: "shadow", offset: { x: parseFloat(m[1]), y: parseFloat(m[2]) },
            blur: parseFloat(m[3]), spread: m[4] ? parseFloat(m[4]) : 0,
            color: rgbToHex(m[5]) || "#00000040"
          };
        }

        function parseGrad(bg) {
          var m = bg.match(/linear-gradient\((\d+)deg,\s*(.+)\)/);
          if (!m) return null;
          var stops = m[2].match(/(rgba?\([^)]+\)|#[0-9a-f]+)\s*([\d.]+%)?/gi);
          if (!stops || stops.length < 2) return null;
          var colors = [];
          for (var i = 0; i < stops.length; i++) {
            var p = stops[i].trim().match(/(rgba?\([^)]+\)|#[0-9a-f]+)\s*([\d.]+%)?/i);
            if (p) colors.push({ color: rgbToHex(p[1]), position: p[2] ? parseFloat(p[2]) / 100 : i / (stops.length - 1) });
          }
          return { type: "gradient", gradientType: "linear", rotation: parseInt(m[1]), colors: colors };
        }

        function walk(el, depth, parentRect) {
          if (depth > opts.maxDepth) return null;
          if (!el || el.nodeType !== 1) return null;
          var tag = el.tagName.toLowerCase();
          if (["script", "style", "meta", "link", "head", "noscript", "svg", "iframe"].indexOf(tag) !== -1) return null;

          var cs = window.getComputedStyle(el);
          if (opts.skipHidden && (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0")) return null;

          var rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return null;

          var node = { type: "frame", id: nid(), name: tag };
          if (rect.width > 0) node.width = Math.round(rect.width);
          if (rect.height > 0) node.height = Math.round(rect.height);

          // Only set position for absolutely/fixed positioned elements, relative to parent
          var isAbsFixed = cs.position === "absolute" || cs.position === "fixed";
          if (isAbsFixed && parentRect) {
            node.x = Math.round(rect.left - parentRect.left);
            node.y = Math.round(rect.top - parentRect.top);
            node.layoutPosition = "absolute";
          }

          // Background
          var bg = cs.backgroundColor;
          if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") node.fill = rgbToHex(bg);
          var bgImg = cs.backgroundImage;
          if (bgImg && bgImg !== "none") {
            var g = parseGrad(bgImg);
            if (g) node.fill = g;
          }

          // Border
          var bw = parseFloat(cs.borderWidth);
          if (bw > 0 && cs.borderColor && cs.borderColor !== "rgba(0, 0, 0, 0)") {
            node.stroke = { fill: rgbToHex(cs.borderColor), thickness: Math.round(bw) };
          }

          var br = parseFloat(cs.borderRadius);
          if (br > 0) node.cornerRadius = Math.round(br);

          var op = parseFloat(cs.opacity);
          if (op < 1) node.opacity = op;

          if (cs.boxShadow && cs.boxShadow !== "none") {
            var sh = parseShadow(cs.boxShadow);
            if (sh) node.effect = sh;
          }

          if (cs.overflow === "hidden") node.clip = true;

          // Flexbox
          if (cs.display === "flex" || cs.display === "inline-flex") {
            node.layout = (cs.flexDirection === "column" || cs.flexDirection === "column-reverse") ? "vertical" : "horizontal";
            var gap = parseFloat(cs.gap || cs.rowGap || "0");
            if (gap > 0) node.gap = Math.round(gap);
            var pt = parseFloat(cs.paddingTop), pr2 = parseFloat(cs.paddingRight);
            var pb = parseFloat(cs.paddingBottom), pl = parseFloat(cs.paddingLeft);
            if (pt > 0 || pr2 > 0 || pb > 0 || pl > 0) {
              if (pt === pr2 && pr2 === pb && pb === pl) node.padding = Math.round(pt);
              else node.padding = [Math.round(pt), Math.round(pr2), Math.round(pb), Math.round(pl)];
            }
            var jc = cs.justifyContent;
            if (jc === "center") node.justifyContent = "center";
            else if (jc === "flex-end" || jc === "end") node.justifyContent = "end";
            else if (jc === "space-between") node.justifyContent = "space_between";
            var ai = cs.alignItems;
            if (ai === "center") node.alignItems = "center";
            else if (ai === "flex-end" || ai === "end") node.alignItems = "end";
          } else if (cs.display === "grid") {
            node.layout = "vertical";
            var gg = parseFloat(cs.gap || "0");
            if (gg > 0) node.gap = Math.round(gg);
          }

          // Image
          if (tag === "img" && opts.includeImages) {
            node.type = "rectangle"; node.name = "image"; node.fill = "#CCCCCC30";
            return node;
          }

          // Children
          var children = [];
          for (var i = 0; i < el.childNodes.length; i++) {
            var child = el.childNodes[i];
            if (child.nodeType === 3 && opts.includeText) {
              var text = child.textContent.trim();
              if (text) {
                var tn = {
                  type: "text", id: nid(), name: "text", content: text,
                  fontFamily: cleanFont(cs.fontFamily),
                  fontSize: Math.round(parseFloat(cs.fontSize)),
                  fontWeight: mapWeight(cs.fontWeight),
                  fill: rgbToHex(cs.color),
                };
                var ls = parseFloat(cs.letterSpacing);
                if (ls && !isNaN(ls)) tn.letterSpacing = Math.round(ls * 100) / 100;
                var lh = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize);
                if (lh && !isNaN(lh) && fs > 0) tn.lineHeight = Math.round((lh / fs) * 100) / 100;
                if (cs.textAlign === "center") tn.textAlign = "center";
                else if (cs.textAlign === "right") tn.textAlign = "right";
                if (rect.width > 0 && text.length > 20) { tn.textGrowth = "fixed-width"; tn.width = Math.round(rect.width); }
                children.push(tn);
              }
            }
            if (child.nodeType === 1) {
              var cn = walk(child, depth + 1, rect);
              if (cn) children.push(cn);
            }
          }

          if (children.length > 0) {
            node.children = children;
            if (!node.layout && children.length > 1) node.layout = "vertical";
          }

          // Collapse single-text wrappers (div > text with no visual props)
          if (children.length === 1 && children[0].type === "text" && !node.fill && !node.stroke && !node.effect && !node.cornerRadius) {
            var merged = children[0];
            if (node.width) { merged.textGrowth = "fixed-width"; merged.width = node.width; }
            return merged;
          }

          // Skip empty wrapper frames with no visual properties and no layout
          var hasVisual = node.fill || node.stroke || node.effect || node.cornerRadius || node.opacity < 1 || node.clip;
          if (!hasVisual && children.length === 0 && node.type === "frame") return null;

          // Unwrap single-child frames with no visual properties
          if (!hasVisual && children.length === 1 && !node.layout && !node.padding && !node.gap) {
            var only = children[0];
            // Keep size from parent if child doesn't have it
            if (!only.width && node.width) only.width = node.width;
            if (!only.height && node.height) only.height = node.height;
            return only;
          }

          return node;
        }

        // Extract CSS variables
        var variables = {};
        try {
          var sheets = document.styleSheets;
          for (var s = 0; s < sheets.length; s++) {
            try {
              var rules = sheets[s].cssRules;
              for (var r = 0; r < rules.length; r++) {
                if (rules[r].selectorText === ":root") {
                  var style = rules[r].style;
                  for (var p = 0; p < style.length; p++) {
                    var prop = style[p];
                    if (prop.startsWith("--")) {
                      var val = style.getPropertyValue(prop).trim();
                      var name = prop.replace("--", "").replace(/-/g, "_");
                      if (val.match(/^#|^rgb/)) variables[name] = { type: "color", value: rgbToHex(val) || val };
                    }
                  }
                }
              }
            } catch (e) {}
          }
        } catch (e) {}

        var root = walk(document.body, 0, null);
        return {
          variables: variables,
          children: root ? (root.children || [root]) : [],
          title: document.title || ""
        };
      }, { maxDepth: maxDepth, includeText: includeText, includeImages: includeImages, skipHidden: skipHidden });

      await browser.close();

      var nodeCount = countNodes(result.children);
      result._meta = {
        source: url || "pasted HTML",
        nodes: nodeCount,
        variables: Object.keys(result.variables).length,
        viewport: viewportWidth + "x" + viewportHeight,
      };

      return jsonResponse(result, 200, origin);

    } catch (err) {
      if (browser) { try { await browser.close(); } catch (e2) {} }
      return jsonResponse({ error: "Render failed: " + (err.message || String(err)) }, 500, origin);
    }
  }
};

function countNodes(nodes) {
  var c = 0;
  for (var i = 0; i < (nodes || []).length; i++) {
    c++;
    if (nodes[i].children) c += countNodes(nodes[i].children);
  }
  return c;
}
