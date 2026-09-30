export type HealthResponse = {
  status: string;
  service: string;
};

export type AuthUser = {
  id: string;
  githubId: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
};

export type Repository = {
  githubId: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
  tracked: boolean;
};

export type DashboardMetrics = {
  openIssues: number;
  openPullRequests: number;
  commits7d: number;
  activeContributors30d: number;
};

export type DashboardRepositorySummary = {
  githubId: string;
  fullName: string;
  language: string | null;
  openIssues: number;
  openPullRequests: number;
  commits7d: number;
  lastActivityAt: string | null;
};

export type DashboardActivity = {
  id: string;
  kind: 'commit pushed' | 'issue opened' | 'pull request merged';
  repository: string;
  title: string;
  actor: string | null;
  occurredAt: string;
  url: string;
};

export type DashboardResponse = {
  generatedAt: string;
  metrics: DashboardMetrics;
  repositories: DashboardRepositorySummary[];
  recentActivity: DashboardActivity[];
};

export type RepositoryAnalyticsRange = '7d' | '30d' | '90d';

export type RepositoryAnalyticsPoint = {
  capturedAt: string;
  openIssues: number;
  openPullRequests: number;
  commits7d: number;
};

export type RepositoryAnalyticsCurrent = {
  openIssues: number;
  openPullRequests: number;
  commits7d: number;
  lastActivityAt: string | null;
  capturedAt: string;
};

export type RepositoryAnalyticsResponse = {
  repository: {
    githubId: string;
    fullName: string;
    language: string | null;
  };
  range: {
    value: RepositoryAnalyticsRange;
    from: string;
    to: string;
  };
  current: RepositoryAnalyticsCurrent | null;
  history: RepositoryAnalyticsPoint[];
};

const defaultApiUrl = 'http://localhost:3001';
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || defaultApiUrl;

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/health`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Could not load authenticated user: ${response.status}`);
  }

  return (await response.json()) as AuthUser;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Logout failed with status ${response.status}`);
  }
}

export async function getRepositories(): Promise<Repository[]> {
  const response = await fetch(`${apiBaseUrl}/repositories`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    throw new Error('Your session is no longer valid');
  }

  if (!response.ok) {
    throw new Error(`Could not load repositories: ${response.status}`);
  }

  const payload = (await response.json()) as { repositories: Repository[] };
  return payload.repositories ?? [];
}

export async function trackRepository(repository: Repository): Promise<Repository> {
  const response = await fetch(`${apiBaseUrl}/repositories/${repository.githubId}/track`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ githubId: repository.githubId }),
  });

  if (response.status === 401) {
    throw new Error('Your session is no longer valid');
  }

  if (!response.ok) {
    throw new Error(`Could not track repository: ${response.status}`);
  }

  return (await response.json()) as Repository;
}

export async function untrackRepository(githubId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/repositories/${githubId}/track`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    throw new Error('Your session is no longer valid');
  }

  if (!response.ok && response.status !== 204) {
    throw new Error(`Could not untrack repository: ${response.status}`);
  }
}

export async function getDashboard(): Promise<DashboardResponse> {
  const response = await fetch(`${apiBaseUrl}/dashboard`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    throw new Error('Your session is no longer valid');
  }

  if (!response.ok) {
    throw new Error(`Could not load dashboard: ${response.status}`);
  }

  return (await response.json()) as DashboardResponse;
}

export async function getRepositoryAnalytics(
  githubId: string,
  range: RepositoryAnalyticsRange = '30d',
): Promise<RepositoryAnalyticsResponse> {
  const params = new URLSearchParams({ range });
  const encodedGithubId = encodeURIComponent(githubId);
  const response = await fetch(`${apiBaseUrl}/repositories/${encodedGithubId}/analytics?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    throw new Error('Your session is no longer valid');
  }

  if (response.status === 404) {
    throw new Error('Repository is not tracked for this user');
  }

  if (!response.ok) {
    throw new Error(`Could not load repository analytics: ${response.status}`);
  }

  return (await response.json()) as RepositoryAnalyticsResponse;
}
