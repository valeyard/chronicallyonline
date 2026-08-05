export default function AboutPage() {
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">About</h1>
      <p className="text-[var(--color-text-secondary)]">
        This is a for-fun, public-interest project tracking how often UK political party leaders
        post on X (formerly Twitter). It is not affiliated with any party, candidate, or with X
        Corp.
      </p>
      <h2 className="text-lg font-medium mt-4">How it works</h2>
      <p className="text-[var(--color-text-secondary)]">
        Once a day, an automated script visits each tracked account&apos;s public X timeline and
        counts posts from the previous UK calendar day, split into original posts, retweets/
        reposts, and replies.
      </p>
      <h2 className="text-lg font-medium mt-4">Caveats</h2>
      <ul className="list-disc pl-5 text-[var(--color-text-secondary)] flex flex-col gap-1">
        <li>
          This relies on browser automation against X&apos;s public web interface rather than an
          official API, since read access is prohibitively expensive at the API&apos;s current
          pricing. Data can be incomplete on days X changes its page layout or the automation
          otherwise fails to load a page.
        </li>
        <li>
          Classification of retweet vs. reply vs. original post is done by pattern-matching the
          page&apos;s markup and can occasionally misclassify a post.
        </li>
        <li>Deleted posts and posts from accounts that go private will not appear.</li>
        <li>Times are bucketed by UK time (Europe/London), not each poster&apos;s local time.</li>
      </ul>
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
