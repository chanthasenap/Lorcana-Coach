import { signIn, signOut } from "@/auth";
import { getDashboardContext } from "@/lib/dashboard/context";
import { getTeamDashboardStats } from "@/lib/dashboard/stats";

function formatCategory(category: string): string {
  return category
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function ResultBadge({ result }: { result: "win" | "loss" | "draw" }) {
  const styles =
    result === "win"
      ? "bg-success/15 text-success"
      : result === "loss"
        ? "bg-danger/15 text-danger"
        : "bg-warn/15 text-warn";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles}`}>
      {result}
    </span>
  );
}

function SignOutForm() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit" className="text-sm text-muted hover:text-foreground transition-colors">
        Sign out
      </button>
    </form>
  );
}

export default async function DashboardPage() {
  const ctx = await getDashboardContext();

  if (ctx.state === "signed_out") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Team Dashboard</h1>
          <p className="mt-2 max-w-sm text-muted">
            Sign in with the same Discord account you use in your team&apos;s server.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="rounded-md bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:opacity-90 transition-opacity"
          >
            Sign in with Discord
          </button>
        </form>
      </main>
    );
  }

  if (ctx.state === "not_linked") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight">Not linked yet</h1>
          <p className="mt-2 text-muted">
            We don&apos;t see a player record for this Discord account yet. Run any command (like{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-sm">/help</code>) in your
            team&apos;s Discord server first - that&apos;s what creates your player profile - then refresh this
            page.
          </p>
        </div>
        <SignOutForm />
      </main>
    );
  }

  const stats = await getTeamDashboardStats(ctx.team.id);

  return (
    <main className="flex-1 px-6 py-10">
      <div className="mx-auto max-w-4xl flex flex-col gap-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{ctx.team.name}</h1>
            <p className="text-sm text-muted">
              {ctx.player.displayName} - {ctx.role}
            </p>
          </div>
          <SignOutForm />
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="text-sm text-muted">Team win rate</p>
            <p className="mt-1 text-3xl font-semibold">{stats.overall.winRatePct}%</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="text-sm text-muted">Games played</p>
            <p className="mt-1 text-3xl font-semibold">{stats.overall.total}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="text-sm text-muted">Record</p>
            <p className="mt-1 text-3xl font-semibold">
              {stats.overall.wins}-{stats.overall.losses}
              {stats.overall.draws > 0 ? `-${stats.overall.draws}` : ""}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Matchups</h2>
          {stats.matchupTable.length === 0 ? (
            <p className="text-sm text-muted">No matches recorded yet - use `/record` in Discord.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-raised text-muted text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Opponent</th>
                    <th className="px-4 py-2 font-medium">Record</th>
                    <th className="px-4 py-2 font-medium">Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.matchupTable.map((row) => (
                    <tr key={row.opponentLabel} className="border-t border-border bg-surface">
                      <td className="px-4 py-2">{row.opponentLabel}</td>
                      <td className="px-4 py-2 text-muted">
                        {row.wins}-{row.losses}
                        {row.draws > 0 ? `-${row.draws}` : ""}
                      </td>
                      <td className="px-4 py-2">
                        <span className={row.winRatePct < 45 ? "text-danger" : "text-foreground"}>
                          {row.winRatePct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Recent games</h2>
          {stats.recentMatches.length === 0 ? (
            <p className="text-sm text-muted">Nothing recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {stats.recentMatches.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{m.playerName}</span>{" "}
                    <span className="text-muted">
                      ({m.deckName}) vs {m.opponentLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted">{new Date(m.playedAt).toLocaleDateString()}</span>
                    <ResultBadge result={m.result} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Team knowledge base</h2>
          {stats.recentObservations.length === 0 ? (
            <p className="text-sm text-muted">No AI observations recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {stats.recentObservations.map((o) => (
                <li key={o.id} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                      {formatCategory(o.category)}
                    </span>
                    {o.matchupKey && <span className="text-xs text-muted">{o.matchupKey}</span>}
                  </div>
                  <p>{o.observation}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
