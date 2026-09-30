'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ActivityList } from '@/src/components/dashboard/activity-list';
import { MetricCard } from '@/src/components/dashboard/metric-card';
import { RepositoryList } from '@/src/components/dashboard/repository-list';
import { AppShell } from '@/src/components/layout/app-shell';
import { getDashboard, type DashboardResponse } from '@/src/lib/api';
import type { DashboardMetric } from '@/src/data/dashboard';

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthenticated, setIsUnauthenticated] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        setIsUnauthenticated(false);
        const response = await getDashboard();
        setDashboard(response);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Unable to load dashboard';
        if (/session|valid/i.test(message)) {
          setIsUnauthenticated(true);
        } else {
          setError(message);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const metrics = useMemo<DashboardMetric[]>(() => {
    if (!dashboard) {
      return [];
    }

    return [
      {
        label: 'Open issues',
        value: String(dashboard.metrics.openIssues),
        detail: `Across ${dashboard.repositories.length} tracked repos`,
      },
      {
        label: 'Open pull requests',
        value: String(dashboard.metrics.openPullRequests),
        detail: `Across ${dashboard.repositories.length} tracked repos`,
      },
      {
        label: 'Commits (7d)',
        value: String(dashboard.metrics.commits7d),
        detail: 'Last 7 days',
      },
      {
        label: 'Active contributors',
        value: String(dashboard.metrics.activeContributors30d),
        detail: 'Last 30 days',
      },
    ];
  }, [dashboard]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const updatedLabel = useMemo(() => {
    if (!dashboard?.generatedAt || now === 0) {
      return 'Updated just now';
    }

    const date = new Date(dashboard.generatedAt);
    const diffMs = now - date.getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

    if (diffMinutes < 1) {
      return 'Updated just now';
    }

    if (diffMinutes < 60) {
      return `Updated ${diffMinutes}m ago`;
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
      return `Updated ${diffHours}h ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    return `Updated ${diffDays}d ago`;
  }, [dashboard, now]);

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
            Developer analytics
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl">
            Engineering overview
          </h1>
          <p className="max-w-2xl text-sm text-neutral-400 sm:text-base">
            Repository activity, pull requests, and engineering health for tracked GitHub repositories.
          </p>
          <p className="text-xs text-neutral-400">{updatedLabel}</p>
        </header>

        {isLoading ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-neutral-300">
            Loading dashboard...
          </div>
        ) : isUnauthenticated ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-neutral-200">
            GitHub must be connected to view the engineering dashboard.
          </div>
        ) : error ? (
          <div className="rounded-xl border border-neutral-600 bg-neutral-900 p-6 text-neutral-200">
            {error}
          </div>
        ) : dashboard && dashboard.repositories.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-8 text-center text-neutral-300">
            <p className="text-lg font-medium text-neutral-100">No repositories are being tracked yet.</p>
            <Link
              href="/repositories"
              className="mt-4 inline-flex items-center justify-center rounded-md border border-neutral-100 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-white"
            >
              Go to repositories
            </Link>
          </div>
        ) : dashboard ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <ActivityList events={dashboard.recentActivity} />
              <RepositoryList repositories={dashboard.repositories} />
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
