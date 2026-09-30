import { recentActivity } from '@/src/data/dashboard';

const toneMap = {
  'pull request merged': 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20',
  'issue opened': 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20',
  'commit pushed': 'bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/20',
} as const;

export function ActivityList() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-50">Recent activity</h2>
        <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Live feed</span>
      </div>

      <ul className="space-y-4">
        {recentActivity.map((event) => (
          <li
            key={event.id}
            className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
          >
            <span
              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${toneMap[event.kind]}`}
            >
              {event.kind}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-slate-100">
                <span className="text-slate-500">{event.repo}</span> · {event.title}
              </p>
              <p className="text-xs text-slate-500">
                {event.actor} · {event.time}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
