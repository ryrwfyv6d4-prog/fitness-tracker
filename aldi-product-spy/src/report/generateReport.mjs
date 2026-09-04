// Builds report/index.html — a single self-contained page (data, CSS and JS
// all inlined) so it opens straight from disk with no server.
//
// The client app lives in app.client.js and app.css as real, editable files
// rather than escaped template strings; they're read in and embedded here.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

const [matchesRaw, css, js] = await Promise.all([
  readFile(path.join(root, "data", "matches.json"), "utf8"),
  readFile(path.join(__dirname, "app.css"), "utf8"),
  readFile(path.join(__dirname, "app.client.js"), "utf8"),
]);

// `</script>` inside the JSON would terminate the script tag early.
const dataJson = matchesRaw.replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ALDI Product Spy</title>
<style>
${css}
</style>
</head>
<body>
<header class="top">
  <h1>ALDI Product Spy</h1>
  <p class="sub"><span id="scope"></span> — generated <span id="gen"></span></p>
  <div class="disclaimer">
    <strong>Read the pack before you rely on this.</strong> Ingredient, allergen and
    nutrition values are gathered from web sources that mirror label data — they are
    research-grade, not label-verified, and may be incomplete, outdated or wrong.
    This is a shopping-research aid, <strong>not an allergen-safety tool</strong>.
    If you have an allergy or intolerance, always check the physical packaging.
  </div>
</header>
<div class="layout">
  <aside class="rail">
    <div class="rail-head">
      <input id="search" type="search" placeholder="Search ALDI products…" aria-label="Search ALDI products">
      <div class="chips" id="status-chips"></div>
      <div class="chips cat-chips" id="chips"></div>
      <div class="count" id="count"></div>
    </div>
    <div class="rail-list" id="list" role="listbox" aria-label="ALDI products"></div>
  </aside>
  <main class="panel" id="panel"></main>
</div>
<script>window.__MATCHES__ = ${dataJson};</script>
<script>
${js}
</script>
</body>
</html>
`;

await mkdir(path.join(root, "report"), { recursive: true });
await writeFile(path.join(root, "report", "index.html"), html);
console.log("Wrote report/index.html");
