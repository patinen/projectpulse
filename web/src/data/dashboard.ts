export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
};

export type ActivityEvent = {
  id: string;
  kind: 'pull request merged' | 'issue opened' | 'commit pushed';
  repo: string;
  title: string;
  actor: string;
  time: string;
};

export type RepositorySummary = {
  id: string;
  name: string;
  language: string;
  openIssues: number;
  openPRs: number;
  lastActivity: string;
};

export const dashboardMetrics: DashboardMetric[] = [
  { label: 'Open issues', value: '24', detail: 'Across active repos' },
  { label: 'Open pull requests', value: '7', detail: 'Awaiting review' },
  { label: 'Commits (7d)', value: '86', detail: 'Across 4 repos' },
  { label: 'Active contributors', value: '6', detail: 'Last 30 days' },
];

export const recentActivity: ActivityEvent[] = [
  {
    id: 'activity-1',
    kind: 'pull request merged',
    repo: 'projectpulse/web',
    title: 'Improve dashboard responsiveness',
    actor: 'maria',
    time: '12 minutes ago',
  },
  {
    id: 'activity-2',
    kind: 'issue opened',
    repo: 'projectpulse/api',
    title: 'API health checks missing on staging',
    actor: 'david',
    time: '2 hours ago',
  },
  {
    id: 'activity-3',
    kind: 'commit pushed',
    repo: 'projectpulse/platform',
    title: 'Refined deployment guardrails',
    actor: 'nina',
    time: 'Yesterday',
  },
];

export const repositoryOverview: RepositorySummary[] = [
  {
    id: 'repo-1',
    name: 'projectpulse/web',
    language: 'TypeScript',
    openIssues: 8,
    openPRs: 2,
    lastActivity: '2h ago',
  },
  {
    id: 'repo-2',
    name: 'projectpulse/api',
    language: 'TypeScript',
    openIssues: 5,
    openPRs: 3,
    lastActivity: '5h ago',
  },
  {
    id: 'repo-3',
    name: 'projectpulse/platform',
    language: 'Go',
    openIssues: 11,
    openPRs: 2,
    lastActivity: '1d ago',
  },
];
