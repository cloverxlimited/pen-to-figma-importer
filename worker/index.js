/**
 * Cloudflare Worker: Pen-to-Figma Feedback → GitHub Issues
 *
 * Receives POST requests from the Figma plugin and creates
 * labeled GitHub issues. No GitHub account needed for the reporter.
 *
 * Abuse protection: per-IP and per-instance rate limits + Cloudflare's
 * built-in DDoS/bot scoring on the workers.dev domain.
 *
 * Secrets required (set via `npx wrangler secret put <NAME>`):
 *   GITHUB_TOKEN - Fine-grained PAT with Issues: Read & Write on the target repo
 */

// Simple in-memory rate limiter (resets on worker restart, which is fine)
var rateLimitMap = new Map();

var LABEL_MAP = {
  bug: ['bug'],
  feature: ['enhancement'],
  help: ['question'],
};

async function handleRequest(request, env) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  var clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  var now = Date.now();
  var HOUR = 3600000;

  // Per-IP rate limit: 3 submissions per hour.
  var ipData = rateLimitMap.get(clientIP);
  if (ipData) {
    ipData.timestamps = ipData.timestamps.filter(function(t) { return now - t < HOUR; });
    if (ipData.timestamps.length >= 3) {
      return jsonResponse({ error: 'Rate limit exceeded. Try again later.' }, 429);
    }
  } else {
    ipData = { timestamps: [] };
    rateLimitMap.set(clientIP, ipData);
  }

  // Per-instance global cap: 50 submissions per hour across all IPs.
  // (In-memory and per worker instance — Workers may spawn parallel instances,
  // so this is a soft ceiling that bounds, not eliminates, distributed abuse.)
  var globalData = rateLimitMap.get('__global__');
  if (!globalData) {
    globalData = { timestamps: [] };
    rateLimitMap.set('__global__', globalData);
  }
  globalData.timestamps = globalData.timestamps.filter(function(t) { return now - t < HOUR; });
  if (globalData.timestamps.length >= 50) {
    return jsonResponse({ error: 'Global rate limit exceeded. Try again later.' }, 429);
  }

  ipData.timestamps.push(now);
  globalData.timestamps.push(now);

  if (rateLimitMap.size > 1000) {
    for (var k of rateLimitMap.keys()) {
      if (k !== '__global__') { rateLimitMap.delete(k); break; }
    }
  }

  // Parse body
  var body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  var type = body.type || 'bug';
  var summary = (body.summary || '').trim();
  var details = (body.details || '').trim();
  var email = (body.email || '').trim();
  var pluginVersion = body.plugin_version || 'unknown';
  var warnings = (body.warnings || '').trim();
  var importLog = (body.import_log || '').trim();
  var importStats = (body.import_stats || '').trim();

  if (!summary) {
    return jsonResponse({ error: 'Summary is required' }, 400);
  }

  // Build issue body
  var issueBody = '## ' + capitalize(type) + ' Report\n\n';
  issueBody += '**Summary:** ' + summary + '\n\n';

  if (details && details !== '(none)') {
    issueBody += '### Details\n' + details + '\n\n';
  }

  if (importStats && importStats !== '(none)') {
    issueBody += '### Import Result\n`' + importStats + '`\n\n';
  }

  if (warnings && warnings !== '(none)') {
    issueBody += '### Warnings/Errors\n```\n' + warnings + '\n```\n\n';
  }

  if (importLog && importLog !== '(no import run)') {
    issueBody += '### Full Import Log\n<details><summary>Click to expand</summary>\n\n```\n' + importLog + '\n```\n</details>\n\n';
  }

  issueBody += '---\n';
  issueBody += '**Plugin version:** ' + pluginVersion + '\n';
  if (email && email !== '(not provided)') {
    issueBody += '**Contact:** ' + email + '\n';
  }
  issueBody += '\n_Submitted via Figma plugin feedback form_';

  // Create GitHub issue
  var issueTitle = '[' + capitalize(type) + '] ' + summary;
  var labels = LABEL_MAP[type] || ['bug'];

  var ghUrl = 'https://api.github.com/repos/' + env.GITHUB_OWNER + '/' + env.GITHUB_REPO + '/issues';

  var ghResponse;
  try {
    ghResponse = await fetch(ghUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'pen-to-figma-feedback-worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: labels,
      }),
    });
  } catch (e) {
    return jsonResponse({ error: 'Failed to reach GitHub: ' + e.message }, 502);
  }

  if (!ghResponse.ok) {
    var errText = await ghResponse.text();
    return jsonResponse({ error: 'GitHub API error: ' + ghResponse.status, details: errText }, 502);
  }

  var issue = await ghResponse.json();

  return jsonResponse({
    success: true,
    issue_number: issue.number,
    issue_url: issue.html_url,
  }, 201);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders()),
  });
}

export default {
  fetch: handleRequest,
};
