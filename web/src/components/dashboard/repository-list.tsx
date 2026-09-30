import { repositoryOverview } from '@/src/data/dashboard';

export function RepositoryList() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-50">Repository overview</h2>
        <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Summary</span>
      </div>

      <div className="space-y-3">
        {repositoryOverview.map((repository) => (
          <article
            key={repository.id}
            className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-medium text-slate-100">{repository.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{repository.language}</p>
              </div>
              <span className="text-xs text-slate-500">{repository.lastActivity}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-2">
                <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Issues
                </span>
                <span className="mt-2 block text-lg font-semibold text-slate-100">
                  {repository.openIssues}
                </span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-2">
                <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  PRs
                </span>
                <span className="mt-2 block text-lg font-semibold text-slate-100">
                  {repository.openPRs}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
