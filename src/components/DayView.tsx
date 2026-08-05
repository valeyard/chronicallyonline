import type { DayData, Politician } from "@/lib/types";
import { PeriodLeaderboard } from "@/components/PeriodLeaderboard";

export function DayView({
  data,
  politicians,
}: {
  data: DayData;
  politicians: Politician[];
}) {
  const rows = politicians.map((p) => {
    const result = data.politicians[p.id];
    return {
      politician: p,
      status: result?.status ?? ("error" as const),
      counts: result?.counts ?? null,
    };
  });

  return (
    <PeriodLeaderboard
      rows={rows}
      emptyLabel={`The scrape for ${data.date} didn't return usable data for anyone.`}
    />
  );
}
