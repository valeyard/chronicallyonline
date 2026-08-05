import Link from "next/link";
import { notFound } from "next/navigation";
import { getAvailableWeeks, getDaysInWeek } from "@/lib/data";
import { getPoliticians } from "@/lib/politicians";
import { aggregateRows, aggregateDailyTotals, addDaysToDateStr } from "@/lib/period";
import { PeriodLeaderboard } from "@/components/PeriodLeaderboard";
import { TrendBars } from "@/components/TrendBars";
import { SERIES_COLOR } from "@/lib/palette";

// `output: export` requires at least one static param, so fall back to a
// placeholder route before the first scrape has ever run.
export function generateStaticParams() {
  const weeks = getAvailableWeeks();
  return weeks.length > 0 ? weeks.map((weekStart) => ({ weekStart })) : [{ weekStart: "none" }];
}

export default async function WeekDetailPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;

  if (weekStart === "none" && getAvailableWeeks().length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--color-card-surface)] p-8 text-center">
        <h1 className="text-xl font-semibold">No data yet</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          The daily scrape hasn&apos;t run yet.
        </p>
      </div>
    );
  }

  const days = getDaysInWeek(weekStart);
  if (days.length === 0) notFound();

  const politicians = getPoliticians();
  const rows = aggregateRows(days, politicians);
  const dailyTotals = aggregateDailyTotals(days);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link href="/week" className="text-sm text-[var(--color-text-secondary)] hover:underline">
          &larr; Latest week
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">
          {weekStart} to {addDaysToDateStr(weekStart, 6)}
        </h1>
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Daily activity (all tracked politicians combined)
        </h2>
        <TrendBars points={dailyTotals} color={SERIES_COLOR} />
      </div>

      <PeriodLeaderboard rows={rows} emptyLabel="No data yet for this week." />
    </div>
  );
}
