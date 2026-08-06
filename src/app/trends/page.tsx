import { getAllDayData } from "@/lib/data";
import { getPoliticians } from "@/lib/politicians";
import { dailySeriesByPolitician } from "@/lib/period";
import { PartyTrendLines } from "@/components/PartyTrendLines";

export default function TrendsPage() {
  const politicians = getPoliticians();
  const days = getAllDayData();

  if (days.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--color-card-surface)] p-8 text-center">
        <h1 className="text-xl font-semibold">No data yet</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Once the daily scrape has run a few times, a trend line will show up here.
        </p>
      </div>
    );
  }

  const { dates, series } = dailySeriesByPolitician(days, politicians);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <p className="text-[var(--color-text-secondary)]">
          Daily posts per politician, {dates[0]} to {dates[dates.length - 1]}
        </p>
      </div>
      <PartyTrendLines dates={dates} series={series} />
    </div>
  );
}
