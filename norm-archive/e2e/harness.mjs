// Shared plumbing for the e2e suites: serves the static export in out/,
// mocks every archive.org request from fixtures.mjs, and collects pass/fail.
import { chromium } from "playwright-core";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { METADATA, SEARCH_RESULTS, VIEWS_BY_IDENTIFIER } from "./fixtures.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain",
};

export async function startServer(port) {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    try {
      const body = await readFile(normalize(join(OUT_DIR, path)));
      res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise((r) => server.listen(port, r));
  return server;
}

export async function launch() {
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

const hash = (s) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

// Per-video stills get a distinct generated "frame"; the item-level cover
// that clips without their own still fall back to is one fixed image per
// source — exactly how the real data behaves.
function thumbSvg(url) {
  const cover = url.match(/\/services\/img\/([^/?#]+)/);
  if (cover) {
    const id = decodeURIComponent(cover[1]);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#3a3326"/><rect x="110" y="20" width="100" height="140" fill="#d9c9a3"/><text x="160" y="96" font-family="Georgia" font-size="13" fill="#3a3326" text-anchor="middle">${id.slice(0, 14)}</text></svg>`;
  }
  const h = hash(url);
  const hue = h % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="hsl(${hue},28%,24%)"/><circle cx="${90 + (h % 140)}" cy="${70 + (h % 40)}" r="34" fill="hsl(${(hue + 30) % 360},35%,55%)"/><rect x="0" y="120" width="320" height="60" fill="hsl(${(hue + 200) % 360},20%,14%)"/></svg>`;
}

// failExcept: only these identifiers' metadata succeeds (null = all do).
// searchFlood: discovery search returns hundreds of bogus matches, the way
//   archive.org's loose prefix search can — the app must distrust it.
// onRequest: called with "metadata:<id>" / "search:<q>" for request counting.
export async function routeArchive(page, { failExcept = null, slowMs = 0, searchFlood = false, onRequest = null } = {}) {
  await page.route("https://archive.org/**", async (route) => {
    const url = new URL(route.request().url());
    if (slowMs) await new Promise((r) => setTimeout(r, slowMs));
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });

    if (url.pathname === "/advancedsearch.php") {
      const q = url.searchParams.get("q");
      onRequest?.(`search:${q}`);
      const exact = q.match(/^identifier:([^*]+)$/);
      if (exact) {
        const views = VIEWS_BY_IDENTIFIER[exact[1]];
        return json({ response: { docs: views != null ? [{ identifier: exact[1], downloads: views }] : [] } });
      }
      if (searchFlood) return json({ response: { docs: Array.from({ length: 334 }, (_, i) => ({ identifier: `sports-show-with-norm-macdonald-flood-${i}` })) } });
      return json({ response: { docs: (SEARCH_RESULTS[q] || []).map((identifier) => ({ identifier })) } });
    }

    const m = url.pathname.match(/^\/metadata\/(.+)$/);
    if (m) {
      const identifier = decodeURIComponent(m[1]);
      onRequest?.(`metadata:${identifier}`);
      const meta = METADATA[identifier];
      if (!meta || (failExcept && !failExcept.includes(identifier))) return route.fulfill({ status: 404, body: "not found" });
      return json(meta);
    }

    if (/\.(jpe?g|png)$/i.test(url.pathname) || url.pathname.includes("/services/img/")) {
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: thumbSvg(url.href) });
    }
    // Video bytes: an empty response. Playback never really starts, which is
    // fine — the suites exercise UI state, not decoding.
    return route.fulfill({ status: 204, body: "" });
  });
}

export function makeChecker(label) {
  const failures = [];
  const check = (name, cond) => {
    console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
    if (!cond) failures.push(name);
  };
  const finish = () => {
    console.log(failures.length ? `\n${label}: ${failures.length} FAILURES:\n- ${failures.join("\n- ")}` : `\n${label}: ALL CHECKS PASSED`);
    return failures.length;
  };
  return { check, failures, finish };
}

export const IPHONE = { viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" };
