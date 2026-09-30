import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryAnalyticsService } from './repository-analytics.service.js';

describe('RepositoryAnalyticsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 404 when the repository is not tracked by the authenticated user', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);

    await expect(service.getAnalytics('user-1', 'repo-123', '30d')).rejects.toThrow(NotFoundException);
  });

  it('returns null current and empty history for a tracked repository with no snapshots yet', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);
    const result = await service.getAnalytics('user-1', 'repo-123', '30d');

    expect(result.current).toBeNull();
    expect(result.history).toEqual([]);
    expect(result.repository.language).toBeNull();
  });

  it('reads language from the newest repository metric snapshot, not the repository model', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue({
          language: 'TypeScript',
          openIssues: 2,
          openPullRequests: 1,
          commits7d: 3,
          lastActivityAt: new Date('2026-09-30T09:00:00.000Z'),
          dashboardSnapshot: { capturedAt: new Date('2026-09-30T09:00:00.000Z') },
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);
    const result = await service.getAnalytics('user-1', 'repo-123', '30d');

    expect(prisma.trackedRepository.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          repository: {
            select: {
              githubId: true,
              fullName: true,
            },
          },
        },
      }),
    );
    expect(result.repository.language).toBe('TypeScript');
  });

  it('uses the exact 7d / 30d / 90d range cutoffs against a fixed clock', async () => {
    vi.setSystemTime(new Date('2026-09-30T12:00:00.000Z'));

    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);
    await service.getAnalytics('user-1', 'repo-123', '7d');
    await service.getAnalytics('user-1', 'repo-123', '30d');
    await service.getAnalytics('user-1', 'repo-123', '90d');

    const calls = prisma.repositoryMetricSnapshot.findMany.mock.calls;
    expect(calls[0][0].where.dashboardSnapshot.is.capturedAt.gte.toISOString()).toBe('2026-09-23T12:00:00.000Z');
    expect(calls[1][0].where.dashboardSnapshot.is.capturedAt.gte.toISOString()).toBe('2026-08-31T12:00:00.000Z');
    expect(calls[2][0].where.dashboardSnapshot.is.capturedAt.gte.toISOString()).toBe('2026-07-02T12:00:00.000Z');
  });

  it('keeps the last snapshot for each UTC day when bucketing history', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue({
          language: 'TypeScript',
          openIssues: 3,
          openPullRequests: 2,
          commits7d: 7,
          lastActivityAt: new Date('2026-09-30T20:00:00.000Z'),
          dashboardSnapshot: { capturedAt: new Date('2026-09-30T20:00:00.000Z') },
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            openIssues: 1,
            openPullRequests: 1,
            commits7d: 2,
            dashboardSnapshot: { capturedAt: new Date('2026-09-30T10:00:00.000Z') },
          },
          {
            openIssues: 2,
            openPullRequests: 1,
            commits7d: 3,
            dashboardSnapshot: { capturedAt: new Date('2026-09-30T20:00:00.000Z') },
          },
          {
            openIssues: 5,
            openPullRequests: 4,
            commits7d: 8,
            dashboardSnapshot: { capturedAt: new Date('2026-10-01T08:00:00.000Z') },
          },
        ]),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);
    const result = await service.getAnalytics('user-1', 'repo-123', '30d');

    expect(result.history).toEqual([
      {
        capturedAt: '2026-09-30T20:00:00.000Z',
        openIssues: 2,
        openPullRequests: 1,
        commits7d: 3,
      },
      {
        capturedAt: '2026-10-01T08:00:00.000Z',
        openIssues: 5,
        openPullRequests: 4,
        commits7d: 8,
      },
    ]);
  });

  it('rejects unsupported analytics ranges with a clean client error', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);

    await expect(service.getAnalytics('user-1', 'repo-123', '1d' as any)).rejects.toThrow(BadRequestException);
  });
});
