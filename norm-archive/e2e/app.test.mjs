// End-to-end checks of the built app (out/) on an emulated iPhone, with
// archive.org mocked from fixtures.mjs. Run `npm run build` first.
import { transformMetadata, mergeLibraries } from "../lib/transform.mjs";
import { sourceOptions } from "../lib/sources.mjs";
import { METADATA } from "./fixtures.mjs";
import { startServer, launch, routeArchive, makeChecker, IPHONE } from "./harness.mjs";

const PORT = 4191;
const URL = `http://localhost:${PORT}/`;
const { check, finish } = makeChecker("app");

const lib = mergeLibraries(Object.entries(METADATA).map(([id, m]) => transformMetadata(m, id, sourceOptions(id))));
const TOTAL = lib.videoCount;
const ICONIC = lib.videos.filter((v) => v.iconic).length;
const BOOTLEGS = lib.videos.filter((v) => v.sourceIdentifier === "NORMBOOTLEGS").length;

const server = await startServer(PORT);
const browser = await launch();
const pageErrors = [];

const seed = () => {
  if (localStorage.getItem("e2e-seeded")) return;
  localStorage.setItem("e2e-seeded", "1");
  localStorage.setItem(
    "norm-archive:positions:NormMacDonaldArchive1:v1",
    JSON.stringify({
      "Norm Macdonald Live Ep12 Super Dave": { t: 1520, d: 3731, at: Date.now() },
      "Dirty Work Press Junket 1998": { t: 291, d: 295, at: Date.now() - 1000 },
    })
  );
};

async function longPress(page, locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await page.waitForSelector('[data-testid="card-menu"]', { timeout: 3000 });
}

const cards = (page, scope = '[data-testid="video-grid"]') => page.locator(`${scope} [data-testid="video-card"]`);
const gridTitles = (page) => page.locator('[data-testid="video-grid"] h3').allTextContents();
async function search(page, q) {
  await page.fill('[data-testid="search-input"]', q);
  await page.waitForTimeout(80);
}

