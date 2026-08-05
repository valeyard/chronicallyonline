import Link from "next/link";
import { notFound } from "next/navigation";
import { getAvailableMonths, getDaysInMonth } from "@/lib/data";
import { getPoliticians } from "@/lib/politicians";
import { aggregateRows, aggregateDailyTotals, monthLabel } from "@/lib/period";
import { PeriodLeaderboard } from "@/components/PeriodLeaderboard";
import { TrendBars } from "@/components/TrendBars";
import { SERIES_COLOR } from "@/lib/palette";

// `output: export` requires at least one static param, so fall back to a
// placeholder route before the first scrape has ever run.
export function generateStaticParams() {
  const months = getAvailableMonths();
  return months.length > 0 ? months.map((month) => ({ month })) : [{ month: "none" }];
}

export default async function MonthDetailPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;

  if (month === "none" && getAvailableMonths().length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--color-card-surface)] p-8 text-center">
        <h1 className="text-xl font-semibold">No data yet</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          The daily scrape hasn&apos;t run yet.
        </p>
      </div>
    );
  }

  const days = getDaysInMonth(month);
  if (days.length === 0) notFound();

  const politicians = getPoliticians();
  const rows = aggregateRows(days, politicians);
  const dailyTotals = aggregateDailyTotals(days);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link href="/month" className="text-sm text-[var(--color-text-secondary)] hover:underline">
          &larr; Latest month
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{monthLabel(month)}</h1>
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Daily activity (all tracked politicians combined)
        </h2>
        <TrendBars points={dailyTotals} color={SERIES_COLOR} />
      </div>

      <PeriodLeaderboard rows={rows} emptyLabel="No data yet for this month." />
    </div>
  );
}
