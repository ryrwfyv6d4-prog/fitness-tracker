// Walks every screen of the app at iPhone size and saves screenshots, for
// design review. Usage: npm run build && node e2e/screens.mjs [outDir]
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startServer, launch, routeArchive, IPHONE } from "./harness.mjs";

const OUT = process.argv[2] || "e2e/.screens";
await mkdir(OUT, { recursive: true });
const PORT = 4190;
const server = await startServer(PORT);
const browser = await launch();
const ctx = await browser.newContext(IPHONE);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));

await page.addInitScript(() => {
  if (localStorage.getItem("seeded")) return;
  localStorage.setItem("seeded", "1");
  const now = Date.now();
  localStorage.setItem("norm-archive:positions:NormMacDonaldArchive1:v1", JSON.stringify({
    "Norm Macdonald Live Ep12 Super Dave": { t: 1520, d: 3731, at: now },
    "Norm on Conan - Moth Joke 2009": { t: 120, d: 363, at: now - 5000 },
    "1996.09.28 - Weekend Update": { t: 300, d: 700, at: now - 9000 },
  }));
});
await routeArchive(page);

const shot = async (name, opts = {}) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, `${name}.png`), ...opts });
  console.log("saved", name);
};

await page.goto(`http://localhost:${PORT}/`);
await page.waitForSelector('[data-testid="tab-bar"]', { timeout: 20000 });
await shot("01-home");
await page.evaluate(() => window.scrollTo(0, 900));
await shot("02-home-scrolled");
await shot("03-home-full", { fullPage: true });

await page.click('[data-testid="tab-library"]');
await page.waitForSelector('[data-testid="video-grid"]');
await page.evaluate(() => window.scrollTo(0, 0));
await shot("04-library");
await page.evaluate(() => window.scrollTo(0, 2400));
await shot("05-library-scrolled");
await page.evaluate(() => window.scrollTo(0, 0));
await page.fill('[data-testid="search-input"]', "conan moth");
await shot("06-search-results");
await page.fill('[data-testid="search-input"]', "zzqx");
await shot("07-search-empty");
await page.fill('[data-testid="search-input"]', "");

await page.click('[data-testid="tab-timeline"]');
await page.evaluate(() => window.scrollTo(0, 0));
await shot("08-timeline");
await shot("09-timeline-full", { fullPage: true });

await page.click('[data-testid="tab-home"]');
await page.locator('[data-testid="continue-row"] [data-testid="video-card"]').first().click();
await page.waitForSelector('[data-testid="player-modal"]');
await shot("10-player-sheet");
await page.click('[data-testid="more-button"]');
await shot("11-player-more-menu");
await page.click('[data-testid="more-button"]');
await page.locator('[data-testid="player-modal"]').evaluate((el) => el.scrollTo(0, 500));
await shot("11b-player-related");
await page.keyboard.press("Escape");
await page.waitForSelector('[data-testid="mini-player"]');
await shot("12-mini-player");

const card = page.locator('[data-testid="shelf-iconic"] [data-testid="video-card"]').first();
await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
const box = await card.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(650);
await page.mouse.up();
await page.waitForSelector('[data-testid="card-menu"]');
await shot("13-card-menu");

// Loading + error states
const p2 = await (await browser.newContext(IPHONE)).newPage();
await routeArchive(p2, { slowMs: 4000 });
await p2.goto(`http://localhost:${PORT}/`);
await p2.waitForTimeout(800);
await p2.screenshot({ path: join(OUT, "14-loading.png") });
const p3 = await (await browser.newContext(IPHONE)).newPage();
await routeArchive(p3, { failExcept: [] });
await p3.goto(`http://localhost:${PORT}/`);
await p3.waitForSelector('[data-testid="error"]', { timeout: 20000 });
await p3.screenshot({ path: join(OUT, "15-error.png") });

const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await routeArchive(desk);
await desk.goto(`http://localhost:${PORT}/`);
await desk.waitForSelector('[data-testid="tab-bar"]');
await desk.waitForTimeout(500);
await desk.screenshot({ path: join(OUT, "16-desktop-home.png") });

await browser.close();
server.close();
