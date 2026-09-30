'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/src/components/ui/button';
import { getCurrentUser, logout, type AuthUser } from '@/src/lib/api';

const navigationItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Repositories', href: '/repositories' },
  { label: 'Activity', href: '/activity' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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

  const githubLoginUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/github`;

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
    } catch {
      setUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="border-b border-neutral-800/90">
          <div className="flex h-20 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 text-neutral-100">
                <svg
                  viewBox="0 0 32 32"
                  className="h-4 w-4"
                  aria-label="ProjectPulse"
                  role="img"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 16H8L11 10L14 22L18 9L20.5 16H29"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-lg font-semibold tracking-tight text-neutral-50">
                ProjectPulse
              </span>
            </div>

            <nav className="hidden items-center gap-2 md:flex" aria-label="Main navigation">
              {navigationItems.map((item) => {
                const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? 'bg-neutral-900 text-neutral-50 ring-1 ring-inset ring-neutral-700'
                        : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {isLoading ? (
              <div className="h-10 w-20 animate-pulse rounded-md bg-neutral-800" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5">
                  {user.avatarUrl ? (
                    <Image src={user.avatarUrl} alt={user.login} width={28} height={28} className="rounded-full" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-700 text-xs font-semibold text-neutral-100">
                      {user.login.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="leading-tight text-left">
                    <div className="text-sm font-medium text-neutral-50">{user.name ?? user.login}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">GitHub</div>
                  </div>
                </div>
                <Button variant="secondary" onClick={handleLogout}>
                  Log out
                </Button>
              </div>
            ) : (
              <a
                href={githubLoginUrl}
                className="inline-flex items-center justify-center rounded-md border border-neutral-100 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 shadow-sm hover:bg-white"
              >
                Connect GitHub
              </a>
            )}
          </div>
        </header>

        <main className="py-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