// ───────────────────────── main iPhone session ─────────────────────────
const ctx = await browser.newContext({ ...IPHONE, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
page.on("pageerror", (e) => pageErrors.push(e.message));
const requests = [];
await page.addInitScript(seed);
await routeArchive(page, { onRequest: (r) => requests.push(r) });
await page.goto(URL);
await page.waitForSelector('[data-testid="tab-bar"]', { timeout: 20000 });

check(`all 16 archive.org items fetched (got ${requests.filter((r) => r.startsWith("metadata:")).length})`, requests.filter((r) => r.startsWith("metadata:")).length === 16);

// Home
check("Home tab active on load", (await page.getAttribute('[data-testid="tab-home"]', "aria-current")) === "page");
check(`header counts ${TOTAL} clips`, (await page.textContent('[data-testid="header-subtitle"]')).includes(`${TOTAL} clips`));
check("no Channel tab", (await page.locator('[data-testid="tab-channel"]').count()) === 0);
check("continue-watching shelf shows the in-progress clip", (await cards(page, '[data-testid="continue-row"]').count()) === 1);
check("continue card has a progress bar", (await page.locator('[data-testid="continue-row"] [data-testid="progress"]').count()) === 1);
check("Iconic shelf present", (await page.locator('[data-testid="shelf-iconic"]').count()) === 1);
check("a shelf per category (SNL)", (await page.locator('[data-testid="shelf-cat-SNL"]').count()) === 1);
const shelfIds = await page.locator('section[data-testid^="shelf-"]').evaluateAll((els) => els.map((e) => e.dataset.testid));
check(`catch-all "Other" shelf comes last (got ${shelfIds.at(-1)})`, shelfIds.at(-1) === "shelf-cat-Other");
check("shelves show real stills before generated title cards", (await page.locator('[data-testid="shelf-cat-SNL"] [data-testid="video-card"]').first().locator('[data-testid="title-card"]').count()) === 0);

await page.click('[data-testid="see-all-iconic"]');
await page.waitForSelector('[data-testid="video-grid"]');
check("See all → Library filtered to Iconic", (await page.textContent('[data-testid="section-heading"]')) === "★ Iconic");
check(`Iconic filter shows all ${ICONIC}`, (await cards(page).count()) === ICONIC);

// Home search hands off to Library with the text and focus
await page.click('[data-testid="tab-home"]');
await page.fill('[data-testid="home-search"]', "moth");
await page.waitForSelector('[data-testid="video-grid"]');
check("typing on Home opens Library with the query", (await page.inputValue('[data-testid="search-input"]')) === "moth");
check("Library search input is focused", await page.evaluate(() => document.activeElement?.dataset.testid === "search-input"));
const mothTitles = await gridTitles(page);
check(`"moth" finds both Moth Joke clips (got ${mothTitles.length})`, mothTitles.length === 2 && mothTitles.every((t) => /moth/i.test(t)));

// Library
await search(page, "");
check(`Library grid shows all ${TOTAL}`, (await cards(page).count()) === TOTAL);
check("clips without their own still get a title card", (await page.locator('[data-testid="video-grid"] [data-testid="title-card"]').count()) > 20);
const pills = await page.locator('[role="group"][aria-label="Filter by category"] button').allTextContents();
check(`"Other" pill is last (got ${pills.at(-1)})`, pills.at(-1).startsWith("Other"));

await search(page, "conan moth");
check("multi-word search matches words in any order", (await gridTitles(page)).join() === "Norm on Conan – Moth Joke");
await search(page, "snl 1996");
const snl96 = await page.locator('[data-testid="video-grid"] [data-testid="video-card"]').allTextContents();
check(`"snl 1996" matches category + year (got ${snl96.length})`, snl96.length >= 3 && snl96.every((t) => t.includes("1996")));
await search(page, "obrien");
check("punctuation-insensitive search (obrien → O'Brien)", (await gridTitles(page)).includes("Conan O'Brien Norm Macdonald (Jun 11, 2009)"));
await search(page, "zzqx");
check("empty search state shown", (await page.locator('[data-testid="empty"]').count()) === 1);
await page.click('[data-testid="clear-search"]');
check("Clear search restores the grid", (await cards(page).count()) === TOTAL);

await page.click('[data-testid="filter-SNL"]');
await search(page, "carrot");
check("search scoped to a category can come up empty", (await page.locator('[data-testid="search-everywhere"]').count()) === 1);
await page.click('[data-testid="search-everywhere"]');
check("“Search all clips” widens to every category", (await gridTitles(page)).includes("Norm Macdonald on Conan – Carrot Top"));
await search(page, "");

await page.selectOption('[data-testid="sort"]', "new");
const maxYear = Math.max(...lib.videos.map((v) => Number(v.year) || 0));
const newestTag = await page.locator('[data-testid="video-grid"] [data-testid="video-card"]').first().textContent();
check(`Newest first starts at ${maxYear} (got ${newestTag})`, newestTag.includes(String(maxYear)));
await page.selectOption('[data-testid="sort"]', "az");

await page.locator('[data-testid="video-grid"] [data-testid="fav-toggle"]').first().click();
check("favoriting adds a Favorites pill", (await page.textContent('[data-testid="filter-♥ Favorites"]')).includes("1"));
await page.reload();
await page.waitForSelector('[data-testid="tab-bar"]');
check("favorite survives reload (Home shelf)", (await page.locator('[data-testid="shelf-favs"]').count()) === 1);

// Long-press menu
await page.click('[data-testid="tab-library"]');
await page.waitForSelector('[data-testid="video-grid"]');
const bootleg = page.locator('[data-testid="video-grid"] [data-testid="video-card"]', { hasText: "Bootleg Standup Set Chicago" });
await longPress(page, bootleg);
check("long-press opens the menu, not the player", (await page.locator('[data-testid="player-modal"]').count()) === 0);
await page.click('[data-testid="menu-watchlater"]');
check("Watch Later pill appears", (await page.textContent('[data-testid="filter-⏱ Watch Later"]')).includes("1"));
await longPress(page, bootleg);
await page.click('[data-testid="menu-watched"]');
check("manual Mark as Watched shows the badge", (await bootleg.locator('[data-testid="watched-badge"]').count()) === 1);
await bootleg.click({ button: "right" });
await page.waitForSelector('[data-testid="card-menu"]');
check("right-click opens the menu too", true);
await page.click('[data-testid="menu-cancel"]');
check("Cancel closes the menu", (await page.locator('[data-testid="card-menu"]').count()) === 0);
await page.click('[data-testid="tab-home"]');
check("Watch later shelf on Home", (await page.locator('[data-testid="shelf-later"]').count()) === 1);
await longPress(page, cards(page, '[data-testid="continue-row"]').first());
await page.click('[data-testid="menu-remove-progress"]');
check("Remove from Continue Watching empties the row", (await page.locator('[data-testid="continue-row"]').count()) === 0);

// Watch page
await page.click('[data-testid="tab-library"]');
await search(page, "the norm show s01e03");
await cards(page).first().click();
await page.waitForSelector('[data-testid="player-modal"]');
check("native video with controls + playsinline", (await page.locator('[data-testid="player"][controls][playsinline]').count()) === 1);
check("video streams from archive.org", (await page.getAttribute('[data-testid="player"]', "src")).startsWith("https://archive.org/download/NormMacDonaldArchive1/The%20Norm%20Show"));
const related = page.locator('[data-testid="related-item"]');
check(`"More like this" list under the player (got ${await related.count()})`, (await related.count()) >= 4);
const firstRelated = await related.first().textContent();
check(`next episode offered first (${firstRelated.slice(0, 40)}…)`, firstRelated.includes("Next episode") && firstRelated.includes("S01E04"));
await page.waitForFunction(() => location.hash.startsWith("#v="), undefined, { timeout: 3000 });
const hashBefore = await page.evaluate(() => location.hash);
await related.first().click();
await page.waitForTimeout(300);
check("picking a related clip keeps the watch page open", (await page.locator('[data-testid="player-modal"]').count()) === 1);
check("…and switches to it", (await page.textContent('[data-testid="player-modal"] h2')).includes("S01E04"));
await page.waitForFunction((h) => location.hash !== h, hashBefore, { timeout: 3000 });
check("share link follows the new clip", (await page.evaluate(() => location.hash)).includes("S1ep4"));

await page.click('[data-testid="more-button"]');
await page.click('[data-testid="rate-1.5"]');
check("speed applies to the video", (await page.locator('[data-testid="player"]').evaluate((v) => v.playbackRate)) === 1.5);
await related.first().click();
await page.waitForTimeout(300);
check("speed carries over to the next clip", (await page.locator('[data-testid="player"]').evaluate((v) => v.playbackRate)) === 1.5);
await page.click('[data-testid="more-button"]');
await page.click('[data-testid="rate-1"]');
await page.click('[data-testid="more-button"]');

await page.click('[data-testid="modal-watchlater"]');
check("Save toggles via aria-pressed", (await page.getAttribute('[data-testid="modal-watchlater"]', "aria-pressed")) === "true");
await page.click('[data-testid="share-button"]');
await page.waitForTimeout(150);
const clip = await page.evaluate(() => navigator.clipboard.readText());
check("Share copies the deep link", clip.endsWith(await page.evaluate(() => location.hash)));
check("Share confirms with Copied!", (await page.getAttribute('[data-testid="share-button"]', "title")) === "Copied!");
const msTitle = await page.evaluate(() => navigator.mediaSession.metadata?.title);
check("lock-screen Now Playing set", msTitle === (await page.textContent('[data-testid="player-modal"] h2')));

// Mini player
const before = await page.evaluateHandle(() => document.querySelector('[data-testid="player"]'));
await page.click('[data-testid="minimize-button"]');
await page.waitForSelector('[data-testid="mini-player"]');
const after = await page.evaluateHandle(() => document.querySelector('[data-testid="player"]'));
check("minimizing keeps the same <video> (no restart)", await page.evaluate(([a, b]) => a === b, [before, after]));
const miniBox = await page.locator('[data-testid="mini-player"]').boundingBox();
check(`mini player is a slim bar (h=${Math.round(miniBox.height)})`, miniBox.height < 90);
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(200);
const footerBottom = await page.locator('[data-testid="sources-footer"]').evaluate((el) => el.getBoundingClientRect().bottom);
const miniTop = (await page.locator('[data-testid="mini-player"]').boundingBox()).y;
check(`nothing hides behind the mini bar (footer ${Math.round(footerBottom)} ≤ bar ${Math.round(miniTop)})`, footerBottom <= miniTop + 1);
check("Now Playing survives minimizing", (await page.evaluate(() => navigator.mediaSession.metadata?.title)) === msTitle);
await page.click('[data-testid="mini-player-title"]');
await page.waitForSelector('[data-testid="player-modal"]');
check("tapping the bar reopens the watch page", true);
await page.keyboard.press("Escape");
await page.waitForSelector('[data-testid="mini-player"]');
check("Escape minimizes", true);
await page.click('[data-testid="mini-close"]');
await page.waitForTimeout(200);
check("close stops playback entirely", (await page.locator('[data-testid="player"]').count()) === 0);
const ms = await page.evaluate(() => ({ m: navigator.mediaSession.metadata, s: navigator.mediaSession.playbackState }));
check("Now Playing cleared on close", ms.m === null && ms.s === "none");

// Deep links
const bootlegId = lib.videos.find((v) => v.title === "Bootleg Standup Set Chicago").id;
await page.goto(`${URL}#v=${encodeURIComponent(bootlegId)}`);
await page.waitForSelector('[data-testid="player-modal"]', { timeout: 15000 });
check("deep link opens the clip", (await page.textContent('[data-testid="player-modal"] h2')) === "Bootleg Standup Set Chicago");
await page.reload();
await page.waitForSelector('[data-testid="player-modal"]', { timeout: 15000 });
check("deep link survives reload", (await page.textContent('[data-testid="player-modal"] h2')) === "Bootleg Standup Set Chicago");
await page.keyboard.press("Escape");
await page.click('[data-testid="mini-close"]');

// Back to top
await page.click('[data-testid="tab-library"]');
await page.waitForSelector('[data-testid="video-grid"]');
check("back-to-top hidden at the top", (await page.locator('[data-testid="scroll-top-button"]').count()) === 0);
await page.evaluate(() => window.scrollTo(0, 3000));
await page.waitForTimeout(200);
await page.click('[data-testid="scroll-top-button"]');
check("back-to-top scrolls up", await page.waitForFunction(() => window.scrollY < 50, undefined, { timeout: 3000 }).then(() => true, () => false));

// Timeline
await page.click('[data-testid="tab-timeline"]');
const timeline = await page.textContent("body");
check("Timeline starts with Early stand-up, not the SNL years", timeline.indexOf("Early stand-up") < timeline.indexOf("The SNL years"));
check("singular “1 clip”", /1 clip(?!s)/.test(timeline));

// ───────────────────────── desktop ─────────────────────────
const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
desk.on("pageerror", (e) => pageErrors.push(`desktop: ${e.message}`));
await routeArchive(desk);
await desk.goto(URL);
await desk.waitForSelector('[data-testid="tab-bar"]');
await desk.click('[data-testid="tab-library"]');
check("desktop Library grid renders", (await cards(desk).count()) === TOTAL);

// ───────────────────────── degraded / failure ─────────────────────────
const degraded = await (await browser.newContext(IPHONE)).newPage();
degraded.on("pageerror", (e) => pageErrors.push(`degraded: ${e.message}`));
await routeArchive(degraded, { failExcept: ["NORMBOOTLEGS"], searchFlood: true });
await degraded.goto(URL);
await degraded.waitForSelector('[data-testid="tab-bar"]', { timeout: 20000 });
await degraded.click('[data-testid="tab-library"]');
check(`one live source still renders its ${BOOTLEGS} clips; search flood ignored`, (await cards(degraded).count()) === BOOTLEGS);
await degraded.click('[data-testid="source-status"] summary');
check("failed source listed with its reason", /✗[\s\S]*HTTP 404/.test(await degraded.textContent('[data-testid="source-status-NormMacDonaldArchive1"]')));

const down = await (await browser.newContext(IPHONE)).newPage();
await routeArchive(down, { failExcept: [] });
await down.goto(URL);
await down.waitForSelector('[data-testid="error"]', { timeout: 20000 });
check("all sources down → error screen with retry", (await down.textContent('[data-testid="error"]')).includes("Try again"));

check(`no page errors (${pageErrors.join(" | ") || "none"})`, pageErrors.length === 0);

await browser.close();
server.close();
process.exit(finish() ? 1 : 0);
