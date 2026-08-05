#!/usr/bin/env node
// Lighter-weight alternative to cookiesToStorageState.mjs — skips the
// cookie-export extension. Grab just two values from your regular,
// already-logged-in browser (DevTools → Application → Cookies → x.com):
// `auth_token` and `ct0`. Those are the only cookies the scraper actually
// needs: auth_token authenticates the session, ct0 is the CSRF token the
// page's own JS sends as a header on the internal API calls that load the
// timeline — without it, requests get rejected even though you look logged in.
//
//   node scraper/manualAuth.mjs <auth_token> <ct0>
import { writeFileSync } from "node:fs";
import path from "node:path";

const [, , authToken, ct0] = process.argv;
if (!authToken || !ct0) {
  console.error("Usage: node scraper/manualAuth.mjs <auth_token> <ct0>");
  console.error("Get both values from DevTools > Application > Cookies > https://x.com");
  process.exit(1);
}

// Declared expiry is just so Playwright doesn't treat the cookie as already
// expired locally — X still enforces the real session lifetime server-side.
const oneYearFromNow = Math.round(Date.now() / 1000) + 365 * 24 * 3600;

const cookies = [
  {
    name: "auth_token",
    value: authToken,
    domain: ".x.com",
    path: "/",
    expires: oneYearFromNow,
    httpOnly: true,
    secure: true,
    sameSite: "None",
  },
  {
    name: "ct0",
    value: ct0,
    domain: ".x.com",
    path: "/",
    expires: oneYearFromNow,
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
  },
];

const outPath = path.join(process.cwd(), "storageState.json");
writeFileSync(outPath, JSON.stringify({ cookies, origins: [] }, null, 2));
console.log(`Wrote ${outPath}`);
console.log("Next: base64-encode it for the AUTH_STORAGE_STATE_B64 secret:");
console.log("  base64 -w0 storageState.json   (macOS: base64 -i storageState.json)");
