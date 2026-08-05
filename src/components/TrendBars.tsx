"use client";

interface Point {
  date: string;
  total: number;
}

export function TrendBars({
  points,
  color,
}: {
  points: Point[];
  color: { light: string; dark: string };
}) {
  const max = Math.max(1, ...points.map((p) => p.total));

  return (
    <div
      className="flex items-end gap-1 h-40 overflow-x-auto pb-1"
      role="img"
      aria-label="Bar chart of daily post totals over time"
    >
      {points.map((p) => (
        <div key={p.date} className="flex flex-col items-center justify-end h-full shrink-0">
          <div
            className="series-fill w-3 rounded-t-sm"
            style={
              {
                height: `${Math.max(2, (p.total / max) * 100)}%`,
                "--c-light": color.light,
                "--c-dark": color.dark,
              } as React.CSSProperties
            }
            title={`${p.date}: ${p.total} posts`}
          />
        </div>
      ))}
    </div>
  );
}
