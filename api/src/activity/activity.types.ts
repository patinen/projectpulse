export type ActivityRange = '7d' | '30d' | '90d';
export type ActivityKindFilter = 'all' | 'commit' | 'issue' | 'pr';

export type ActivityEventKind = 'commit pushed' | 'issue opened' | 'pull request merged';

export type ActivityEvent = {
  id: string;
  kind: ActivityEventKind;
  repository: string;
  title: string;
  actor: string | null;
  occurredAt: string;
  url: string;
};

export type ActivityRepositoryFilter = {
  fullName: string;
  githubId: string | null;
  tracked: boolean;
};

export type ActivityResponse = {
  range: {
    value: ActivityRange;
    from: string;
    to: string;
  };
  filters: {
    kind: ActivityKindFilter;
    repository: string | null;
  };
  repositories: ActivityRepositoryFilter[];
  events: ActivityEvent[];
  meta: {
    eventCount: number;
    latestSnapshotAt: string | null;
  };
};
