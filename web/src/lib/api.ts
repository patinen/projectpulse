export type HealthResponse = {
  status: string;
  service: string;
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
