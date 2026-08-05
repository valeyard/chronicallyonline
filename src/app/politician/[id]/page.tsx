import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllDayData } from "@/lib/data";
import { getPoliticians } from "@/lib/politicians";
import { SERIES_COLOR } from "@/lib/palette";
import { StatTile } from "@/components/StatTile";
import { TrendBars } from "@/components/TrendBars";

export function generateStaticParams() {
  return getPoliticians().map((p) => ({ id: p.id }));
}

export default async function PoliticianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const politician = getPoliticians().find((p) => p.id === id);
  if (!politician) notFound();

  const days = getAllDayData()
    .map((d) => ({ date: d.date, result: d.politicians[id] }))
    .filter((d) => d.result && d.result.status === "ok" && d.result.counts)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (days.length === 0) {
    return (
      <div>
        <Link href="/" className="text-sm text-[var(--color-text-secondary)] hover:underline">
          &larr; Leaderboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{politician.name}</h1>
        <p className="mt-4 text-[var(--color-text-secondary)]">No data yet.</p>
      </div>
    );
  }

  const totals = days.map((d) => d.result!.counts!.total);
  const totalPosts = totals.reduce((a, b) => a + b, 0);
  const avgPerDay = totalPosts / days.length;
  const busiest = [...days].sort((a, b) => b.result!.counts!.total - a.result!.counts!.total)[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/" className="text-sm text-[var(--color-text-secondary)] hover:underline">
          &larr; Leaderboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{politician.name}</h1>
        <p className="text-[var(--color-text-secondary)]">
          {politician.role} &middot; @{politician.handle}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile label="Days tracked" value={String(days.length)} />
        <StatTile label="Avg posts / day" value={avgPerDay.toFixed(1)} />
        <StatTile label="Busiest day" value={String(busiest.result!.counts!.total)} sublabel={busiest.date} />
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Posts per day
        </h2>
        <TrendBars
          points={days.map((d) => ({ date: d.date, total: d.result!.counts!.total }))}
          color={SERIES_COLOR}
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Daily detail
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--border)]">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium text-right">Original</th>
                <th className="py-2 pr-3 font-medium text-right">Retweets</th>
                <th className="py-2 pr-3 font-medium text-right">Replies</th>
                <th className="py-2 pr-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.date} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">
                    <Link href={`/day/${d.date}`} className="hover:underline">
                      {d.date}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{d.result!.counts!.original}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{d.result!.counts!.retweet}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{d.result!.counts!.reply}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-medium">
                    {d.result!.counts!.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
