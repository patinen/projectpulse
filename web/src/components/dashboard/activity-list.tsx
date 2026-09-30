import type { DashboardActivity } from '@/src/lib/api';

const toneMap = {
  'pull request merged': 'bg-neutral-200/10 text-neutral-100 ring-1 ring-inset ring-neutral-500/30',
  'issue opened': 'bg-neutral-700/40 text-neutral-100 ring-1 ring-inset ring-neutral-600/30',
  'commit pushed': 'bg-neutral-800/70 text-neutral-200 ring-1 ring-inset ring-neutral-600/40',
} as const;

function formatRelativeTime(value: string): string {
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

export function ActivityList({ events }: { events: DashboardActivity[] }) {
  if (events.length === 0) {
    return (
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-50">Recent activity</h2>
          <span className="text-xs uppercase tracking-[0.14em] text-neutral-500">Live feed</span>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
          No recent activity in the last tracked window.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-50">Recent activity</h2>
        <span className="text-xs uppercase tracking-[0.14em] text-neutral-500">Live feed</span>
      </div>

      <ul className="space-y-4">
        {events.map((event) => (
          <li
            key={event.id}
            className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-950/50 p-3"
          >
            <span
              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${toneMap[event.kind]}`}
            >
              {event.kind}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-neutral-100">
                <span className="text-neutral-500">{event.repository}</span> ·
                <a href={event.url} target="_blank" rel="noreferrer" className="hover:text-white">
                  {' '}{event.title}
                </a>
              </p>
              <p className="text-xs text-neutral-500">
                {event.actor ?? 'unknown'} · {formatRelativeTime(event.occurredAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
