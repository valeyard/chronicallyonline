import Link from "next/link";
import type { Politician, TweetCounts } from "@/lib/types";

interface Row {
  politician: Politician;
  counts: TweetCounts | null;
  status: "ok" | "error";
}

export function BreakdownTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--border)]">
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Politician</th>
            <th className="py-2 pr-3 font-medium">Party</th>
            <th className="py-2 pr-3 font-medium text-right">Original</th>
            <th className="py-2 pr-3 font-medium text-right">Retweets</th>
            <th className="py-2 pr-3 font-medium text-right">Replies</th>
            <th className="py-2 pr-3 font-medium text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.politician.id} className="border-b border-[var(--border)]">
              <td className="py-2 pr-3 tabular-nums text-[var(--color-text-muted)]">{i + 1}</td>
              <td className="py-2 pr-3">
                <Link href={`/politician/${row.politician.id}`} className="hover:underline">
                  {row.politician.name}
                </Link>
              </td>
              <td className="py-2 pr-3 text-[var(--color-text-secondary)]">
                {row.politician.party}
              </td>
              {row.status === "ok" && row.counts ? (
                <>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.counts.original}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.counts.retweet}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.counts.reply}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-medium">
                    {row.counts.total}
                  </td>
                </>
              ) : (
                <td colSpan={4} className="py-2 pr-3 text-right text-[var(--color-text-muted)]">
                  no data
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
