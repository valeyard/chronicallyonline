// Shared helpers for scrape.mjs (one day) and backfill.mjs (many days).
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function buildContext(browser) {
  const b64 = process.env.AUTH_STORAGE_STATE_B64;
  const commonOptions = {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  };
  if (!b64) {
    console.warn(
      "[warn] AUTH_STORAGE_STATE_B64 is not set — X requires a logged-in session to browse timelines, so scraping will likely fail. See README.md.",
    );
    return browser.newContext(commonOptions);
  }
  const storageState = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  return browser.newContext({ ...commonOptions, storageState });
}

export async function isLoginWalled(page) {
  if (/\/(i\/flow\/login|login)/.test(page.url())) return true;
  const loginButton = await page.$('[data-testid="loginButton"], a[href="/login"]');
  const articleCount = await page.locator('article[data-testid="tweet"]').count();
  return Boolean(loginButton) && articleCount === 0;
}

export async function collectArticles(page) {
  return page.evaluate(() => {
    const out = [];
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      const timeEl = article.querySelector("time[datetime]");
      const link = timeEl ? timeEl.closest("a") : null;
      const href = link ? link.getAttribute("href") : null;
      const match = href ? href.match(/\/status\/(\d+)/) : null;
      if (!match || !timeEl) continue;

      // X renders the "X reposted" label as a sibling above <article>, not
      // nested inside it — check the article first (older markup), then
      // widen to the enclosing timeline cell.
      const cell = article.closest('[data-testid="cellInnerDiv"]') || article.parentElement;
      const socialContext =
        article.querySelector('[data-testid="socialContext"]') ||
        (cell ? cell.querySelector('[data-testid="socialContext"]') : null);

      const text = article.querySelector('[data-testid="tweetText"]');
      const scopeText = (cell || article).innerText || "";
      out.push({
        id: match[1],
        timestamp: timeEl.getAttribute("datetime"),
        url: href.replace(/^\//, "https://x.com/"),
        socialContext: socialContext ? socialContext.innerText : null,
        isReply: /(^|\n)Replying to @/.test(scopeText),
        textSnippet: text ? text.innerText.slice(0, 280) : "",
      });
    }
    return out;
  });
}

export function isPinnedRecord(rec) {
  return Boolean(rec.socialContext && /pinned/i.test(rec.socialContext));
}

export function classify(rec) {
  if (isPinnedRecord(rec)) return null;
  const isRepost = Boolean(rec.socialContext && /repost/i.test(rec.socialContext));
  const type = isRepost ? "retweet" : rec.isReply ? "reply" : "original";
  return {
    id: rec.id,
    type,
    timestamp: rec.timestamp,
    url: rec.url,
    textSnippet: rec.textSnippet,
  };
}

export function summarize(tweets) {
  const counts = { original: 0, retweet: 0, reply: 0, total: tweets.length };
  for (const t of tweets) counts[t.type]++;
  return counts;
}
