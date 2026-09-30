import type { DashboardMetric } from '@/src/data/dashboard';

export function MetricCard({ label, value, detail }: DashboardMetric) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-slate-950/30">
      <p className="text-sm text-slate-400">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="text-3xl font-semibold tracking-tight text-slate-50">{value}</span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
