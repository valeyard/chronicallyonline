import Link from "next/link";
import type { Politician } from "@/lib/types";
import { SERIES_COLOR } from "@/lib/palette";

interface Row {
  politician: Politician;
  total: number;
}

export function BarLeaderboard({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="flex flex-col gap-3" role="img" aria-label="Bar chart of total posts per politician, ranked highest to lowest">
      {rows.map((row, i) => {
        const widthPct = (row.total / max) * 100;
        return (
          <Link
            key={row.politician.id}
            href={`/politician/${row.politician.id}`}
            className="group flex items-center gap-3 text-sm"
          >
            <div className="w-5 shrink-0 text-right tabular-nums text-[var(--color-text-muted)]">
              {i + 1}
            </div>
            <div className="w-32 shrink-0 truncate text-[var(--color-text-primary)]">
              {row.politician.name}
            </div>
            <div className="flex-1 h-3 rounded-full bg-[var(--color-gridline)] overflow-hidden">
              <div
                className="series-fill h-full rounded-r-md group-hover:opacity-80 transition-opacity"
                style={
                  {
                    width: `${widthPct}%`,
                    "--c-light": SERIES_COLOR.light,
                    "--c-dark": SERIES_COLOR.dark,
                  } as React.CSSProperties
                }
                title={`${row.politician.name}: ${row.total} posts`}
              />
            </div>
            <div className="w-10 text-right tabular-nums text-[var(--color-text-secondary)]">
              {row.total}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
