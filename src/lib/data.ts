import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import type { DayData } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

export function getAvailableDates(): string[] {
  if (!existsSync(DATA_DIR)) return [];
  return readdirSync(DATA_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort()
    .reverse();
}

export function getDayData(date: string): DayData | null {
  const filePath = path.join(DATA_DIR, `${date}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

export function getLatestDayData(): DayData | null {
  const [latest] = getAvailableDates();
  return latest ? getDayData(latest) : null;
}

export function getAllDayData(): DayData[] {
  return getAvailableDates()
    .map((date) => getDayData(date))
    .filter((d): d is DayData => d !== null);
}
