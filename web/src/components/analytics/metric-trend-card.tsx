'use client';

export type MetricTrendCardProps<T extends { capturedAt: string }> = {
  title: string;
  currentValue: number;
  history: T[];
  valueSelector: (entry: T) => number;
};

function formatSignedDelta(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function MetricTrendCard<T extends { capturedAt: string }>({
  title,
  currentValue,
  history,
  valueSelector,
}: MetricTrendCardProps<T>) {
  const values = history.map((entry) => valueSelector(entry));

  if (history.length === 0) {
    return (
      <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{title}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-50">{currentValue}</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">
          <p>No historical snapshots are available for this repository yet.</p>
          <p className="mt-2">Trend data builds over time as ProjectPulse captures snapshots.</p>
        </div>
      </article>
    );
  }

  if (history.length === 1) {
    return (
      <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{title}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-50">{currentValue}</p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300">
            {formatSignedDelta(currentValue - values[0])}
          </span>
        </div>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">
          More snapshot history is needed to show a trend.
        </div>
      </article>
    );
  }

  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const delta = lastValue - firstValue;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const rangeSize = maxValue - minValue || 1;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 100 - ((value - minValue) / rangeSize) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  const startLabel = formatDate(history[0].capturedAt);
  const endLabel = formatDate(history[history.length - 1].capturedAt);

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold text-slate-50">{currentValue}</p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300">
          {formatSignedDelta(delta)}
        </span>
      </div>

      <div className="mt-4 h-20 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-2">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
            className="text-sky-400"
          />
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </article>
  );
}
