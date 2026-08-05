import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chronically Online",
  description: "How much do UK party leaders post on X, per day?",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-[var(--border)]">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              Chronically Online
            </Link>
            <nav className="flex gap-4 text-sm text-[var(--color-text-secondary)]">
              <Link href="/" className="hover:text-[var(--color-text-primary)]">
                Leaderboard
              </Link>
              <Link href="/about" className="hover:text-[var(--color-text-primary)]">
                About
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">{children}</main>
        <footer className="border-t border-[var(--border)] text-xs text-[var(--color-text-muted)]">
          <div className="max-w-4xl mx-auto px-4 py-6">
            Unofficial, for-fun tracker built from publicly visible X activity. Not affiliated
            with any party or with X Corp.
          </div>
        </footer>
      </body>
    </html>
  );
}
