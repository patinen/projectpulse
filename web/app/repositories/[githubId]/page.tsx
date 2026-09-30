'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MetricTrendCard } from '@/src/components/analytics/metric-trend-card';
import { AppShell } from '@/src/components/layout/app-shell';
import { getRepositoryAnalytics, type RepositoryAnalyticsRange, type RepositoryAnalyticsResponse } from '@/src/lib/api';

const rangeOptions: RepositoryAnalyticsRange[] = ['7d', '30d', '90d'];

function formatDate(value: string | null): string {
  if (!value) {
    return 'No activity';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function RepositoryDetailPage() {
  const params = useParams<{ githubId: string }>();
  const githubId = decodeURIComponent(params.githubId);
  const [range, setRange] = useState<RepositoryAnalyticsRange>('30d');
  const [analytics, setAnalytics] = useState<RepositoryAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!githubId) {
      return;
    }

    const loadAnalytics = async () => {
      try {
        setError(null);
        setIsLoading(true);
        const response = await getRepositoryAnalytics(githubId, range);
        setAnalytics(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load repository analytics');
      } finally {
        setIsLoading(false);
      }
    };

    void loadAnalytics();
  }, [githubId, range]);

  const historyPoints = analytics?.history ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-neutral-400">
            <Link href="/repositories" className="hover:text-white">
              Repositories
            </Link>
            <span className="text-neutral-600">/</span>
            <span className="text-neutral-400">Detail</span>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-50">
                {analytics?.repository.fullName ?? 'Repository analytics'}
              </h1>
              <p className="mt-2 text-sm text-neutral-400">
                {analytics ? `Language: ${analytics.repository.language ?? 'Unknown'}` : 'Loading metrics...'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {analytics?.repository.fullName ? (
                <a
                  href={`https://github.com/${analytics.repository.fullName}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-200 hover:border-neutral-500 hover:text-white"
                >
                  GitHub
                </a>
              ) : null}
              <div className="inline-flex rounded-lg border border-neutral-700 bg-neutral-900 p-1">
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
          </div>
        </header>

        {isLoading ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-neutral-300">
            Loading repository metrics...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-neutral-600 bg-neutral-900 p-6 text-neutral-200">
            {error}
          </div>
        ) : analytics ? (
          <>
            {analytics.current ? (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Open issues</p>
                  <p className="mt-3 text-3xl font-semibold text-neutral-50">{analytics.current.openIssues}</p>
                  <p className="mt-2 text-xs text-neutral-400">Last snapshot: {formatDate(analytics.current.capturedAt)}</p>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Open pull requests</p>
                  <p className="mt-3 text-3xl font-semibold text-neutral-50">{analytics.current.openPullRequests}</p>
                  <p className="mt-2 text-xs text-neutral-400">Last snapshot: {formatDate(analytics.current.capturedAt)}</p>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Commits (7d)</p>
                  <p className="mt-3 text-3xl font-semibold text-neutral-50">{analytics.current.commits7d}</p>
                  <p className="mt-2 text-xs text-neutral-400">Last activity: {formatDate(analytics.current.lastActivityAt)}</p>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Last activity</p>
                  <p className="mt-3 text-xl font-semibold text-neutral-50">{formatDate(analytics.current.lastActivityAt)}</p>
                  <p className="mt-2 text-xs text-neutral-400">Latest stored update</p>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Last snapshot</p>
                  <p className="mt-3 text-xl font-semibold text-neutral-50">{formatDate(analytics.current.capturedAt)}</p>
                  <p className="mt-2 text-xs text-neutral-400">Range: {analytics.range.value}</p>
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6">
                <h2 className="text-xl font-semibold text-neutral-50">Waiting for the first snapshot.</h2>
                <p className="mt-3 text-sm text-neutral-400">
                  Metrics will appear after the background sync completes.
                </p>
              </section>
            )}

            {analytics.current ? (
              <section className="grid gap-4 xl:grid-cols-3">
                <MetricTrendCard
                  title="Open issues"
                  currentValue={analytics.current.openIssues}
                  history={historyPoints}
                  valueSelector={(point) => point.openIssues}
                />
                <MetricTrendCard
                  title="Open pull requests"
                  currentValue={analytics.current.openPullRequests}
                  history={historyPoints}
                  valueSelector={(point) => point.openPullRequests}
                />
                <MetricTrendCard
                  title="Commits (7d)"
                  currentValue={analytics.current.commits7d}
                  history={historyPoints}
                  valueSelector={(point) => point.commits7d}
                />
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
