export default function AboutPage() {
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">About</h1>
      <p className="text-[var(--color-text-secondary)]">
        This is a for-fun, public-interest project tracking how often UK political party leaders
        post on X (formerly Twitter). It is not affiliated with any party, candidate, or with X
        Corp.
      </p>
      <h2 className="text-lg font-medium mt-4">Who&apos;s tracked</h2>
      <p className="text-[var(--color-text-secondary)]">
        Currently the leaders of the main UK parties represented in the House of Commons. See{" "}
        <code className="text-xs bg-[var(--color-card-surface)] px-1 py-0.5 rounded">
          config/politicians.json
        </code>{" "}
        in the source repository for the exact list.
      </p>
    </div>
  );
}
