import type { ReactNode } from 'react';
import { Button } from '@/src/components/ui/button';

const navigationItems = [
  { label: 'Dashboard', active: true },
  { label: 'Repositories', active: false },
  { label: 'Activity', active: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="border-b border-slate-800/90">
          <div className="flex h-20 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-sm font-semibold text-sky-300">
                P
              </div>
              <span className="text-lg font-semibold tracking-tight text-slate-50">
                ProjectPulse
              </span>
            </div>

            <nav className="hidden items-center gap-2 md:flex" aria-label="Main navigation">
              {navigationItems.map((item) => (
                <a
                  key={item.label}
                  href="#"
                  className={`rounded-md px-3 py-2 text-sm ${
                    item.active
                      ? 'bg-slate-900 text-slate-50 ring-1 ring-inset ring-slate-700'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <Button variant="primary">Connect GitHub</Button>
          </div>
        </header>

        <main className="py-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
