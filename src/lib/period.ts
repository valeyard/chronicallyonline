import type { DayData, Politician, TweetCounts } from "./types";
import type { PeriodRow } from "@/components/PeriodLeaderboard";

export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Monday of the ISO week containing dateStr.
export function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDaysToDateStr(dateStr, diffToMonday);
}

export function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function aggregateRows(days: DayData[], politicians: Politician[]): PeriodRow[] {
  return politicians.map((p) => {
    const totals: TweetCounts = { original: 0, retweet: 0, reply: 0, total: 0 };
    let anyOk = false;
    for (const day of days) {
      const result = day.politicians[p.id];
      if (result?.status === "ok" && result.counts) {
        anyOk = true;
        totals.original += result.counts.original;
        totals.retweet += result.counts.retweet;
        totals.reply += result.counts.reply;
        totals.total += result.counts.total;
      }
    }
    return { politician: p, status: anyOk ? "ok" : "error", counts: anyOk ? totals : null };
  });
}

export function aggregateDailyTotals(days: DayData[]): { date: string; total: number }[] {
  return [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      let total = 0;
      for (const result of Object.values(day.politicians)) {
        if (result.status === "ok" && result.counts) total += result.counts.total;
      }
      return { date: day.date, total };
    });
}
