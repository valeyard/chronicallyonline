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

// X displays a repost with the ORIGINAL tweet's post time, not the time it
// was reposted — there is no repost timestamp anywhere in the page markup.
// So a record's own `timestamp` cannot be trusted for date-bucketing or
// scroll-boundary decisions when this is true.
export function isRepostRecord(rec) {
  return Boolean(rec.socialContext && /repost/i.test(rec.socialContext));
}

export function classify(rec) {
  if (isPinnedRecord(rec)) return null;
  const isRepost = isRepostRecord(rec);
  const type = isRepost ? "retweet" : rec.isReply ? "reply" : "original";
  return {
    id: rec.id,
    type,
    timestamp: rec.timestamp,
    url: rec.url,
    textSnippet: rec.textSnippet,
  };
}

// Turns a `seen` Map (id -> record, in feed order — most recent first,
// since each scroll only appends newly-revealed items after the previous
// batch) into classified tweets whose timestamp falls in [start, end).
//
// Reposts have no real repost timestamp available (see isRepostRecord), so
// each one is anchored to whichever neighboring original/reply is CLOSER by
// feed position — checking both directions, not just the preceding one.
// Anchoring only backward would drop e.g. evening reposts that appear above
// (more recent than) the day's own original posts in feed order.
export function extractTweets(seen, { start, end }) {
  const entries = [...seen.values()];
  const n = entries.length;
  const ownMs = entries.map((rec) => {
    if (isPinnedRecord(rec) || isRepostRecord(rec) || !rec.timestamp) return null;
    return new Date(rec.timestamp).getTime();
  });

  const beforeIdx = new Array(n).fill(-1); // nearest known anchor at a smaller index (more recent)
  for (let i = 0, last = -1; i < n; i++) {
    beforeIdx[i] = last;
    if (ownMs[i] != null) last = i;
  }
  const afterIdx = new Array(n).fill(-1); // nearest known anchor at a larger index (older)
  for (let i = n - 1, last = -1; i >= 0; i--) {
    afterIdx[i] = last;
    if (ownMs[i] != null) last = i;
  }

  const startMs = start.getTime();
  const endMs = end.getTime();
  const tweets = [];

  for (let i = 0; i < n; i++) {
    const rec = entries[i];
    if (isPinnedRecord(rec)) continue;

    let effectiveMs;
    if (isRepostRecord(rec)) {
      const b = beforeIdx[i];
      const a = afterIdx[i];
      if (b === -1 && a === -1) continue; // no anchor at all — can't place it
      if (b === -1) effectiveMs = ownMs[a];
      else if (a === -1) effectiveMs = ownMs[b];
      else effectiveMs = i - b <= a - i ? ownMs[b] : ownMs[a];
    } else {
      effectiveMs = ownMs[i];
    }
    if (effectiveMs == null || effectiveMs < startMs || effectiveMs >= endMs) continue;

    const tweet = classify(rec);
    if (!tweet) continue;
    tweet.timestamp = new Date(effectiveMs).toISOString();
    tweets.push(tweet);
  }

  return tweets;
}

export function summarize(tweets) {
  const counts = { original: 0, retweet: 0, reply: 0, total: tweets.length };
  for (const t of tweets) counts[t.type]++;
  return counts;
}
