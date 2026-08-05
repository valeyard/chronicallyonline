#!/usr/bin/env node
// X's login page blocks Playwright's automated browser (CAPTCHA/"unusual
// activity" wall), even though browsing an *already-authenticated* session
// works fine. Workaround: export cookies from your regular browser (where
// you're already logged into X) and convert them into storageState.json.
//
// 1. Install a cookie-export extension in your normal browser, e.g.
//    "Cookie-Editor" (Chrome/Firefox/Edge).
// 2. Go to x.com while logged in, open the extension, Export > "Export as
//    JSON", save it to a file.
// 3. node scraper/cookiesToStorageState.mjs path/to/exported-cookies.json
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SAME_SITE_MAP = {
  no_restriction: "None",
  unspecified: "Lax",
  lax: "Lax",
  strict: "Strict",
  none: "None",
};

const [, , inputPath] = process.argv;
if (!inputPath) {
  console.error("Usage: node scraper/cookiesToStorageState.mjs <cookie-export.json>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(inputPath, "utf-8"));
if (!Array.isArray(raw)) {
  console.error("Expected a JSON array of cookies (Cookie-Editor's export format).");
  process.exit(1);
}

const cookies = raw
  .filter((c) => /(^|\.)(x|twitter)\.com$/.test(c.domain.replace(/^\./, "")))
  .map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || "/",
    expires: c.session ? -1 : Math.round(c.expirationDate ?? -1),
    httpOnly: Boolean(c.httpOnly),
    secure: Boolean(c.secure),
    sameSite: SAME_SITE_MAP[(c.sameSite || "unspecified").toLowerCase()] || "Lax",
  }));

if (cookies.length === 0) {
  console.error("No x.com/twitter.com cookies found in that export — did you export while on x.com?");
  process.exit(1);
}
if (!cookies.some((c) => c.name === "auth_token")) {
  console.warn("[warn] no 'auth_token' cookie found — this session may not actually be logged in.");
}

const outPath = path.join(process.cwd(), "storageState.json");
writeFileSync(outPath, JSON.stringify({ cookies, origins: [] }, null, 2));
console.log(`Wrote ${outPath} with ${cookies.length} cookies.`);
console.log("Next: base64-encode it for the AUTH_STORAGE_STATE_B64 secret:");
console.log(`  node -e "console.log(require('fs').readFileSync('storageState.json').toString('base64'))"`);
