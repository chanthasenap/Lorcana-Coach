import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Lorcana Coach</h1>
      <p className="max-w-md text-muted">
        Practice happens in Discord - run <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-sm">/practice</code> in
        your team&apos;s server to get started. This web app is for deeper team analysis.
      </p>
      <Link
        href="/dashboard"
        className="rounded-md bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:opacity-90 transition-opacity"
      >
        Open Dashboard
      </Link>
    </main>
  );
}
