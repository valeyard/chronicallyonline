"use client";

import { useRef, useState } from "react";
import type { Politician } from "@/lib/types";
import { PARTY_COLOR } from "@/lib/palette";

interface Series {
  politician: Politician;
  values: (number | null)[];
}

const VIEW_W = 800;
const VIEW_H = 320;
const MARGIN = { top: 12, right: 16, bottom: 32, left: 36 };
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;

function niceMax(raw: number): number {
  if (raw <= 0) return 4;
  const step = raw <= 20 ? 5 : raw <= 100 ? 10 : 25;
  return Math.ceil((raw * 1.15) / step) * step;
}

function buildPath(values: (number | null)[], xAt: (i: number) => number, yAt: (v: number) => number) {
  let d = "";
  let drawing = false;
  values.forEach((v, i) => {
    if (v === null) {
      drawing = false;
      return;
    }
    d += `${drawing ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)} `;
    drawing = true;
  });
  return d.trim();
}

export function PartyTrendLines({ dates, series }: { dates: string[]; series: Series[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ index: number; xPx: number } | null>(null);

  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null))));
  const n = dates.length;
  const xAt = (i: number) => MARGIN.left + (n <= 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W);
  const yAt = (v: number) => MARGIN.top + PLOT_H * (1 - v / max);

  const yTicks = [0, max / 3, (2 * max) / 3, max];

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const xPx = e.clientX - rect.left;
    const frac = n <= 1 ? 0 : (xPx / rect.width - MARGIN.left / VIEW_W) / (PLOT_W / VIEW_W);
    const index = Math.min(n - 1, Math.max(0, Math.round(frac * (n - 1))));
    setHover({ index, xPx: xAt(index) * (rect.width / VIEW_W) });
  }

  const hoverRows = hover
    ? series
        .map((s) => ({ s, v: s.values[hover.index] }))
        .sort((a, b) => (b.v ?? -1) - (a.v ?? -1))
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="relative"
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Line chart of daily post totals per politician, colored by party"
        >
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={MARGIN.left}
                x2={VIEW_W - MARGIN.right}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="var(--color-gridline)"
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={yAt(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fill="var(--color-text-muted)"
              >
                {Math.round(t)}
              </text>
            </g>
          ))}

          {series.map(({ politician, values }) => {
            const color = PARTY_COLOR[politician.party] ?? { light: "#52514e", dark: "#c3c2b7" };
            const lastIdx = values.map((v) => v !== null).lastIndexOf(true);
            return (
              <g key={politician.id}>
                <path
                  d={buildPath(values, xAt, yAt)}
                  fill="none"
                  className="series-stroke"
                  style={{ "--c-light": color.light, "--c-dark": color.dark } as React.CSSProperties}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {lastIdx >= 0 && (
                  <circle
                    cx={xAt(lastIdx)}
                    cy={yAt(values[lastIdx] as number)}
                    r={4}
                    className="series-fill"
                    style={{ "--c-light": color.light, "--c-dark": color.dark } as React.CSSProperties}
                    stroke="var(--color-surface)"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}

          {hover && (
            <line
              x1={xAt(hover.index)}
              x2={xAt(hover.index)}
              y1={MARGIN.top}
              y2={VIEW_H - MARGIN.bottom}
              stroke="var(--color-text-muted)"
              strokeWidth={1}
            />
          )}
        </svg>

        {hover && (
          <div
            className="absolute top-2 z-10 min-w-40 rounded-md border border-[var(--border)] bg-[var(--color-card-surface)] p-2 text-xs shadow-md pointer-events-none"
            style={{
              left: hover.xPx,
              transform: hover.xPx > (containerRef.current?.clientWidth ?? VIEW_W) * 0.6 ? "translateX(-100%)" : "translateX(8px)",
            }}
          >
            <div className="font-medium text-[var(--color-text-primary)] mb-1">{dates[hover.index]}</div>
            {hoverRows.map(({ s, v }) => {
              const color = PARTY_COLOR[s.politician.party] ?? { light: "#52514e", dark: "#c3c2b7" };
              return (
                <div key={s.politician.id} className="flex items-center gap-1.5 py-0.5">
                  <span
                    className="series-border inline-block w-3 border-t-2"
                    style={{ "--c-light": color.light, "--c-dark": color.dark } as React.CSSProperties}
                  />
                  <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">
                    {v ?? "—"}
                  </span>
                  <span className="text-[var(--color-text-secondary)]">{s.politician.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--color-text-secondary)]">
        {series.map(({ politician }) => {
          const color = PARTY_COLOR[politician.party] ?? { light: "#52514e", dark: "#c3c2b7" };
          return (
            <div key={politician.id} className="flex items-center gap-1.5">
              <span
                className="series-border inline-block w-4 border-t-2"
                style={{ "--c-light": color.light, "--c-dark": color.dark } as React.CSSProperties}
              />
              <span>
                {politician.name} <span className="text-[var(--color-text-muted)]">({politician.party})</span>
              </span>
            </div>
          );
        })}
      </div>

      <details className="text-xs text-[var(--color-text-secondary)]">
        <summary className="cursor-pointer select-none">Show as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-1 pr-3 font-medium">Date</th>
                {series.map(({ politician }) => (
                  <th key={politician.id} className="text-right py-1 pl-3 font-medium whitespace-nowrap">
                    {politician.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date, i) => (
                <tr key={date} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-1 pr-3">{date}</td>
                  {series.map(({ politician, values }) => (
                    <td key={politician.id} className="text-right py-1 pl-3 tabular-nums">
                      {values[i] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
