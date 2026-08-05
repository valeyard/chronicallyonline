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
import { sleep, buildContext, isLoginWalled, collectArticles, classify, summarize } from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const MAX_SCROLLS = 40;
const MAX_CONSECUTIVE_EMPTY_SCROLLS = 3;

function parseArgs() {
  const dateArg = process.argv.find((a) => a.startsWith("--date="));
  return { date: dateArg ? dateArg.split("=")[1] : yesterdayLondonDateStr() };
}

async function loadPoliticians() {
  const raw = await readFile(path.join(ROOT, "config", "politicians.json"), "utf-8");
  return JSON.parse(raw);
}

async function scrapeTimeline(page, url, { start, end }) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(2000 + Math.random() * 1000);

  if (await isLoginWalled(page)) {
    throw new Error("login-walled");
  }

  const seen = new Map();
  let consecutiveEmpty = 0;

  for (let i = 0; i < MAX_SCROLLS; i++) {
    const batch = await collectArticles(page);
    let newCount = 0;
    let hitOlder = false;

    for (const rec of batch) {
      if (seen.has(rec.id)) continue;
      seen.set(rec.id, rec);
      newCount++;
      if (rec.timestamp && new Date(rec.timestamp) < start) hitOlder = true;
    }

    if (hitOlder) break;
    if (newCount === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY_SCROLLS) break;
    } else {
      consecutiveEmpty = 0;
    }

    await page.mouse.wheel(0, 2200);
    await sleep(1400 + Math.random() * 1200);
  }

  const tweets = [];
  for (const rec of seen.values()) {
    if (!rec.timestamp) continue;
    const ts = new Date(rec.timestamp);
    if (ts < start || ts >= end) continue;
    const tweet = classify(rec);
    if (tweet) tweets.push(tweet);
  }
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
