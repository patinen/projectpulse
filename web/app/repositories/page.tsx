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
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-50">Repositories</h1>
          <p className="text-sm text-neutral-400">Select public GitHub repositories to track in ProjectPulse.</p>
        </header>

        {isLoading ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-neutral-300">
            Loading repositories...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-neutral-600 bg-neutral-900 p-6 text-neutral-200">
            {error}
          </div>
        ) : repositories.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-8 text-center text-neutral-300">
            No public repositories were found for this account.
          </div>
        ) : (
          <div className="space-y-4">
            {repositories.map((repository) => (
              <article
                key={repository.githubId}
                className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                        {repository.owner}
                      </span>
                      <span className="text-neutral-500">/</span>
                      {repository.tracked ? (
                        <Link
                          href={`/repositories/${repository.githubId}`}
                          className="text-lg font-semibold text-neutral-100 hover:text-white"
                        >
                          {repository.name}
                        </Link>
                      ) : (
                        <span className="text-lg font-semibold text-neutral-100">{repository.name}</span>
                      )}
                    </div>

                    {repository.description ? (
                      <p className="text-sm text-neutral-300">{repository.description}</p>
                    ) : (
                      <p className="text-sm text-neutral-500">No description provided.</p>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs text-neutral-400">
                      {repository.language ? <span>Language: {repository.language}</span> : null}
                      <span>Stars: {repository.stars}</span>
                      <span>Forks: {repository.forks}</span>
                      <span>Updated: {new Date(repository.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {repository.tracked ? (
                      <Link
                        href={`/repositories/${repository.githubId}`}
                        className="inline-flex items-center justify-center rounded-md border border-neutral-600 bg-neutral-800/80 px-3 py-2 text-sm font-medium text-neutral-200 hover:border-neutral-500 hover:text-white"
                      >
                        View analytics
                      </Link>
                    ) : null}

                    <a
                      href={repository.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-200 hover:border-neutral-500 hover:text-white"
                    >
                      GitHub
                    </a>

                    <button
                      type="button"
                      onClick={() => void handleToggle(repository)}
                      disabled={pendingId === repository.githubId}
                      className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition ${
                        repository.tracked
                          ? 'border border-neutral-600 bg-neutral-800 text-neutral-100 hover:border-neutral-500'
                          : 'border border-neutral-100 bg-neutral-100 text-neutral-950 hover:bg-white'
                      } ${pendingId === repository.githubId ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      {pendingId === repository.githubId
                        ? 'Updating...'
                        : repository.tracked
                          ? 'Untrack'
                          : 'Track'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
