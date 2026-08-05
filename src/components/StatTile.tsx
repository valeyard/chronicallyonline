export function StatTile({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--color-card-surface)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sublabel && (
        <div className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{sublabel}</div>
      )}
    </div>
  );
}
