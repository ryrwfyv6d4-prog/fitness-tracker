/* ALDI Product Spy — client app.
   Pick an ALDI product on the left; the panel shows the closest comparable
   product at each competing retailer, with the full comparison behind a click.
   Data is embedded at build time as window.__MATCHES__. */

const DATA = window.__MATCHES__;
const RESULTS = DATA.results || [];

const VERDICT_LABEL = {
  exact_match: "Exact match",
  close_match: "Close match",
  same_category_notable_differences: "Notable differences",
  excluded_hard_requirement: "Not a match",
  insufficient_data: "Unconfirmed",
  not_scoreable: "No data to compare",
};
const VERDICT_CLASS = {
  exact_match: "exact",
  close_match: "close",
  same_category_notable_differences: "notable",
  excluded_hard_requirement: "excluded",
  insufficient_data: "unknown",
  not_scoreable: "none",
};
const NUTRIENT_LABEL = {
  energyKj: "Energy (kJ)",
  proteinG: "Protein (g)",
  fatG: "Fat (g)",
  saturatedFatG: "Saturated fat (g)",
  carbohydrateG: "Carbohydrate (g)",
  sugarsG: "Sugars (g)",
  sodiumMg: "Sodium (mg)",
  fibreG: "Fibre (g)",
};

let selectedId = RESULTS.length ? RESULTS[0].aldiProduct.id : null;
let query = "";
let categoryFilter = "all";
let statusFilter = "all";

// Groups the fine-grained verdicts into the three states a shopper actually
// cares about when scanning a long list.
const STATUS_OF = {
  exact_match: "matched",
  close_match: "matched",
  same_category_notable_differences: "differs",
  excluded_hard_requirement: "differs",
  insufficient_data: "unknown",
  not_scoreable: "unknown",
  none: "unknown",
};

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
const pct = (x) => (typeof x === "number" ? Math.round(x * 100) + "%" : "—");
const num = (x) => (typeof x === "number" ? String(Math.round(x * 10) / 10) : "—");
const money = (x) => (typeof x === "number" ? "$" + x.toFixed(2) : null);

function shownCandidate(r) {
  return r.best || r.bestAvailable || (r.candidates && r.candidates[0]) || null;
}

function verdictOf(r) {
  const c = shownCandidate(r);
  return c ? c.verdict : "none";
}

function badge(verdict) {
  const cls = VERDICT_CLASS[verdict] || "none";
  const label = VERDICT_LABEL[verdict] || "No candidate";
  return '<span class="badge ' + cls + '">' + esc(label) + "</span>";
}

function retailerTag(retailer) {
  const key = String(retailer || "").toLowerCase();
  return '<span class="rtag ' + esc(key) + '">' + esc(retailer || "Unknown") + "</span>";
}

/* ---------- left rail ---------- */

function categories() {
  const set = new Set(RESULTS.map((r) => r.aldiProduct.category).filter(Boolean));
  return ["all", ...[...set].sort()];
}

function visibleResults() {
  const q = query.trim().toLowerCase();
  return RESULTS.filter((r) => {
    const p = r.aldiProduct;
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    if (statusFilter !== "all" && (STATUS_OF[verdictOf(r)] || "unknown") !== statusFilter) return false;
    if (!q) return true;
    return (p.name + " " + (p.brand || "") + " " + (p.category || "")).toLowerCase().includes(q);
  });
}

function renderStatusChips() {
  const host = document.getElementById("status-chips");
  const counts = { all: RESULTS.length, matched: 0, differs: 0, unknown: 0 };
  for (const r of RESULTS) counts[STATUS_OF[verdictOf(r)] || "unknown"]++;
  const opts = [
    ["all", "All"],
    ["matched", "Matches"],
    ["differs", "Differs"],
    ["unknown", "Unconfirmed"],
  ];
  host.innerHTML = opts
    .map(
      ([k, label]) =>
        '<button class="chip" type="button" data-status="' + k + '" aria-pressed="' +
        (k === statusFilter) + '">' + label + " " + counts[k] + "</button>"
    )
    .join("");
  host.querySelectorAll(".chip").forEach((el) =>
    el.addEventListener("click", () => {
      statusFilter = el.dataset.status;
      renderStatusChips();
      renderList();
    })
  );
}

