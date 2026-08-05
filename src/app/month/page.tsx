import Link from "next/link";
import { getAvailableMonths, getDaysInMonth } from "@/lib/data";
import { getPoliticians } from "@/lib/politicians";
import { aggregateRows, aggregateDailyTotals, monthLabel } from "@/lib/period";
import { PeriodLeaderboard } from "@/components/PeriodLeaderboard";
import { TrendBars } from "@/components/TrendBars";
import { SERIES_COLOR } from "@/lib/palette";

export default function MonthPage() {
  const months = getAvailableMonths();
  const politicians = getPoliticians();

  if (months.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--color-card-surface)] p-8 text-center">
        <h1 className="text-xl font-semibold">No data yet</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Once the daily scrape has run for a while, this month&apos;s leaderboard will show up
          here.
        </p>
      </div>
    );
  }

  const [latest, ...rest] = months;
  const days = getDaysInMonth(latest);
  const rows = aggregateRows(days, politicians);
  const dailyTotals = aggregateDailyTotals(days);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">This month&apos;s leaderboard</h1>
        <p className="text-[var(--color-text-secondary)]">
          {monthLabel(latest)} &middot; UK party leaders on X
        </p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Daily activity (all tracked politicians combined)
        </h2>
        <TrendBars points={dailyTotals} color={SERIES_COLOR} />
      </div>

      <PeriodLeaderboard rows={rows} emptyLabel="No data yet for this month." />

      {rest.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Other months
          </h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {rest.slice(0, 12).map((month) => (
              <Link
                key={month}
                href={`/month/${month}`}
                className="rounded-full border border-[var(--border)] px-3 py-1 hover:bg-[var(--color-card-surface)]"
              >
                {monthLabel(month)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
