#!/usr/bin/env node
// Daily scraper: for each tracked politician, visits their X "with replies"
// timeline and records posts/reposts/replies that fall within a given UK
// calendar day. Requires a logged-in session (X blocks anonymous browsing) —
// see README.md for how to produce AUTH_STORAGE_STATE_B64.
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { londonDateRangeUtc, yesterdayLondonDateStr } from "./dateRange.mjs";
import {
  sleep,
  buildContext,
  isLoginWalled,
  collectArticles,
  summarize,
  isPinnedRecord,
  isRepostRecord,
  extractTweets,
} from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const MAX_SCROLLS = 100;
const MAX_CONSECUTIVE_EMPTY_SCROLLS = 3;
const DEBUG_DIR = process.env.DEBUG_SCRAPE_DIR || null;

function parseArgs() {
  const dateArg = process.argv.find((a) => a.startsWith("--date="));
  return { date: dateArg ? dateArg.split("=")[1] : yesterdayLondonDateStr() };
}

async function loadPoliticians() {
  const raw = await readFile(path.join(ROOT, "config", "politicians.json"), "utf-8");
  return JSON.parse(raw);
}

async function pageMetrics(page) {
  return page.evaluate(() => ({
    scrollTop: Math.round(window.scrollY),
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    articlesOnPage: document.querySelectorAll('article[data-testid="tweet"]').length,
  }));
}

async function dumpDebug(page, label) {
  if (!DEBUG_DIR) return;
  try {
    await mkdir(DEBUG_DIR, { recursive: true });
    await page.screenshot({ path: path.join(DEBUG_DIR, `${label}.png`), fullPage: false });
    const html = await page.evaluate(() => {
      const article = document.querySelector('article[data-testid="tweet"]');
      if (!article) return "<no article found on page>";
      const cell = article.closest('[data-testid="cellInnerDiv"]') || article.parentElement;
      return (cell || article).outerHTML.slice(0, 8000);
    });
    await writeFile(path.join(DEBUG_DIR, `${label}.html`), html);
  } catch (err) {
    console.warn(`  [debug] failed to dump for ${label}: ${err.message}`);
  }
}

