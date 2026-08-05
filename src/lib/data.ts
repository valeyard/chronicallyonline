import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import type { DayData } from "./types";
import { mondayOf, monthKeyOf, addDaysToDateStr } from "./period";

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

export function getAvailableWeeks(): string[] {
  const weeks = new Set(getAvailableDates().map(mondayOf));
  return [...weeks].sort().reverse();
}

export function getDaysInWeek(weekStart: string): DayData[] {
  const weekEnd = addDaysToDateStr(weekStart, 6);
  return getAvailableDates()
    .filter((date) => date >= weekStart && date <= weekEnd)
    .map((date) => getDayData(date))
    .filter((d): d is DayData => d !== null);
}

export function getAvailableMonths(): string[] {
  const months = new Set(getAvailableDates().map(monthKeyOf));
  return [...months].sort().reverse();
}

export function getDaysInMonth(month: string): DayData[] {
  return getAvailableDates()
    .filter((date) => monthKeyOf(date) === month)
    .map((date) => getDayData(date))
    .filter((d): d is DayData => d !== null);
}
