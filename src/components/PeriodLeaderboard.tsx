import type { Politician, TweetCounts } from "@/lib/types";
import { StatTile } from "@/components/StatTile";
import { BarLeaderboard } from "@/components/BarLeaderboard";
import { BreakdownTable } from "@/components/BreakdownTable";

export interface PeriodRow {
  politician: Politician;
  status: "ok" | "error";
  counts: TweetCounts | null;
}

export function PeriodLeaderboard({ rows, emptyLabel }: { rows: PeriodRow[]; emptyLabel: string }) {
  const okRows = rows.filter((r) => r.status === "ok" && r.counts);

  if (okRows.length === 0) {
    return <p className="text-[var(--color-text-secondary)]">{emptyLabel}</p>;
  }

  const sortedByTotal = [...okRows].sort((a, b) => b.counts!.total - a.counts!.total);
  const mostRetweets = [...okRows].sort((a, b) => b.counts!.retweet - a.counts!.retweet)[0];
  const mostReplies = [...okRows].sort((a, b) => b.counts!.reply - a.counts!.reply)[0];
  const quietest = sortedByTotal[sortedByTotal.length - 1];
  const erroredNames = rows.filter((r) => r.status === "error").map((r) => r.politician.name);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Most posts"
          value={String(sortedByTotal[0].counts!.total)}
          sublabel={sortedByTotal[0].politician.name}
        />
        <StatTile
          label="Most retweets"
          value={String(mostRetweets.counts!.retweet)}
          sublabel={mostRetweets.politician.name}
        />
        <StatTile
          label="Most replies"
          value={String(mostReplies.counts!.reply)}
          sublabel={mostReplies.politician.name}
        />
        <StatTile
          label="Quietest"
          value={String(quietest.counts!.total)}
          sublabel={quietest.politician.name}
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Total posts (originals + retweets + replies)
        </h2>
        <BarLeaderboard
          rows={sortedByTotal.map((r) => ({ politician: r.politician, total: r.counts!.total }))}
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Full breakdown
        </h2>
        <BreakdownTable rows={sortedByTotal} />
      </div>

      {erroredNames.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">
          No data for: {erroredNames.join(", ")}
        </p>
      )}
    </>
  );
}
