#!/usr/bin/env node
// One-off helper: opens a real browser window so you can log into X by hand,
// then saves the session as storageState.json. Run this locally (not in CI).
// Use a dedicated/burner account, not your main one — see README.md.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "storageState.json");

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://x.com/login");

  console.log("Log in to X in the opened browser window.");
  console.log("Once you can see your home timeline, come back here and press Enter.");
  await new Promise((resolve) => {
    process.stdin.once("data", resolve);
  });

  await context.storageState({ path: OUT_PATH });
  console.log(`Saved session to ${OUT_PATH}`);
  console.log("Next: base64-encode it and store as the AUTH_STORAGE_STATE_B64 GitHub secret:");
  console.log(`  node -e "console.log(require('fs').readFileSync('storageState.json').toString('base64'))"`);
  console.log("Do NOT commit storageState.json — it is already in .gitignore.");

  await browser.close();
  process.exit(0);
}

main();
