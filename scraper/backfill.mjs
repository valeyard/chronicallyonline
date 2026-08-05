#!/usr/bin/env node
// One-time historical backfill: scrolls each account's timeline much further
// back than the daily scraper does, buckets whatever it finds into UK
// calendar days, and writes/merges data/YYYY-MM-DD.json for each day found.
//
// This is heavier and riskier than the daily scrape (more scrolling in one
// session), so pick a window deliberately:
//   node scraper/backfill.mjs --days=14
//   node scraper/backfill.mjs --since=2026-07-01 --until=2026-07-31
//
// By default it won't overwrite a day that already has "ok" data for a
// politician (e.g. from the daily scrape) — pass --force to redo those too.
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  londonDateRangeUtc,
  yesterdayLondonDateStr,
  addDaysToDateStr,
  enumerateDates,
  londonDateStrOf,
} from "./dateRange.mjs";
import {
  sleep,
  buildContext,
  isLoginWalled,
  collectArticles,
  summarize,
  isPinnedRecord,
  extractTweets,
} from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const MAX_SCROLLS = 600;
const MAX_CONSECUTIVE_EMPTY_SCROLLS = 4;
const MAX_MINUTES_PER_ACCOUNT = 20;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? "true"];
    }),
  );
  const until = args.until || yesterdayLondonDateStr();
  const since = args.since || addDaysToDateStr(until, -(Number(args.days || 14) - 1));
  return { since, until, force: args.force === "true" };
}

async function loadPoliticians() {
  const raw = await readFile(path.join(ROOT, "config", "politicians.json"), "utf-8");
  return JSON.parse(raw);
}

async function scrapeRange(page, url, { start, end }) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(2000 + Math.random() * 1000);

  if (await isLoginWalled(page)) {
    throw new Error("login-walled");
  }

  const seen = new Map();
  let consecutiveEmpty = 0;
  const deadline = Date.now() + MAX_MINUTES_PER_ACCOUNT * 60 * 1000;

  for (let i = 0; i < MAX_SCROLLS && Date.now() < deadline; i++) {
    const batch = await collectArticles(page);
    let newCount = 0;
    let hitOlder = false;

    for (const rec of batch) {
      if (seen.has(rec.id)) continue;
      seen.set(rec.id, rec);
      newCount++;
      // A pinned tweet's real timestamp can be far older than the target
      // window even though it's rendered at the very top — don't let it
      // look like we've scrolled past the window before we've even started.
      if (!isPinnedRecord(rec) && rec.timestamp && new Date(rec.timestamp) < start) {
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

    if (i % 20 === 0 && i > 0) {
      console.log(`  ...scroll ${i}, ${seen.size} posts seen so far`);
    }

    // page.mouse.wheel scrolls whatever is under the cursor, which defaults
    // to (0,0) — not the timeline. Scroll the document directly instead.
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.8));
    await sleep(1200 + Math.random() * 1000);
  }

  return extractTweets(seen, { start, end });
}

function bucketByLondonDay(tweets) {
  const byDay = {};
  for (const t of tweets) {
    const day = londonDateStrOf(new Date(t.timestamp));
    (byDay[day] ??= []).push(t);
  }
  for (const day of Object.keys(byDay)) {
    byDay[day].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
  return byDay;
}

function loadExistingDay(date) {
  const filePath = path.join(DATA_DIR, `${date}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

async function main() {
  const { since, until, force } = parseArgs();
  console.log(`[backfill] window: ${since} to ${until} (inclusive, UK calendar days)`);

  const politicians = await loadPoliticians();
  const fullRange = {
    start: londonDateRangeUtc(since).start,
    end: londonDateRangeUtc(until).end,
  };

  const browser = await chromium.launch({ headless: process.env.HEADFUL !== "1" });
  const context = await buildContext(browser);

  const perPolitician = {};

  for (const politician of politicians) {
    console.log(`[backfill] ${politician.name} (@${politician.handle})`);
    const page = await context.newPage();
    try {
      const tweets = await scrapeRange(
        page,
        `https://x.com/${politician.handle}/with_replies`,
        fullRange,
      );
      perPolitician[politician.id] = { status: "ok", byDay: bucketByLondonDay(tweets) };
      console.log(`[ok] ${politician.name}: ${tweets.length} posts across the window`);
    } catch (err) {
      perPolitician[politician.id] = { status: "error", error: String(err.message || err) };
      console.warn(`[warn] ${politician.name}: ${err.message}`);
    } finally {
      await page.close();
    }
    await sleep(5000 + Math.random() * 5000);
  }

  await context.close();
  await browser.close();

  await mkdir(DATA_DIR, { recursive: true });
  const dates = enumerateDates(since, until);
  let written = 0;

  for (const date of dates) {
    const dayRange = londonDateRangeUtc(date);
    const existing = loadExistingDay(date);
    const dayResult = existing ?? {
      date,
      scrapedAt: new Date().toISOString(),
      range: { start: dayRange.start.toISOString(), end: dayRange.end.toISOString() },
      politicians: {},
    };

    for (const politician of politicians) {
      const already = dayResult.politicians[politician.id];
      if (already?.status === "ok" && !force) continue;

      const outcome = perPolitician[politician.id];
      if (outcome.status === "error") {
        dayResult.politicians[politician.id] = {
          handle: politician.handle,
          name: politician.name,
          party: politician.party,
          status: "error",
          error: outcome.error,
          counts: null,
          tweets: [],
        };
        continue;
      }

      const tweets = outcome.byDay[date] ?? [];
      dayResult.politicians[politician.id] = {
        handle: politician.handle,
        name: politician.name,
        party: politician.party,
        status: "ok",
        counts: summarize(tweets),
        tweets,
      };
    }

    await writeFile(path.join(DATA_DIR, `${date}.json`), JSON.stringify(dayResult, null, 2));
    written++;
  }

  console.log(`[done] wrote/updated ${written} day files in ${DATA_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
