'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/src/components/layout/app-shell';
import {
  getRepositoryAnalytics,
  type RepositoryAnalyticsPoint,
  type RepositoryAnalyticsRange,
  type RepositoryAnalyticsResponse,
} from '@/src/lib/api';

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

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
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

  const maxCommits = useMemo(() => {
    if (!analytics || analytics.history.length === 0) {
      return 1;
    }

    return Math.max(...analytics.history.map((point) => point.commits7d), 1);
  }, [analytics]);

  const historyPoints = analytics?.history ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sky-400">
            <Link href="/repositories" className="hover:text-sky-300">
              Repositories
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">Detail</span>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
                {analytics?.repository.fullName ?? 'Repository analytics'}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {analytics ? `Language: ${analytics.repository.language ?? 'Unknown'}` : 'Loading metrics...'}
              </p>
            </div>

            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1">
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
        </header>

        {isLoading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
            Loading repository metrics...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
            {error}
          </div>
        ) : analytics ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Open issues</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">{analytics.current?.openIssues ?? 0}</p>
                <p className="mt-2 text-xs text-slate-400">Last snapshot: {formatDate(analytics.current?.capturedAt ?? null)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Open PRs</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">{analytics.current?.openPullRequests ?? 0}</p>
                <p className="mt-2 text-xs text-slate-400">Last snapshot: {formatDate(analytics.current?.capturedAt ?? null)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Commits (7d)</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">{analytics.current?.commits7d ?? 0}</p>
                <p className="mt-2 text-xs text-slate-400">Last activity: {formatDate(analytics.current?.lastActivityAt ?? null)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Range</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">{analytics.range.value}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {formatShortDate(analytics.range.from)} → {formatShortDate(analytics.range.to)}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-50">Commits trend</h2>
                <span className="text-xs text-slate-500">{historyPoints.length} daily snapshots</span>
              </div>

              {historyPoints.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                  No historical snapshots are available for this repository yet.
                </div>
              ) : (
                <div className="flex h-40 items-end gap-2 overflow-x-auto pb-2">
                  {historyPoints.map((point: RepositoryAnalyticsPoint) => {
                    const ratio = Math.max(0.15, point.commits7d / maxCommits);
                    return (
                      <div key={`${point.capturedAt}-${point.commits7d}`} className="flex min-w-[40px] flex-1 flex-col items-center gap-2">
                        <span className="text-[10px] text-slate-500">{point.commits7d}</span>
                        <div className="w-full rounded-t-md bg-sky-500/80" style={{ height: `${Math.max(16, ratio * 100)}%` }} />
                        <span className="text-[10px] text-slate-500">{formatShortDate(point.capturedAt)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
