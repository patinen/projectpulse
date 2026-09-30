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

export type DashboardActivityKind = 'commit pushed' | 'issue opened' | 'pull request merged';

export type DashboardActivity = {
  id: string;
  kind: DashboardActivityKind;
  repository: string;
  title: string;
  actor: string | null;
  occurredAt: string;
  url: string;
};

export type DashboardResponse = {
  metrics: DashboardMetrics;
  repositories: DashboardRepositorySummary[];
  recentActivity: DashboardActivity[];
};
