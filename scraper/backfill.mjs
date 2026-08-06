#!/usr/bin/env node
// One-time historical backfill. For each politician, works out which days in
// the requested window are missing (or errored) and only scrapes the
// min..max span of those — days already "ok" in data/ are never re-fetched,
// and a politician whose whole window is already covered gets no browser
// work at all. That makes it safe to run this repeatedly with a growing
// window (e.g. to spread scraping out over several days) without redoing
// the same ground each time:
//   node scraper/backfill.mjs --days=14
//   node scraper/backfill.mjs --since=2026-07-01 --until=2026-07-31
//   node scraper/backfill.mjs --days=7 --only=zack-polanski
//
// Rather than scrolling an account's live timeline from the top (which
// means wading through every newer day to reach an older gap), this uses
// X's search with since:/until: to jump straight to the needed window:
// https://x.com/search?q=from:handle%20since:2026-07-01%20until:2026-07-15
// include:nativeretweets is required or retweets silently don't show up in
// search results — this hasn't been cross-validated against the profile-
// timeline numbers the way the daily scraper was, so treat a first backfill
// run via search with the same suspicion (compare counts against what you
// can see with your own eyes) before trusting it the way scrape.mjs is
// trusted.
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
  return { since, until, force: args.force === "true", only: args.only || null };
}

async function loadPoliticians() {
  const raw = await readFile(path.join(ROOT, "config", "politicians.json"), "utf-8");
  return JSON.parse(raw);
}

function toUtcDateStr(instant) {
  return instant.toISOString().slice(0, 10);
}

async function scrapeSearchRange(page, handle, { start, end }) {
  // since:/until: only have day granularity, and X's exact UTC boundary
  // behaviour for them isn't something we can verify from here — pad a day
  // on each side and let extractTweets() below do the real, precise
  // [start, end) trim regardless of what the search net drags in.
  const sinceStr = toUtcDateStr(new Date(start.getTime() - 24 * 3600 * 1000));
  const untilStr = toUtcDateStr(new Date(end.getTime() + 24 * 3600 * 1000));
  const query = `from:${handle} since:${sinceStr} until:${untilStr} include:nativeretweets`;
  const url = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;

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
      // Search results don't surface pinned tweets the way a profile
      // timeline does, so every record's timestamp here is trustworthy for
      // the boundary check (no isPinnedRecord carve-out needed).
      if (rec.timestamp && new Date(rec.timestamp) < start) {
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
    // Step less than one full viewport so consecutive views overlap — X's
    // timeline is virtualized (only renders near the viewport), and a big
    // jump can land past content that hasn't finished loading yet, silently
    // skipping it for good since nothing re-checks that range later.
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7));
    await sleep(1400 + Math.random() * 1000);
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

function datesNeeded(politician, allDates, force) {
  if (force) return allDates;
  return allDates.filter((date) => {
    const existing = loadExistingDay(date);
    return existing?.politicians[politician.id]?.status !== "ok";
  });
}

async function main() {
  const { since, until, force, only } = parseArgs();
  console.log(`[backfill] window: ${since} to ${until} (inclusive, UK calendar days)`);

  let politicians = await loadPoliticians();
  if (only) {
    politicians = politicians.filter((p) => p.id === only || p.handle === only);
    if (politicians.length === 0) {
      console.error(`[backfill] --only=${only} matched no one in config/politicians.json`);
      process.exit(1);
    }
  }

  const allDates = enumerateDates(since, until);

  const browser = await chromium.launch({ headless: process.env.HEADFUL !== "1" });
  const context = await buildContext(browser);

  const perPolitician = {};

  for (const politician of politicians) {
    const needed = datesNeeded(politician, allDates, force);
    if (needed.length === 0) {
      console.log(`[backfill] ${politician.name}: every day in range is already ok, skipping`);
      continue;
    }

    const gapSince = needed[0];
    const gapUntil = needed[needed.length - 1];
    console.log(
      `[backfill] ${politician.name} (@${politician.handle}): ${needed.length}/${allDates.length} days needed, scraping ${gapSince}..${gapUntil}`,
    );
    const gapRange = {
      start: londonDateRangeUtc(gapSince).start,
      end: londonDateRangeUtc(gapUntil).end,
    };

    const page = await context.newPage();
    try {
      const tweets = await scrapeSearchRange(page, politician.handle, gapRange);
      perPolitician[politician.id] = { status: "ok", byDay: bucketByLondonDay(tweets) };
      console.log(`[ok] ${politician.name}: ${tweets.length} posts across the gap`);
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
  let written = 0;

  for (const date of allDates) {
    const dayRange = londonDateRangeUtc(date);
    const existing = loadExistingDay(date);
    const dayResult = existing ?? {
      date,
      scrapedAt: new Date().toISOString(),
      range: { start: dayRange.start.toISOString(), end: dayRange.end.toISOString() },
      politicians: {},
    };
    let changed = !existing;

    for (const politician of politicians) {
      const already = dayResult.politicians[politician.id];
      if (already?.status === "ok" && !force) continue;

      const outcome = perPolitician[politician.id];
      if (!outcome) continue; // this politician needed no scraping at all

      changed = true;
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

    if (!changed) continue;
    await writeFile(path.join(DATA_DIR, `${date}.json`), JSON.stringify(dayResult, null, 2));
    written++;
  }

  console.log(`[done] wrote/updated ${written} day files in ${DATA_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