function renderChips() {
  const host = document.getElementById("chips");
  host.innerHTML = categories()
    .map(
      (c) =>
        '<button class="chip" type="button" data-cat="' +
        esc(c) +
        '" aria-pressed="' +
        (c === categoryFilter) +
        '">' +
        esc(c === "all" ? "All" : c.replace(/-/g, " ")) +
        "</button>"
    )
    .join("");
  host.querySelectorAll(".chip").forEach((el) =>
    el.addEventListener("click", () => {
      categoryFilter = el.dataset.cat;
      renderChips();
      renderList();
    })
  );
}

function renderList() {
  const host = document.getElementById("list");
  const rows = visibleResults();
  document.getElementById("count").textContent =
    rows.length + " of " + RESULTS.length + " ALDI products";
  if (!rows.length) {
    host.innerHTML = '<div class="empty">No products match those filters.</div>';
    return;
  }
  host.innerHTML = rows
    .map((r) => {
      const p = r.aldiProduct;
      const price = money(p.priceAud);
      const bits = [p.sizeG ? p.sizeG + "g" : null, price].filter(Boolean).join(" · ");
      return (
        '<button class="item" type="button" role="option" data-id="' +
        esc(p.id) +
        '" aria-selected="' +
        (p.id === selectedId) +
        '"><div class="nm">' +
        esc(p.name) +
        '</div><div class="mt">' +
        (bits ? "<span>" + esc(bits) + "</span>" : "") +
        badge(verdictOf(r)) +
        "</div></button>"
      );
    })
    .join("");
  host.querySelectorAll(".item").forEach((el) =>
    el.addEventListener("click", () => {
      selectedId = el.dataset.id;
      renderList();
      renderPanel();
      document.querySelector(".panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    })
  );
}

/* ---------- comparison detail ---------- */

function mark(state) {
  if (state === "pass") return '<span class="ok">✓</span>';
  if (state === "fail") return '<span class="bad">✗</span>';
  return '<span class="unk">?</span>';
}

function field(v) {
  return v ? esc(v) : '<em class="unk-text">not recorded</em>';
}

function pills(items, cls) {
  if (!items || !items.length) return '<span class="note">none</span>';
  return (
    '<div class="pill-list">' +
    items.map((i) => '<span class="pill ' + cls + '">' + esc(i) + "</span>").join("") +
    "</div>"
  );
}

function nutritionTable(diff) {
  if (!diff) return '<p class="note">No nutrition data.</p>';
  const rows = Object.keys(diff)
    .map((f) => {
      const v = diff[f];
      const cls = v.deltaPct == null ? "" : v.deltaPct > 0.15 ? "hi" : "lo";
      return (
        "<tr><td>" + esc(NUTRIENT_LABEL[f] || f) + "</td><td>" + num(v.a) + "</td><td>" +
        num(v.b) + '</td><td class="' + cls + '">' + (v.deltaPct == null ? "—" : pct(v.deltaPct)) + "</td></tr>"
      );
    })
    .join("");
  return (
    '<table class="nut"><thead><tr><th>Per 100g</th><th>ALDI</th><th>Match</th><th>Delta</th></tr></thead><tbody>' +
    rows + "</tbody></table>"
  );
}

function provenance(p) {
  if (!p || (!p.aldi && !p.leader)) return "";
  const one = (label, prov) => {
    if (!prov) return "";
    const urls = prov.sources || (prov.url ? [prov.url] : []);
    const links = urls
      .map((u) => {
        let host = u;
        try { host = new URL(u).hostname; } catch (e) { /* keep raw */ }
        return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(host) + "</a>";
      })
      .join(" · ");
    return (
      '<div class="prov-row"><strong>' + esc(label) + "</strong> — " + esc(prov.confidence || "unknown") +
      (links ? " · " + links : "") +
      (prov.notes ? '<div class="prov-note">' + esc(prov.notes) + "</div>" : "") +
      "</div>"
    );
  };
  return '<div class="prov"><h4 class="sub-h">Where this data came from</h4>' +
    one("ALDI", p.aldi) + one("Match", p.leader) + "</div>";
}

function detailHtml(c) {
  const req = c.hardRequirements;
  const scored =
    typeof c.ingredientSimilarity === "number" || typeof c.nutritionSimilarity === "number";
  let html = "";

  if (c.verdict === "insufficient_data") {
    const missing = (c.unknownRequirements || []).join(" and ");
    html +=
      '<div class="callout">Can\'t confirm this as a dupe: <strong>' + esc(missing) +
      "</strong> " + ((c.unknownRequirements || []).length > 1 ? "are" : "is") +
      " missing from the source data. The comparison below still stands, and on the scored signals alone it would rate <strong>" +
      esc(VERDICT_LABEL[c.provisionalVerdict] || "—") + "</strong> — but that is not a confirmed match.</div>";
  }

  html +=
    '<div class="req-row">' + mark(req.countryOfOrigin.state) +
    "<div>Country of origin — ALDI: " + field(req.countryOfOrigin.aldi) +
    " · Match: " + field(req.countryOfOrigin.leader) + "</div></div>";
  html +=
    '<div class="req-row">' + mark(req.allergensContains.state) +
    "<div>Allergens (contains) — ALDI: [" + esc((req.allergensContains.aldi || []).join(", ") || "not recorded") +
    "] · Match: [" + esc((req.allergensContains.leader || []).join(", ") || "not recorded") + "]</div></div>";

  const cmp = c.comparedOn || {};
  if (scored) {
    // Say plainly which signals were actually comparable. A missing panel is
    // never scored as a difference, so it must not read like one.
    if (cmp.ingredients === false || cmp.nutrition === false) {
      const absent = [];
      if (cmp.ingredients === false) absent.push("ingredients");
      if (cmp.nutrition === false) absent.push("the nutrition panel");
      html +=
        '<p class="note">Scored on ' +
        (cmp.ingredients ? "ingredients" : "the nutrition panel") +
        " only — " + esc(absent.join(" and ")) +
        (absent.length > 1 ? " are" : " is") +
        " missing for one or both products, so " +
        (absent.length > 1 ? "they were" : "it was") +
        " not counted either way.</p>";
    }
    html +=
      '<div class="grid2"><div>' +
      '<h4 class="sub-h">Ingredients in common</h4>' + pills(c.ingredientDiff.common, "common") +
      '<h4 class="sub-h">Only in the ALDI version</h4>' + pills(c.ingredientDiff.onlyAldi, "only-a") +
      '<h4 class="sub-h">Only in the match</h4>' + pills(c.ingredientDiff.onlyLeader, "only-b") +
      '<p class="note">Ingredient token overlap: ' +
      (cmp.ingredients ? pct(c.ingredientSimilarity) : "not comparable") + "</p>" +
      '</div><div>' +
      '<h4 class="sub-h">Nutrition panel</h4>' + nutritionTable(c.nutritionDiff) +
      '<p class="note">Nutrition similarity: ' +
      (cmp.nutrition ? pct(c.nutritionSimilarity) : "not comparable") + "</p>" +
      (c.mayContainDiffers
        ? '<p class="note">"May contain" traces differ — ALDI: [' +
          esc((c.allergensMayContain.aldi || []).join(", ") || "none") + "] vs match: [" +
          esc((c.allergensMayContain.leader || []).join(", ") || "none") +
          "] (not a hard requirement, noted only).</p>"
        : "") +
      "</div></div>";
  } else {
    html +=
      '<p class="note">Excluded because a hard requirement conflicts above — ingredient and nutrition similarity were not scored.</p>';
  }

  html += provenance(c.provenance);
  return html;
}

function matchCard(c, idx) {
  const lp = c.leaderProduct;
  const bits = [lp.sizeG ? lp.sizeG + "g" : null, money(lp.priceAud)].filter(Boolean).join(" · ");
  const cmp = c.comparedOn || {};
  const scored =
    typeof c.ingredientSimilarity === "number" || typeof c.nutritionSimilarity === "number";
  return (
    '<div class="match" data-idx="' + idx + '">' +
      '<div class="match-head">' +
        retailerTag(c.retailer || lp.retailer) +
        '<div class="match-title"><div class="n">' + esc(lp.name) + "</div>" +
        '<div class="b">' + esc(lp.brand || "") + (bits ? " · " + esc(bits) : "") + "</div></div>" +
        badge(c.verdict) +
      "</div>" +
      (scored
        ? '<div class="scorebar"><span>Ingredients <b>' +
          (cmp.ingredients ? pct(c.ingredientSimilarity) : "n/a") +
          "</b></span><span>Nutrition <b>" +
          (cmp.nutrition ? pct(c.nutritionSimilarity) : "n/a") +
          '</b></span><span class="toggle-hint">click to expand</span></div>'
        : '<div class="scorebar"><span class="toggle-hint">click to expand</span></div>') +
      '<div class="detail">' + detailHtml(c) + "</div>" +
    "</div>"
  );
}

function renderPanel() {
  const host = document.getElementById("panel");
  const r = RESULTS.find((x) => x.aldiProduct.id === selectedId);
  if (!r) {
    host.innerHTML = '<p class="empty">Select a product on the left.</p>';
    return;
  }
  const p = r.aldiProduct;
  const meta = [p.brand, p.sizeG ? p.sizeG + "g" : null, money(p.priceAud), p.category]
    .filter(Boolean)
    .join(" · ");

  const byRetailer = r.bestByRetailer || {};
  const retailers = Object.keys(byRetailer);

  let body =
    '<div class="sel-head"><h2>' + esc(p.name) + '</h2><div class="meta">' + esc(meta) + "</div></div>";

  if (!retailers.length) {
    body +=
      '<p class="note" style="margin-top:16px">No competitor products in the <strong>' +
      esc(p.category) +
      "</strong> category have been researched yet, so there is nothing to compare against.</p>";
    host.innerHTML = body;
    return;
  }

  body += '<div class="section-title">Closest match at each retailer</div>';
  body += retailers.map((k, i) => matchCard(byRetailer[k], "r" + i)).join("");

  // Dedupe by product id, not object identity — `bestByRetailer` and
  // `candidates` reference the same objects in the matcher, but that identity
  // is lost once the data is serialised to JSON and parsed here.
  const shownIds = new Set(retailers.map((k) => byRetailer[k].leaderProduct.id));
  const others = (r.candidates || []).filter((c) => !shownIds.has(c.leaderProduct.id));
  if (others.length) {
    body += '<div class="section-title">Other candidates considered (' + others.length + ")</div>";
    body += others.map((c, i) => matchCard(c, "o" + i)).join("");
  }

  host.innerHTML = body;
  host.querySelectorAll(".match").forEach((card) => {
    const head = card.querySelector(".match-head");
    const bar = card.querySelector(".scorebar");
    const detail = card.querySelector(".detail");
    const toggle = () => detail.classList.toggle("open");
    head.addEventListener("click", toggle);
    if (bar) bar.addEventListener("click", toggle);
  });
}

/* ---------- boot ---------- */

function boot() {
  document.getElementById("gen").textContent = new Date(DATA.generatedAt).toLocaleString();
  const rets = (DATA.competitorRetailers || []).join(" and ");
  document.getElementById("scope").textContent = rets
    ? "ALDI vs " + rets
    : "ALDI vs competitors";

  const search = document.getElementById("search");
  search.addEventListener("input", () => {
    query = search.value;
    renderList();
  });

  renderStatusChips();
  renderChips();
  renderList();
  renderPanel();
}

boot();
