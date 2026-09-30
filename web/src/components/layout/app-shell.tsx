'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { getCurrentUser, logout, type AuthUser } from '@/src/lib/api';

const navigationItems = [
  { label: 'Dashboard', active: true },
  { label: 'Repositories', active: false },
  { label: 'Activity', active: false },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/github`;
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
    } catch {
      setUser(null);
    }
  };

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

            {isLoading ? (
              <div className="h-10 w-20 animate-pulse rounded-md bg-slate-800" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.login} className="h-7 w-7 rounded-full" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-300">
                      {user.login.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="leading-tight text-left">
                    <div className="text-sm font-medium text-slate-50">{user.name ?? user.login}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">GitHub</div>
                  </div>
                </div>
                <Button variant="secondary" onClick={handleLogout}>
                  Log out
                </Button>
              </div>
            ) : (
              <Button variant="primary" onClick={handleLogin}>
                Connect GitHub
              </Button>
            )}
          </div>
        </header>

        <main className="py-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
