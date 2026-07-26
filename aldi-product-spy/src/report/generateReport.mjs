// Renders data/matches.json into a single self-contained report/index.html
// (data embedded inline) so it can be opened directly in a browser with no
// server required.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

function buildHtml(data) {
  const dataJson = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ALDI Product Spy</title>
<style>
${CSS}
</style>
</head>
<body>
<div id="app"></div>
<script>window.__MATCHES__ = ${dataJson};</script>
<script>
${JS}
</script>
</body>
</html>
`;
}

const CSS = `
:root {
  color-scheme: light dark;
  --bg: #f7f7f5;
  --card-bg: #ffffff;
  --text: #1b1b1b;
  --muted: #6b6b6b;
  --border: #e3e2de;
  --ok: #1e7e34;
  --ok-bg: #e6f4ea;
  --warn: #8a5a00;
  --warn-bg: #fdf1de;
  --bad: #a3242a;
  --bad-bg: #fbe7e8;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14161a;
    --card-bg: #1e2126;
    --text: #eceef1;
    --muted: #9a9fa6;
    --border: #2c3036;
    --ok: #4caf6a;
    --ok-bg: #16281c;
    --warn: #d3a34a;
    --warn-bg: #2c2312;
    --bad: #e5747a;
    --bad-bg: #2c1517;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
}
.wrap { max-width: 960px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 1.6rem; margin: 0 0 4px; }
.subtitle { color: var(--muted); margin: 0 0 24px; font-size: 0.95rem; }
.stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }
.stat { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; min-width: 120px; }
.stat .n { font-size: 1.4rem; font-weight: 700; }
.stat .l { color: var(--muted); font-size: 0.8rem; }
.card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 14px; overflow: hidden; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; cursor: pointer; }
.card-head:hover { background: rgba(127,127,127,0.06); }
.title-block .name { font-weight: 600; }
.title-block .sub { color: var(--muted); font-size: 0.85rem; }
.badge { border-radius: 999px; padding: 3px 10px; font-size: 0.78rem; font-weight: 600; white-space: nowrap; }
.badge.exact { color: var(--ok); background: var(--ok-bg); }
.badge.close { color: var(--warn); background: var(--warn-bg); }
.badge.notable { color: var(--warn); background: var(--warn-bg); }
.badge.excluded { color: var(--bad); background: var(--bad-bg); }
.badge.none { color: var(--muted); background: transparent; border: 1px solid var(--border); }
.detail { padding: 0 16px 16px; display: none; border-top: 1px solid var(--border); }
.detail.open { display: block; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
@media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
.col h4 { margin: 12px 0 6px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
table.nutrition { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 8px; }
table.nutrition th, table.nutrition td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--border); }
table.nutrition td.delta-hi { color: var(--bad); font-weight: 600; }
table.nutrition td.delta-lo { color: var(--muted); }
.pill-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.pill { background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; font-size: 0.78rem; }
.pill.common { opacity: 0.85; }
.pill.only-a { border-color: #b98; }
.pill.only-b { border-color: #89b; }
.req-row { display: flex; gap: 8px; align-items: center; font-size: 0.85rem; margin-top: 4px; }
.req-row .ok { color: var(--ok); }
.req-row .bad { color: var(--bad); }
.req-row .unk { color: var(--muted); font-weight: 700; }
.unk-text { color: var(--muted); }
.note { color: var(--muted); font-size: 0.8rem; margin-top: 6px; }
.badge.unknown { color: var(--muted); background: transparent; border: 1px dashed var(--border); }
.disclaimer {
  border: 1px solid var(--border); border-left: 3px solid var(--warn);
  background: var(--warn-bg); color: var(--text);
  border-radius: 8px; padding: 12px 14px; font-size: 0.85rem; line-height: 1.45; margin-bottom: 24px;
}
.callout {
  background: var(--bg); border: 1px dashed var(--border); border-radius: 8px;
  padding: 10px 12px; font-size: 0.85rem; margin: 12px 0; line-height: 1.45;
}
.prov { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 10px; }
.prov h4 { margin: 0 0 6px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.prov-row { font-size: 0.8rem; color: var(--muted); margin-bottom: 6px; }
.prov-row a { color: inherit; }
.prov-note { margin-top: 3px; font-size: 0.78rem; opacity: 0.9; }
`;

const JS = `
const data = window.__MATCHES__;
const app = document.getElementById("app");

const VERDICT_LABEL = {
  exact_match: "Exact match",
  close_match: "Close match",
  same_category_notable_differences: "Notable differences",
  excluded_hard_requirement: "Not a match",
  insufficient_data: "Unconfirmed — missing data",
};
const VERDICT_CLASS = {
  exact_match: "exact",
  close_match: "close",
  same_category_notable_differences: "notable",
  excluded_hard_requirement: "excluded",
  insufficient_data: "unknown",
};

function pct(x) { return x == null ? "—" : Math.round(x * 100) + "%"; }
function fmtNum(x) { return x == null ? "—" : (Math.round(x * 10) / 10).toString(); }

function renderPillList(items, cls) {
  if (!items || !items.length) return '<span class="note">none</span>';
  return '<div class="pill-list">' + items.map((i) => \`<span class="pill \${cls}">\${escapeHtml(i)}</span>\`).join("") + "</div>";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderNutritionTable(diff) {
  if (!diff) return "<p class=\\"note\\">No nutrition data.</p>";
  const rows = Object.entries(diff).map(([field, v]) => {
    const label = field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(" G", " (g)").replace(" Kj", " (kJ)").replace(" Mg", " (mg)");
    const deltaClass = v.deltaPct == null ? "" : v.deltaPct > 0.15 ? "delta-hi" : "delta-lo";
    return \`<tr><td>\${label}</td><td>\${fmtNum(v.a)}</td><td>\${fmtNum(v.b)}</td><td class="\${deltaClass}">\${v.deltaPct == null ? "—" : pct(v.deltaPct)}</td></tr>\`;
  }).join("");
  return \`<table class="nutrition"><thead><tr><th>Per 100g</th><th>ALDI</th><th>Leader</th><th>Delta</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}

function stateMark(state) {
  if (state === "pass") return '<span class="ok">✓</span>';
  if (state === "fail") return '<span class="bad">✗</span>';
  return '<span class="unk">?</span>';
}

function fmtField(v) {
  return v ? escapeHtml(v) : '<em class="unk-text">not recorded</em>';
}

function renderProvenance(p) {
  if (!p || (!p.aldi && !p.leader)) return "";
  const one = (label, prov) => {
    if (!prov) return "";
    const links = (prov.sources ?? (prov.url ? [prov.url] : []))
      .map((u) => \`<a href="\${escapeHtml(u)}" target="_blank" rel="noopener">\${escapeHtml(new URL(u).hostname)}</a>\`)
      .join(" · ");
    return \`<div class="prov-row"><strong>\${label}</strong> — \${escapeHtml(prov.confidence ?? "unknown")} \${links ? "· " + links : ""}
      \${prov.notes ? \`<div class="prov-note">\${escapeHtml(prov.notes)}</div>\` : ""}</div>\`;
  };
  return \`<div class="prov"><h4>Where this data came from</h4>\${one("ALDI", p.aldi)}\${one("Leader", p.leader)}</div>\`;
}

function renderCandidateDetail(c) {
  if (!c) return "<p class=\\"note\\">No candidate in this category to compare against.</p>";
  const req = c.hardRequirements;
  const scored = typeof c.ingredientSimilarity === "number";
  return \`
    \${c.verdict === "insufficient_data" ? \`<div class="callout">Can't confirm this as a dupe: \${escapeHtml((c.unknownRequirements ?? []).join(" and "))} \${(c.unknownRequirements ?? []).length > 1 ? "are" : "is"} missing from the source data. The comparison below is still shown, and on the scored signals alone it would rate <strong>\${escapeHtml(VERDICT_LABEL[c.provisionalVerdict] ?? c.provisionalVerdict ?? "—")}</strong> — but that is not a confirmed match.</div>\` : ""}
    <div class="req-row">\${stateMark(req.countryOfOrigin.state)}
      Country of origin — ALDI: \${fmtField(req.countryOfOrigin.aldi)} · Leader: \${fmtField(req.countryOfOrigin.leader)}</div>
    <div class="req-row">\${stateMark(req.allergensContains.state)}
      Allergens (contains) — ALDI: [\${req.allergensContains.aldi.join(", ") || "not recorded"}] · Leader: [\${req.allergensContains.leader.join(", ") || "not recorded"}]</div>
    \${scored ? \`
    <div class="grid2">
      <div class="col">
        <h4>Ingredients in common</h4>
        \${renderPillList(c.ingredientDiff.common, "common")}
        <h4>Only in ALDI version</h4>
        \${renderPillList(c.ingredientDiff.onlyAldi, "only-a")}
        <h4>Only in leader version</h4>
        \${renderPillList(c.ingredientDiff.onlyLeader, "only-b")}
        <p class="note">Ingredient token overlap: \${pct(c.ingredientSimilarity)}</p>
      </div>
      <div class="col">
        <h4>Nutrition panel</h4>
        \${renderNutritionTable(c.nutritionDiff)}
        <p class="note">Nutrition similarity: \${pct(c.nutritionSimilarity)}</p>
        \${c.mayContainDiffers ? \`<p class="note">"May contain" traces differ — ALDI: [\${c.allergensMayContain.aldi.join(", ") || "none"}] vs Leader: [\${c.allergensMayContain.leader.join(", ") || "none"}] (not a hard requirement, noted only).</p>\` : ""}
      </div>
    </div>\` : '<p class="note">Excluded from matching because a hard requirement conflicts above — ingredient/nutrition similarity was not scored.</p>'}
    \${renderProvenance(c.provenance)}
  \`;
}

function renderResult(r) {
  const shown = r.best ?? r.bestAvailable ?? r.candidates[0] ?? null;
  const verdict = shown ? shown.verdict : "none";
  const badgeClass = VERDICT_CLASS[verdict] ?? "none";
  const badgeLabel = shown ? (VERDICT_LABEL[verdict] ?? verdict) : "No candidate";
  const leaderName = shown ? shown.leaderProduct.name : null;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = \`
    <div class="card-head">
      <div class="title-block">
        <div class="name">\${escapeHtml(r.aldiProduct.name)}</div>
        <div class="sub">\${escapeHtml(r.aldiProduct.category)}\${leaderName ? " vs " + escapeHtml(leaderName) : ""}</div>
      </div>
      <span class="badge \${badgeClass}">\${badgeLabel}</span>
    </div>
    <div class="detail">
      \${r.candidates.length > 1 ? \`<p class="note">\${r.candidates.length} candidates compared in this category; showing the closest.</p>\` : ""}
      \${renderCandidateDetail(shown)}
    </div>
  \`;
  const head = card.querySelector(".card-head");
  const detail = card.querySelector(".detail");
  head.addEventListener("click", () => detail.classList.toggle("open"));
  return card;
}

function render() {
  const results = data.results;
  const counts = { exact_match: 0, close_match: 0, same_category_notable_differences: 0, excluded_hard_requirement: 0, insufficient_data: 0, none: 0 };
  for (const r of results) {
    const shown = r.best ?? r.bestAvailable ?? r.candidates[0] ?? null;
    const v = shown ? shown.verdict : "none";
    counts[v] = (counts[v] ?? 0) + 1;
  }

  const header = document.createElement("div");
  header.className = "wrap";
  header.innerHTML = \`
    <h1>ALDI Product Spy</h1>
    <p class="subtitle">\${escapeHtml(data.aldiRetailer ?? "ALDI")} vs \${escapeHtml(data.leaderRetailer ?? "market leader")} — generated \${new Date(data.generatedAt).toLocaleString()}</p>
    <div class="stats">
      <div class="stat"><div class="n">\${results.length}</div><div class="l">ALDI products checked</div></div>
      <div class="stat"><div class="n">\${counts.exact_match}</div><div class="l">Exact matches</div></div>
      <div class="stat"><div class="n">\${counts.close_match}</div><div class="l">Close matches</div></div>
      <div class="stat"><div class="n">\${counts.same_category_notable_differences}</div><div class="l">Notable differences</div></div>
      <div class="stat"><div class="n">\${counts.insufficient_data}</div><div class="l">Unconfirmed</div></div>
      <div class="stat"><div class="n">\${counts.excluded_hard_requirement + counts.none}</div><div class="l">Not a match</div></div>
    </div>
    <div class="disclaimer">
      <strong>Read the pack before you rely on this.</strong> Ingredient, allergen and
      nutrition values here are gathered from web sources that mirror label data — they are
      research-grade, not label-verified, and may be incomplete, outdated or wrong.
      This is a shopping-research aid for comparing products, <strong>not an allergen-safety
      tool</strong>. If you have an allergy or intolerance, always check the physical packaging.
    </div>
  \`;
  app.appendChild(header);

  const list = document.createElement("div");
  list.className = "wrap";
  list.style.paddingTop = "0";
  for (const r of results) list.appendChild(renderResult(r));
  app.appendChild(list);
}

render();
`;

const matches = JSON.parse(await readFile(path.join(root, "data", "matches.json"), "utf8"));
const html = buildHtml(matches);
await mkdir(path.join(root, "report"), { recursive: true });
await writeFile(path.join(root, "report", "index.html"), html);
console.log("Wrote report/index.html");
