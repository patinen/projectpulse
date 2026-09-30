import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityService } from './activity.service.js';

describe('ActivityService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty events when there are no snapshots in range', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { range: '30d' });

    expect(result.events).toEqual([]);
    expect(result.meta.eventCount).toBe(0);
    expect(result.repositories).toEqual([]);
  });

  it('only queries the authenticated user snapshots', async () => {
    vi.setSystemTime(new Date('2026-09-30T12:00:00.000Z'));
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    await service.getActivity('user-1', { range: '30d' });

    expect(prisma.dashboardSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
  });

  it('uses the exact 7d / 30d / 90d range cutoffs with fake time', async () => {
    vi.setSystemTime(new Date('2026-09-30T12:00:00.000Z'));

    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    await service.getActivity('user-1', { range: '7d' });
    await service.getActivity('user-1', { range: '30d' });
    await service.getActivity('user-1', { range: '90d' });

    const calls = prisma.dashboardSnapshot.findMany.mock.calls;
    expect(calls[0][0].where.capturedAt.gte.toISOString()).toBe('2026-09-23T12:00:00.000Z');
    expect(calls[1][0].where.capturedAt.gte.toISOString()).toBe('2026-08-31T12:00:00.000Z');
    expect(calls[2][0].where.capturedAt.gte.toISOString()).toBe('2026-07-02T12:00:00.000Z');
  });

  it('rejects unsupported activity ranges', async () => {
    const prisma: any = {
      dashboardSnapshot: { findMany: vi.fn() },
      trackedRepository: { findMany: vi.fn() },
    };

    const service = new ActivityService(prisma);
    await expect(service.getActivity('user-1', { range: '1d' })).rejects.toThrow(BadRequestException);
  });

  it('rejects unsupported activity kinds', async () => {
    const prisma: any = {
      dashboardSnapshot: { findMany: vi.fn() },
      trackedRepository: { findMany: vi.fn() },
    };

    const service = new ActivityService(prisma);
    await expect(service.getActivity('user-1', { kind: 'release' })).rejects.toThrow(BadRequestException);
  });

  it('deduplicates events by stable id across multiple snapshots', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T10:00:00.000Z'),
            recentActivity: [
              { id: 'commit:a:abc', kind: 'commit pushed', repository: 'acme/app', title: 'first', actor: 'alice', occurredAt: '2026-09-30T09:00:00.000Z', url: 'https://github.com/acme/app/commit/abc' },
              { id: 'issue:a:123', kind: 'issue opened', repository: 'acme/app', title: 'issue-1', actor: 'bob', occurredAt: '2026-09-29T09:00:00.000Z', url: 'https://github.com/acme/app/issues/123' },
            ],
          },
          {
            capturedAt: new Date('2026-09-29T10:00:00.000Z'),
            recentActivity: [
              { id: 'commit:a:abc', kind: 'commit pushed', repository: 'acme/app', title: 'first', actor: 'alice', occurredAt: '2026-09-30T09:00:00.000Z', url: 'https://github.com/acme/app/commit/abc' },
              { id: 'issue:a:123', kind: 'issue opened', repository: 'acme/app', title: 'issue-1', actor: 'bob', occurredAt: '2026-09-29T09:00:00.000Z', url: 'https://github.com/acme/app/issues/123' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { range: '30d' });

    expect(result.events).toHaveLength(2);
    expect(new Set(result.events.map((event) => event.id)).size).toBe(2);
  });

  it('keeps data from the newest snapshot for duplicate ids', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T12:00:00.000Z'),
            recentActivity: [
              { id: 'pr:acme/app:99', kind: 'pull request merged', repository: 'acme/app', title: 'newest title', actor: 'charlie', occurredAt: '2026-09-30T11:00:00.000Z', url: 'https://github.com/acme/app/pull/99' },
            ],
          },
          {
            capturedAt: new Date('2026-09-29T12:00:00.000Z'),
            recentActivity: [
              { id: 'pr:acme/app:99', kind: 'pull request merged', repository: 'acme/app', title: 'older title', actor: 'dan', occurredAt: '2026-09-30T11:00:00.000Z', url: 'https://github.com/acme/app/pull/99' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { range: '30d' });

    expect(result.events[0].title).toBe('newest title');
    expect(result.events[0].actor).toBe('charlie');
  });

  it('ignores malformed JSON entries', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T12:00:00.000Z'),
            recentActivity: [
              { id: 'bad', kind: 'issue opened', repository: 'acme/app', title: 'valid', actor: null, occurredAt: 'bad-date', url: 'https://github.com/acme/app/issues/1' },
              { id: 'good', kind: 'issue opened', repository: 'acme/app', title: 'title', actor: null, occurredAt: '2026-09-30T11:00:00.000Z', url: 'https://github.com/acme/app/issues/2' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { range: '30d' });

    expect(result.events.map((event) => event.id)).toEqual(['good']);
  });

  it('accepts null actor values', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T12:00:00.000Z'),
            recentActivity: [
              { id: 'commit:a:123', kind: 'commit pushed', repository: 'acme/app', title: 'commit-title', actor: null, occurredAt: '2026-09-30T11:00:00.000Z', url: 'https://github.com/acme/app/commit/123' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { range: '30d' });

    expect(result.events[0].actor).toBeNull();
  });

  it('rejects malformed actor values instead of silently coercing them to null', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T12:00:00.000Z'),
            recentActivity: [
              { id: 'commit:a:bad', kind: 'commit pushed', repository: 'acme/app', title: 'bad actor', actor: { login: 'alice' }, occurredAt: '2026-09-30T11:00:00.000Z', url: 'https://github.com/acme/app/commit/bad' },
              { id: 'commit:a:good', kind: 'commit pushed', repository: 'acme/app', title: 'good actor', actor: 'alice', occurredAt: '2026-09-30T10:00:00.000Z', url: 'https://github.com/acme/app/commit/good' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { range: '30d' });

    expect(result.events.map((event) => event.id)).toEqual(['commit:a:good']);
  });

  it('filters by commit, issue, or pr event type', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T12:00:00.000Z'),
            recentActivity: [
              { id: 'commit:1', kind: 'commit pushed', repository: 'acme/app', title: 'commit', actor: 'alice', occurredAt: '2026-09-30T09:00:00.000Z', url: 'https://github.com/acme/app/commit/1' },
              { id: 'issue:1', kind: 'issue opened', repository: 'acme/app', title: 'issue', actor: 'bob', occurredAt: '2026-09-30T08:00:00.000Z', url: 'https://github.com/acme/app/issues/1' },
              { id: 'pr:1', kind: 'pull request merged', repository: 'acme/app', title: 'pr', actor: 'charlie', occurredAt: '2026-09-30T07:00:00.000Z', url: 'https://github.com/acme/app/pull/1' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const commitResult = await service.getActivity('user-1', { kind: 'commit' });
    const issueResult = await service.getActivity('user-1', { kind: 'issue' });
    const prResult = await service.getActivity('user-1', { kind: 'pr' });

    expect(commitResult.events.map((event) => event.kind)).toEqual(['commit pushed']);
    expect(issueResult.events.map((event) => event.kind)).toEqual(['issue opened']);
    expect(prResult.events.map((event) => event.kind)).toEqual(['pull request merged']);
  });

  it('keeps repository filter options stable across kind switches and applies the selected time range to occurredAt', async () => {
    vi.setSystemTime(new Date('2026-09-30T12:00:00.000Z'));
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T11:00:00.000Z'),
            recentActivity: [
              { id: 'commit:1', kind: 'commit pushed', repository: 'acme/app', title: 'commit', actor: 'alice', occurredAt: '2026-09-30T09:00:00.000Z', url: 'https://github.com/acme/app/commit/1' },
              { id: 'issue:1', kind: 'issue opened', repository: 'alpha/service', title: 'issue', actor: 'bob', occurredAt: '2026-09-27T08:00:00.000Z', url: 'https://github.com/alpha/service/issues/1' },
              { id: 'pr:1', kind: 'pull request merged', repository: 'zeta/ops', title: 'pr', actor: 'charlie', occurredAt: '2026-09-25T07:00:00.000Z', url: 'https://github.com/zeta/ops/pull/1' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([{ repository: { githubId: '111', fullName: 'acme/app' } }]),
      },
    };

    const service = new ActivityService(prisma);
    const allResult = await service.getActivity('user-1', { range: '30d', kind: 'all' });
    const commitResult = await service.getActivity('user-1', { range: '30d', kind: 'commit' });

    expect(allResult.repositories.map((repo) => repo.fullName)).toEqual(['acme/app', 'alpha/service', 'zeta/ops']);
    expect(commitResult.repositories.map((repo) => repo.fullName)).toEqual(['acme/app', 'alpha/service', 'zeta/ops']);
    expect(allResult.events.map((event) => event.id)).toEqual(['commit:1', 'issue:1', 'pr:1']);
    expect(commitResult.events.map((event) => event.id)).toEqual(['commit:1']);
  });

  it('omits events that fall outside the selected occurredAt window even if stored in a recent snapshot', async () => {
    vi.setSystemTime(new Date('2026-09-30T12:00:00.000Z'));
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T11:00:00.000Z'),
            recentActivity: [
              { id: 'old-issue', kind: 'issue opened', repository: 'acme/app', title: 'old issue', actor: 'alice', occurredAt: '2026-09-18T09:00:00.000Z', url: 'https://github.com/acme/app/issues/99' },
              { id: 'new-issue', kind: 'issue opened', repository: 'acme/app', title: 'new issue', actor: 'alice', occurredAt: '2026-09-29T09:00:00.000Z', url: 'https://github.com/acme/app/issues/100' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { range: '7d' });

    expect(result.events.map((event) => event.id)).toEqual(['new-issue']);
  });

  it('filters by exact repository fullName', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T12:00:00.000Z'),
            recentActivity: [
              { id: 'commit:1', kind: 'commit pushed', repository: 'acme/app', title: 'app', actor: 'alice', occurredAt: '2026-09-30T09:00:00.000Z', url: 'https://github.com/acme/app/commit/1' },
              { id: 'commit:2', kind: 'commit pushed', repository: 'other/project', title: 'other', actor: 'bob', occurredAt: '2026-09-30T08:00:00.000Z', url: 'https://github.com/other/project/commit/2' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { repository: 'acme/app' });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].repository).toBe('acme/app');
  });

  it('sorts newest to oldest by occurredAt', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T12:00:00.000Z'),
            recentActivity: [
              { id: 'older', kind: 'issue opened', repository: 'acme/app', title: 'older', actor: 'alice', occurredAt: '2026-09-29T09:00:00.000Z', url: 'https://github.com/acme/app/issues/1' },
              { id: 'newer', kind: 'commit pushed', repository: 'acme/app', title: 'newer', actor: 'bob', occurredAt: '2026-09-30T11:00:00.000Z', url: 'https://github.com/acme/app/commit/2' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { range: '30d' });

    expect(result.events[0].id).toBe('newer');
  });

  it('limits the response to 100 events and reports filtered count before the limit', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T12:00:00.000Z'),
            recentActivity: Array.from({ length: 105 }, (_, index) => ({
              id: `event-${index}`,
              kind: 'commit pushed',
              repository: 'acme/app',
              title: `commit ${index}`,
              actor: 'alice',
              occurredAt: new Date(Date.now() - index * 60000).toISOString(),
              url: `https://github.com/acme/app/commit/${index}`,
            })),
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { range: '30d' });

    expect(result.events).toHaveLength(100);
    expect(result.meta.eventCount).toBe(105);
  });

  it('returns tracked githubId and tracked=true for current tracked repos and null + false for historical repos', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T12:00:00.000Z'),
            recentActivity: [
              { id: 'commit:tracked', kind: 'commit pushed', repository: 'acme/app', title: 'tracked', actor: 'alice', occurredAt: '2026-09-30T11:00:00.000Z', url: 'https://github.com/acme/app/commit/1' },
              { id: 'commit:historical', kind: 'commit pushed', repository: 'legacy/project', title: 'historical', actor: 'bob', occurredAt: '2026-09-30T10:00:00.000Z', url: 'https://github.com/legacy/project/commit/2' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([
          { repository: { githubId: '111', fullName: 'acme/app' } },
        ]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { range: '30d' });

    expect(result.repositories).toEqual([
      { fullName: 'acme/app', githubId: '111', tracked: true },
      { fullName: 'legacy/project', githubId: null, tracked: false },
    ]);
  });

  it('sorts repository filter options alphabetically', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findMany: vi.fn().mockResolvedValue([
          {
            capturedAt: new Date('2026-09-30T12:00:00.000Z'),
            recentActivity: [
              { id: 'event-2', kind: 'issue opened', repository: 'zeta/repo', title: 'z', actor: 'alice', occurredAt: '2026-09-30T11:00:00.000Z', url: 'https://github.com/zeta/repo/issues/1' },
              { id: 'event-1', kind: 'issue opened', repository: 'alpha/repo', title: 'a', actor: 'bob', occurredAt: '2026-09-30T10:00:00.000Z', url: 'https://github.com/alpha/repo/issues/1' },
            ],
          },
        ]),
      },
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new ActivityService(prisma);
    const result = await service.getActivity('user-1', { range: '30d' });

    expect(result.repositories.map((repo) => repo.fullName)).toEqual(['alpha/repo', 'zeta/repo']);
  });
});
