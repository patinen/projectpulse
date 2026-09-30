export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
};

export type DashboardActivityEvent = {
  id: string;
  kind: 'pull request merged' | 'issue opened' | 'commit pushed';
  repo: string;
  title: string;
  actor: string | null;
  time: string;
};

export type DashboardRepositoryOverview = {
  id: string;
  name: string;
  language: string | null;
  openIssues: number;
  openPullRequests: number;
  commits7d: number;
  lastActivity: string;
};
