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
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">History</p>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-50">Activity</h1>
          <p className="max-w-2xl text-sm text-neutral-400">
            A historical feed built from persisted dashboard snapshots — never from live GitHub reads.
          </p>
          <p className="text-xs text-neutral-500">Snapshot-derived history may not contain every GitHub event.</p>
        </header>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Range</p>
                <div className="mt-2 inline-flex rounded-lg border border-neutral-700 bg-neutral-950 p-1">
                  {rangeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRange(option)}
                      className={`rounded-md px-3 py-1.5 text-sm transition ${
                        range === option
                          ? 'bg-neutral-100 text-neutral-950'
                          : 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Type</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {kindOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setKind(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        kind === option.value
                          ? 'border-neutral-100 bg-neutral-100 text-neutral-950'
                          : 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-w-0 lg:w-72">
              <label htmlFor="repository-filter" className="block text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                Repository
              </label>
              <select
                id="repository-filter"
                value={repository}
                onChange={(event) => setRepository(event.target.value)}
                className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none ring-0 transition focus:border-neutral-400"
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
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-neutral-300">
            Loading activity...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-neutral-600 bg-neutral-900 p-6 text-neutral-200">{error}</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
              <span>
                {activity?.meta.eventCount ?? 0} events in view
              </span>
              {activity?.meta.latestSnapshotAt ? (
                <span className="text-neutral-400">Latest snapshot: {formatDate(activity.meta.latestSnapshotAt)}</span>
              ) : (
                <span className="text-neutral-500">No snapshots yet</span>
              )}
            </div>

            {activity?.meta.latestSnapshotAt === null ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-8 text-center text-neutral-300">
                No activity snapshots are available for this period yet.
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-8 text-center text-neutral-300">
                No activity matches the selected filters.
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const repositoryMetadata = repositories.find((repo) => repo.fullName === event.repository);

                  return (
                    <article
                      key={event.id}
                      className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 transition hover:border-neutral-700"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-neutral-600 bg-neutral-800/80 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-200">
                              {describeKind(event.kind)}
                            </span>
                            {repositoryMetadata && repositoryMetadata.tracked && repositoryMetadata.githubId ? (
                              <Link
                                href={`/repositories/${repositoryMetadata.githubId}`}
                                className="text-xs uppercase tracking-[0.18em] text-neutral-300 hover:text-white"
                              >
                                {event.repository}
                              </Link>
                            ) : (
                              <span className="text-xs uppercase tracking-[0.18em] text-neutral-500">{event.repository}</span>
                            )}
                          </div>

                          <a
                            href={event.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 block text-lg font-medium text-neutral-50 hover:text-white"
                          >
                            {event.title}
                          </a>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-400">
                            <span>{event.actor ?? 'Unknown actor'}</span>
                            <span>•</span>
                            <span>{formatDate(event.occurredAt)}</span>
                          </div>
                        </div>

                        <a
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-medium text-neutral-200 hover:border-neutral-500 hover:text-white"
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
