import { ActivityList } from '@/src/components/dashboard/activity-list';
import { MetricCard } from '@/src/components/dashboard/metric-card';
import { RepositoryList } from '@/src/components/dashboard/repository-list';
import { AppShell } from '@/src/components/layout/app-shell';
import { dashboardMetrics } from '@/src/data/dashboard';

export default function HomePage() {
  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-sky-400">
            Developer analytics
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Engineering overview
          </h1>
          <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
            Repository activity, pull requests and development metrics in one place.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <ActivityList />
          <RepositoryList />
        </div>
      </div>
    </AppShell>
  );
}
