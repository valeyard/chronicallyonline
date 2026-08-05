import Link from "next/link";
import { notFound } from "next/navigation";
import { getAvailableDates, getDayData } from "@/lib/data";
import { getPoliticians } from "@/lib/politicians";
import { DayView } from "@/components/DayView";

// `output: export` requires at least one static param, so fall back to a
// placeholder route before the first scrape has ever run.
export function generateStaticParams() {
  const dates = getAvailableDates();
  return dates.length > 0 ? dates.map((date) => ({ date })) : [{ date: "none" }];
}

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  if (date === "none" && getAvailableDates().length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--color-card-surface)] p-8 text-center">
        <h1 className="text-xl font-semibold">No data yet</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          The daily scrape hasn&apos;t run yet.
        </p>
      </div>
    );
  }

  const data = getDayData(date);
  if (!data) notFound();

  const politicians = getPoliticians();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link href="/" className="text-sm text-[var(--color-text-secondary)] hover:underline">
          &larr; Latest day
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{date}</h1>
      </div>
      <DayView data={data} politicians={politicians} />
    </div>
  );
}
