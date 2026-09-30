'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/src/components/layout/app-shell';
import { getActivity, type ActivityEvent, type ActivityKindFilter, type ActivityRange, type ActivityResponse } from '@/src/lib/api';

const rangeOptions: ActivityRange[] = ['7d', '30d', '90d'];
const kindOptions: Array<{ value: ActivityKindFilter; label: string }> = [
  { value: 'all', label: 'All activity' },
  { value: 'commit', label: 'Commits' },
  { value: 'issue', label: 'Issues' },
  { value: 'pr', label: 'Merged PRs' },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function describeKind(kind: ActivityEvent['kind']): string {
  if (kind === 'commit pushed') {
    return 'Commit';
  }

  if (kind === 'issue opened') {
    return 'Issue';
  }

  return 'Pull request';
}

export default function ActivityPage() {
  const [range, setRange] = useState<ActivityRange>('30d');
  const [kind, setKind] = useState<ActivityKindFilter>('all');
  const [repository, setRepository] = useState<string>('all');
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        setError(null);
        setIsLoading(true);
        const response = await getActivity({ range, kind, repository: repository === 'all' ? null : repository });
        setActivity(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load activity');
      } finally {
        setIsLoading(false);
      }
    };

    void loadActivity();
  }, [range, kind, repository]);

  const repositories = useMemo(() => activity?.repositories ?? [], [activity]);
  const events = useMemo(() => activity?.events ?? [], [activity]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-sky-400">History</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Activity</h1>
          <p className="max-w-2xl text-sm text-slate-400">
            A historical feed built from persisted dashboard snapshots — never from live GitHub reads.
          </p>
          <p className="text-xs text-slate-500">Snapshot-derived history may not contain every GitHub event.</p>
        </header>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Range</p>
                <div className="mt-2 inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1">
                  {rangeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRange(option)}
                      className={`rounded-md px-3 py-1.5 text-sm transition ${
                        range === option
                          ? 'bg-sky-500 text-slate-950'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Type</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {kindOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setKind(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        kind === option.value
                          ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                          : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-slate-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-w-0 lg:w-72">
              <label htmlFor="repository-filter" className="block text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Repository
              </label>
              <select
                id="repository-filter"
                value={repository}
                onChange={(event) => setRepository(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-0 transition focus:border-sky-500"
              >
                <option value="all">All repositories</option>
                {repositories.map((repo) => (
                  <option key={repo.fullName} value={repo.fullName}>
                    {repo.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
            Loading activity...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">{error}</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              <span>
                {activity?.meta.eventCount ?? 0} events in view
              </span>
              {activity?.meta.latestSnapshotAt ? (
                <span className="text-slate-400">Latest snapshot: {formatDate(activity.meta.latestSnapshotAt)}</span>
              ) : (
                <span className="text-slate-500">No snapshots yet</span>
              )}
            </div>

            {activity?.meta.latestSnapshotAt === null ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-300">
                No activity snapshots are available for this period yet.
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-300">
                No activity matches the selected filters.
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const repositoryMetadata = repositories.find((repo) => repo.fullName === event.repository);

                  return (
                    <article
                      key={event.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-slate-700"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-sky-300">
                              {describeKind(event.kind)}
                            </span>
                            {repositoryMetadata && repositoryMetadata.tracked && repositoryMetadata.githubId ? (
                              <Link
                                href={`/repositories/${repositoryMetadata.githubId}`}
                                className="text-xs uppercase tracking-[0.18em] text-sky-300 hover:text-sky-200"
                              >
                                {event.repository}
                              </Link>
                            ) : (
                              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{event.repository}</span>
                            )}
                          </div>

                          <a
                            href={event.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 block text-lg font-medium text-slate-50 hover:text-sky-300"
                          >
                            {event.title}
                          </a>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                            <span>{event.actor ?? 'Unknown actor'}</span>
                            <span>•</span>
                            <span>{formatDate(event.occurredAt)}</span>
                          </div>
                        </div>

                        <a
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-white"
                        >
                          Open
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
