// Small fetch wrapper shared by both scrapers: a browser-like User-Agent
// (grocery sites commonly block the default Node fetch UA), retry with
// backoff on transient failures, and a clear error on anything else so
// scrape runs fail loudly instead of silently producing empty data.

export async function fetchWithRetry(url, { retries = 3, delayMs = 1000, headers = {}, ...rest } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/json,*/*",
          ...headers,
        },
        ...rest,
      });
      if (!res.ok) {
        throw new Error(`${url} -> HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * 2 ** attempt));
      }
    }
  }
  throw new Error(`Failed after ${retries + 1} attempts: ${lastErr?.message}`);
}
