import { readFileSync } from "node:fs";
import path from "node:path";
import type { Politician } from "./types";

export function getPoliticians(): Politician[] {
  const raw = readFileSync(path.join(process.cwd(), "config", "politicians.json"), "utf-8");
  return JSON.parse(raw);
}
