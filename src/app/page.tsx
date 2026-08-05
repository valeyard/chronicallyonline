import Link from "next/link";
import { getAvailableDates, getLatestDayData } from "@/lib/data";
import { getPoliticians } from "@/lib/politicians";
import { DayView } from "@/components/DayView";

export default function Home() {
  const politicians = getPoliticians();
  const latest = getLatestDayData();
  const dates = getAvailableDates();

  if (!latest) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--color-card-surface)] p-8 text-center">
        <h1 className="text-xl font-semibold">No data yet</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          The daily scrape hasn&apos;t run yet. Once it does, yesterday&apos;s leaderboard will
          show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Yesterday&apos;s leaderboard</h1>
        <p className="text-[var(--color-text-secondary)]">
          {latest.date} &middot; UK party leaders on X
        </p>
      </div>

      <DayView data={latest} politicians={politicians} />

      {dates.length > 1 && (
        <div>
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Other days
          </h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {dates.slice(1, 15).map((date) => (
              <Link
                key={date}
                href={`/day/${date}`}
                className="rounded-full border border-[var(--border)] px-3 py-1 hover:bg-[var(--color-card-surface)]"
              >
                {date}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