async function scrapeTimeline(page, url, { start, end }, debugLabel) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(2000 + Math.random() * 1000);

  await dumpDebug(page, `${debugLabel}-initial`);
  const initialMetrics = await pageMetrics(page);
  console.log(`  [initial] url=${page.url()} ${JSON.stringify(initialMetrics)}`);

  if (await isLoginWalled(page)) {
    throw new Error("login-walled");
  }

  const seen = new Map();
  let consecutiveEmpty = 0;
  let scrollsUsed = 0;

  for (let i = 0; i < MAX_SCROLLS; i++) {
    scrollsUsed = i + 1;
    const batch = await collectArticles(page, debugLabel);
    let newCount = 0;
    let hitOlder = false;

    for (const rec of batch) {
      if (seen.has(rec.id)) continue;
      seen.set(rec.id, rec);
      newCount++;
      // A pinned tweet's real timestamp can be far older than the target
      // day even though it's rendered at the very top — don't let it look
      // like we've scrolled past the target day before we've even started.
      // Likewise, a reply thread's parent tweet (isOwn=false) belongs to
      // whoever wrote it, not this politician — its timestamp says nothing
      // about how far back *this account's* history goes, so it can't be
      // used to decide we've scrolled past the target day either.
      if (!isPinnedRecord(rec) && rec.isOwn !== false && rec.timestamp && new Date(rec.timestamp) < start) {
        hitOlder = true;
      }
    }

    if (hitOlder) break;
    if (newCount === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY_SCROLLS) break;
    } else {
      consecutiveEmpty = 0;
    }

    // Fixed-pixel scrollBy assumes scrollTop means the same thing across
    // consecutive polls, which breaks on this virtualized timeline: loading
    // a new page of data causes X to correct earlier items' estimated
    // heights, which can shift the whole layout under a stationary scrollTop
    // value — confirmed via debug runs where scrollTop advanced by its usual
    // ~630px between two polls, but the mounted window's timestamps jumped
    // from Aug 6 straight to Jul 29, silently skipping ~9 days including
    // 61 known retweets. Anchoring to the last article we actually saw
    // instead of an absolute pixel offset makes each step relative to known
    // content, so a layout shift elsewhere can't skip us past anything.
    await page.evaluate(() => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const last = articles[articles.length - 1];
      if (last) {
        last.scrollIntoView({ block: "end" });
      } else {
        window.scrollBy(0, window.innerHeight * 0.7);
      }
    });
    await sleep(1600 + Math.random() * 1200);

    const m = await pageMetrics(page);
    console.log(
      `  [scroll ${i + 1}] scrollTop=${m.scrollTop} scrollHeight=${m.scrollHeight} articlesOnPage=${m.articlesOnPage} newThisBatch=${newCount} uniqueSoFar=${seen.size}`,
    );
  }
  console.log(`  ...${scrollsUsed} scroll(s), ${seen.size} unique posts seen`);
  await dumpDebug(page, `${debugLabel}-final`);

  if (process.env.DEBUG_SCRAPE_DIR) {
    let htmlDumps = 0;
    for (const rec of seen.values()) {
      const kind = isPinnedRecord(rec)
        ? "pinned"
        : isRepostRecord(rec)
          ? "repost"
          : rec.isOwn === false
            ? "other-author"
            : "own";
      console.log(
        `  [item] id=${rec.id} kind=${kind} author=${rec.authorHandle} isReply=${rec.isReply} ts=${rec.timestamp} sc=${JSON.stringify((rec.socialContext || "").slice(0, 40))} cellSrc=${rec.cellSource} wideRepost=${rec.wideRepostTextFound} scope=${JSON.stringify(rec.scopeTextSnippet)}`,
      );
      // Raw markup only for a handful of items (or any wideRepost mismatch)
      // — this field is large, and we're eyeballing it, not diffing it.
      if (rec.wideRepostTextFound || htmlDumps < 5) {
        console.log(`  [html] id=${rec.id} ${JSON.stringify(rec.cellHtmlSnippet)}`);
        htmlDumps++;
      }
    }
  }

  const tweets = extractTweets(seen, { start, end });
  tweets.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return tweets;
}

async function scrapePolitician(context, politician, range) {
  const page = await context.newPage();
  try {
    const tweets = await scrapeTimeline(
      page,
      `https://x.com/${politician.handle}/with_replies`,
      range,
      politician.handle,
    );
    return { status: "ok", counts: summarize(tweets), tweets };
  } catch (err) {
    return { status: "error", error: String(err.message || err), counts: null, tweets: [] };
  } finally {
    await page.close();
  }
}

async function main() {
  const { date } = parseArgs();
  const range = londonDateRangeUtc(date);
  const politicians = await loadPoliticians();

  const browser = await chromium.launch({ headless: process.env.HEADFUL !== "1" });
  const context = await buildContext(browser);

  const result = {
    date,
    scrapedAt: new Date().toISOString(),
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    politicians: {},
  };

  for (const politician of politicians) {
    console.log(`[scrape] ${politician.name} (@${politician.handle})`);
    const outcome = await scrapePolitician(context, politician, range);
    result.politicians[politician.id] = {
      handle: politician.handle,
      name: politician.name,
      party: politician.party,
      ...outcome,
    };
    if (outcome.status === "error") {
      console.warn(`[warn] ${politician.name}: ${outcome.error}`);
    } else {
      console.log(`[ok] ${politician.name}: ${JSON.stringify(outcome.counts)}`);
    }
    await sleep(4000 + Math.random() * 4000);
  }

  await context.close();
  await browser.close();

  await mkdir(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, `${date}.json`);
  await writeFile(outPath, JSON.stringify(result, null, 2));
  console.log(`[done] wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
