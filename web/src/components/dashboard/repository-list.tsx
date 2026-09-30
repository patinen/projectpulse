import type { DashboardRepositorySummary } from '@/src/lib/api';

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return 'No activity';
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function RepositoryList({ repositories }: { repositories: DashboardRepositorySummary[] }) {
  if (repositories.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-50">Repository overview</h2>
          <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Summary</span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
          No tracked repositories yet.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-50">Repository overview</h2>
        <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Summary</span>
      </div>

      <div className="space-y-3">
        {repositories.map((repository) => (
          <article
            key={repository.githubId}
            className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <a
                  href={`https://github.com/${repository.fullName}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-base font-medium text-slate-100 hover:text-sky-300"
                >
                  {repository.fullName}
                </a>
                <p className="mt-1 text-xs text-slate-500">{repository.language ?? 'Unknown language'}</p>
              </div>
              <span className="text-xs text-slate-500">{formatRelativeTime(repository.lastActivityAt)}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-2">
                <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">Issues</span>
                <span className="mt-2 block text-lg font-semibold text-slate-100">{repository.openIssues}</span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-2">
                <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">PRs</span>
                <span className="mt-2 block text-lg font-semibold text-slate-100">{repository.openPullRequests}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>Commits (7d): {repository.commits7d}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
