import Link from "next/link";
import { getAvailableWeeks, getDaysInWeek } from "@/lib/data";
import { getPoliticians } from "@/lib/politicians";
import { aggregateRows, aggregateDailyTotals, addDaysToDateStr } from "@/lib/period";
import { PeriodLeaderboard } from "@/components/PeriodLeaderboard";
import { TrendBars } from "@/components/TrendBars";
import { SERIES_COLOR } from "@/lib/palette";

export default function WeekPage() {
  const weeks = getAvailableWeeks();
  const politicians = getPoliticians();

  if (weeks.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--color-card-surface)] p-8 text-center">
        <h1 className="text-xl font-semibold">No data yet</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Once the daily scrape has run for a few days, this week&apos;s leaderboard will show up
          here.
        </p>
      </div>
    );
  }

  const [latest, ...rest] = weeks;
  const days = getDaysInWeek(latest);
  const rows = aggregateRows(days, politicians);
  const dailyTotals = aggregateDailyTotals(days);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">This week&apos;s leaderboard</h1>
        <p className="text-[var(--color-text-secondary)]">
          {latest} to {addDaysToDateStr(latest, 6)} &middot; UK party leaders on X
        </p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Daily activity (all tracked politicians combined)
        </h2>
        <TrendBars points={dailyTotals} color={SERIES_COLOR} />
      </div>

      <PeriodLeaderboard rows={rows} emptyLabel="No data yet for this week." />

      {rest.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Other weeks
          </h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {rest.slice(0, 12).map((weekStart) => (
              <Link
                key={weekStart}
                href={`/week/${weekStart}`}
                className="rounded-full border border-[var(--border)] px-3 py-1 hover:bg-[var(--color-card-surface)]"
              >
                {weekStart}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
