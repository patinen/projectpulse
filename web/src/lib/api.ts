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
