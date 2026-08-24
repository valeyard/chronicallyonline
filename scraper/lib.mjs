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

// expectedHandle: the politician whose page we're on. On the "with replies"
// timeline, a reply's parent tweet (written by whoever they replied to)
// renders as its own full, separate <article> immediately before the reply
// — there is no "Replying to @x" text label in this view at all, contrary
// to what an earlier version of this function assumed. That means two
// things: (1) reply detection has to come from thread position, not a
// label, and (2) without an author check, that parent tweet gets counted
// as one of expectedHandle's own posts, which it is not — confirmed via a
// live debug run turning up tweets from completely unrelated accounts
// (e.g. a reply-thread partner's own tweet) tagged as "own" posts.
export async function collectArticles(page, expectedHandle) {
  return page.evaluate((expectedHandle) => {
    const out = [];
    let prevAuthorHandle; // undefined until we've seen a valid preceding article

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

      const nameLink = article.querySelector('[data-testid="User-Name"] a[href^="/"]');
      const authorHandle = nameLink ? nameLink.getAttribute("href").replace(/^\//, "").split("/")[0] : null;
      const socialContextText = socialContext ? socialContext.innerText : null;
      // A repost's DOM author is whoever wrote the original tweet, not the
      // reposting account — isOwn only makes sense for non-reposts, so
      // reposts are exempted here and checked by their socialContext label
      // downstream (isRepostRecord) instead.
      const isRepost = Boolean(socialContextText && /repost/i.test(socialContextText));
      // Diagnostic only: does the word "repost" appear ANYWHERE in a much
      // wider ancestor than what socialContext actually searches? If this
      // is ever true while isRepost is false, the label exists but has
      // moved somewhere our selector doesn't reach — narrows down whether
      // X changed the DOM location vs. changed the wording/testid entirely.
      const wideAncestor = (cell && cell.parentElement) || cell || article;
      const wideRepostTextFound = /repost/i.test(wideAncestor.innerText || "");
      const isOwn = expectedHandle
        ? isRepost || (Boolean(authorHandle) && authorHandle.toLowerCase() === expectedHandle.toLowerCase())
        : true;

      const text = article.querySelector('[data-testid="tweetText"]');
      const scopeText = (cell || article).innerText || "";
      // Belt-and-braces: keep the text-label check too (harmless, and
      // covers it if some other view does render it), OR'd with the
      // thread-position signal that's actually needed here.
      const hasReplyLabel = /(^|\n)Replying to\s+@/.test(scopeText);
      const followsOtherAuthor =
        prevAuthorHandle !== undefined &&
        prevAuthorHandle !== null &&
        authorHandle !== null &&
        prevAuthorHandle.toLowerCase() !== authorHandle.toLowerCase();

      out.push({
        id: match[1],
        timestamp: timeEl.getAttribute("datetime"),
        url: href.replace(/^\//, "https://x.com/"),
        socialContext: socialContextText,
        authorHandle,
        isOwn,
        isReply: hasReplyLabel || followsOtherAuthor,
        textSnippet: text ? text.innerText.slice(0, 280) : "",
        // Diagnostic only (not used for classification): lets scrape.mjs's
        // debug log show the raw text a run actually saw, instead of just
        // the computed booleans, when those booleans look suspicious.
        cellSource: article.closest('[data-testid="cellInnerDiv"]')
          ? "cellInnerDiv"
          : article.parentElement
            ? "parentElement"
            : "none",
        scopeTextSnippet: scopeText.slice(0, 200),
        wideRepostTextFound,
        // Diagnostic only: raw markup, to see what the current DOM actually
        // looks like near the top of a timeline cell (attribute names,
        // nesting) rather than inferring it through our own selectors,
        // which may be stale if X changed something here.
        cellHtmlSnippet: (cell ? cell.outerHTML : article.outerHTML || "").slice(0, 500),
      });

      // A repost's DOM author (the original poster) isn't a meaningful
      // "previous author" for the next item's reply-adjacency check — skip
      // updating it so a retweet in between doesn't make the politician's
      // very next original post look like a reply.
      if (!isRepost) {
        prevAuthorHandle = authorHandle;
      }
    }
    return out;
  }, expectedHandle);
}

export function isPinnedRecord(rec) {
  return Boolean(rec.socialContext && /pinned/i.test(rec.socialContext));
}

// A repost's <time datetime> reflects the actual repost time (confirmed
// against production data — a real account's reposts came back densely and
// evenly spaced across the day, exactly matching feed position), unlike a
// pinned tweet's, which can be arbitrarily old. Reposts are otherwise
// treated like any other record for date filtering and scroll-boundary
// decisions.
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

// Turns a `seen` Map (id -> record) into classified tweets whose timestamp
// falls in [start, end). Pinned tweets are always excluded, since a pin can
// be arbitrarily old regardless of its position in the feed. rec.isOwn is
// false for a reply thread's parent tweet (written by whoever the tracked
// politician replied to) — those aren't the politician's own posts and
// must never be counted, confirmed via a live run turning up tweets
// authored by completely unrelated accounts.
export function extractTweets(seen, { start, end }) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const tweets = [];

  for (const rec of seen.values()) {
    if (isPinnedRecord(rec) || !rec.timestamp) continue;
    if (rec.isOwn === false) continue;
    const ms = new Date(rec.timestamp).getTime();
    if (ms < startMs || ms >= endMs) continue;

    const tweet = classify(rec);
    if (tweet) tweets.push(tweet);
  }

  return tweets;
}

export function summarize(tweets) {
  const counts = { original: 0, retweet: 0, reply: 0, total: tweets.length };
  for (const t of tweets) counts[t.type]++;
  return counts;
}
