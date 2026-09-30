'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/src/components/layout/app-shell';
import { getRepositories, trackRepository, untrackRepository, type Repository } from '@/src/lib/api';

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadRepositories = async () => {
    try {
      setError(null);
      const response = await getRepositories();
      setRepositories(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load repositories');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadRepositories();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleToggle = async (repository: Repository) => {
    try {
      setPendingId(repository.githubId);
      if (repository.tracked) {
        await untrackRepository(repository.githubId);
      } else {
        await trackRepository(repository);
      }

      setRepositories((current) =>
        current.map((item) =>
          item.githubId === repository.githubId
            ? { ...item, tracked: !item.tracked }
            : item,
        ),
      );
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Repository update failed');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Repositories</h1>
          <p className="text-sm text-slate-400">Select public GitHub repositories to track in ProjectPulse.</p>
        </header>

        {isLoading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
            Loading repositories...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
            {error}
          </div>
        ) : repositories.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-300">
            No public repositories were found for this account.
          </div>
        ) : (
          <div className="space-y-4">
            {repositories.map((repository) => (
              <article
                key={repository.githubId}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400">
                        {repository.owner}
                      </span>
                      <span className="text-slate-500">/</span>
                      <Link
                        href={`/repositories/${repository.githubId}`}
                        className="text-lg font-semibold text-slate-100 hover:text-sky-300"
                      >
                        {repository.name}
                      </Link>
                    </div>

                    {repository.description ? (
                      <p className="text-sm text-slate-300">{repository.description}</p>
                    ) : (
                      <p className="text-sm text-slate-500">No description provided.</p>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                      {repository.language ? <span>Language: {repository.language}</span> : null}
                      <span>Stars: {repository.stars}</span>
                      <span>Forks: {repository.forks}</span>
                      <span>Updated: {new Date(repository.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleToggle(repository)}
                    disabled={pendingId === repository.githubId}
                    className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition ${
                      repository.tracked
                        ? 'border border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-500'
                        : 'border border-sky-500 bg-sky-500 text-slate-950 hover:bg-sky-400'
                    } ${pendingId === repository.githubId ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    {pendingId === repository.githubId
                      ? 'Updating...'
                      : repository.tracked
                        ? 'Untrack'
                        : 'Track'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
