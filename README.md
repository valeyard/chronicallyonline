# Chronically Online

A for-fun, public-interest tracker of how often UK political party leaders post on X (formerly
Twitter): posts, retweets, and replies, broken down per day.

Not affiliated with any party, candidate, or with X Corp.

## How it works

- `config/politicians.json` — the tracked accounts.
- `scraper/scrape.mjs` — runs once a day (via GitHub Actions), visits each account's X timeline,
  and counts yesterday's posts by type. Writes `data/YYYY-MM-DD.json`.
- `scraper/backfill.mjs` — one-time historical backfill over a wider date range (see below).
- The Next.js site (`src/`) reads everything from `data/*.json` at build time and is exported as
  a static site, deployed to GitHub Pages.

There is no database and no server — the "backend" is a scheduled scrape that commits JSON into
the repo, and a static site rebuilt on every new commit.

## Why scraping instead of the X API

X's read API is no longer free at any meaningful scale (Basic tier is roughly $200/month for
15k reads/month), which doesn't make sense for a hobby project. Instead, this scrapes X's public
web timeline with a headless browser (Playwright).

**Caveats that come with that trade-off:**
- X requires a logged-in session to view timelines now, so the scraper needs real session cookies
  (see setup below). Use a dedicated/burner X account, not your main one.
- This is automation against X's web interface, which is in tension with X's Terms of Service.
  The risk is low for a low-frequency (once/day), low-volume (6 accounts) hobby project reading
  already-public posts from public figures, but it isn't zero — the account used could get
  rate-limited or locked.
- The scraper depends on X's current page markup (`data-testid` attributes etc.). If X changes
  its site, the scraper will likely need small fixes.

## Setup

### 1. Get a session for the scraper

You need a logged-in X session for the scraper to use. Locally:

```bash
npm install
npm run scrape:login
```

This opens a real browser window — log in with your (ideally burner) X account, then press Enter
in the terminal. It saves `storageState.json` (already gitignored — never commit it, it's
equivalent to a password).

Then base64-encode it and add it as a GitHub Actions secret named `AUTH_STORAGE_STATE_B64`:

```bash
base64 -w0 storageState.json   # macOS: base64 -i storageState.json
```

Repo → Settings → Secrets and variables → Actions → New repository secret.

### 2. Enable GitHub Pages

Repo → Settings → Pages → Source → "GitHub Actions".

### 3. Let it run

`daily-scrape.yml` runs once a day (05:00 UTC), scrapes yesterday, commits the new data file, and
redeploys the site. `deploy.yml` redeploys on any push to `main` (e.g. code changes) without
scraping. Both can also be triggered manually from the Actions tab.

## Running a historical backfill

The daily scrape only ever covers "yesterday". To backfill history, run (locally, not in CI —
give it your attention in case X blocks it partway through):

```bash
npm run scrape:backfill -- --days=14
# or a specific window:
npm run scrape:backfill -- --since=2026-07-01 --until=2026-07-31
```

This needs the same `AUTH_STORAGE_STATE_B64`/`storageState.json` session. It scrolls each
account's timeline much further back than the daily job does, so it's slower and a bit riskier
(X has historically throttled accounts that scroll heavily in one session) — start with a couple
of weeks, check the data looks right, then go further back in separate runs if you want more.
It won't overwrite a day that already has good data unless you pass `--force`.

Commit and push the resulting `data/*.json` files yourself; `deploy.yml` will pick them up.

## Adding more people to track

Add an entry to `config/politicians.json`:

```json
{
  "id": "kebab-case-id",
  "name": "Display Name",
  "role": "Their role",
  "party": "Party name",
  "handle": "their_x_handle"
}
```

## Local development

```bash
npm install
npm run dev       # http://localhost:3000, reads whatever is in data/
npm run build     # static export to ./out
npm run scrape     # scrape yesterday (needs AUTH_STORAGE_STATE_B64 or a local storageState.json — see setup)
```
