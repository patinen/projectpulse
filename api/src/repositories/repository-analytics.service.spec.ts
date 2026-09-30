import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryAnalyticsService } from './repository-analytics.service.js';

describe('RepositoryAnalyticsService', () => {
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
          repository: { githubId: 'repo-123', fullName: 'octo/project', language: 'TypeScript' },
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
  });

  it('only queries snapshots belonging to the authenticated user and repository', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project', language: 'TypeScript' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);
    await service.getAnalytics('user-1', 'repo-123', '30d');

    expect(prisma.repositoryMetricSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          repository: expect.objectContaining({
            is: expect.objectContaining({ githubId: 'repo-123' }),
          }),
          dashboardSnapshot: expect.objectContaining({
            is: expect.objectContaining({ userId: 'user-1' }),
          }),
        }),
      }),
    );
  });

  it('applies the selected range cutoff date before querying historical snapshots', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project', language: 'TypeScript' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);
    await service.getAnalytics('user-1', 'repo-123', '7d');

    const args = prisma.repositoryMetricSnapshot.findMany.mock.calls[0][0];
    expect(args.where.dashboardSnapshot.is.capturedAt.gte).toBeInstanceOf(Date);
  });

  it('keeps the last snapshot for each UTC day when bucketing history', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project', language: 'TypeScript' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue({
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

  it('returns history in oldest-to-newest order', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project', language: 'TypeScript' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue({
          openIssues: 5,
          openPullRequests: 2,
          commits7d: 8,
          lastActivityAt: new Date('2026-09-30T22:00:00.000Z'),
          dashboardSnapshot: { capturedAt: new Date('2026-09-30T22:00:00.000Z') },
        }),
        findMany: vi.fn().mockResolvedValue([
          { openIssues: 4, openPullRequests: 2, commits7d: 8, dashboardSnapshot: { capturedAt: new Date('2026-09-30T22:00:00.000Z') } },
          { openIssues: 2, openPullRequests: 1, commits7d: 4, dashboardSnapshot: { capturedAt: new Date('2026-09-29T12:00:00.000Z') } },
        ]),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);
    const result = await service.getAnalytics('user-1', 'repo-123', '30d');

    expect(result.history[0].capturedAt).toBe('2026-09-29T12:00:00.000Z');
    expect(result.history[1].capturedAt).toBe('2026-09-30T22:00:00.000Z');
  });

  it('uses the newest snapshot for the current values even if it falls outside the selected range', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project', language: 'TypeScript' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue({
          openIssues: 12,
          openPullRequests: 6,
          commits7d: 9,
          lastActivityAt: new Date('2026-09-30T21:00:00.000Z'),
          dashboardSnapshot: { capturedAt: new Date('2026-09-30T21:00:00.000Z') },
        }),
        findMany: vi.fn().mockResolvedValue([
          { openIssues: 4, openPullRequests: 3, commits7d: 5, dashboardSnapshot: { capturedAt: new Date('2026-09-29T08:00:00.000Z') } },
        ]),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);
    const result = await service.getAnalytics('user-1', 'repo-123', '7d');

    expect(result.current).toMatchObject({
      openIssues: 12,
      openPullRequests: 6,
      commits7d: 9,
    });
  });

  it('returns the repository githubId and fullName in the response', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project', language: 'TypeScript' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);
    const result = await service.getAnalytics('user-1', 'repo-123', '30d');

    expect(result.repository).toEqual({
      githubId: 'repo-123',
      fullName: 'octo/project',
      language: 'TypeScript',
    });
  });

  it('uses the newest repository snapshot language when available', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project', language: 'TypeScript' },
        }),
      },
      repositoryMetricSnapshot: {
        findFirst: vi.fn().mockResolvedValue({
          openIssues: 1,
          openPullRequests: 2,
          commits7d: 3,
          lastActivityAt: new Date('2026-09-30T09:00:00.000Z'),
          dashboardSnapshot: { capturedAt: new Date('2026-09-30T09:00:00.000Z') },
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new RepositoryAnalyticsService(prisma);
    const result = await service.getAnalytics('user-1', 'repo-123', '30d');

    expect(result.repository.language).toBe('TypeScript');
  });

  it('rejects unsupported analytics ranges with a clean client error', async () => {
    const prisma: any = {
      trackedRepository: {
        findFirst: vi.fn().mockResolvedValue({
          repository: { githubId: 'repo-123', fullName: 'octo/project', language: 'TypeScript' },
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

  it('does not require a GitHub service to resolve repository analytics', () => {
    const prisma: any = {};
    const service = new RepositoryAnalyticsService(prisma);

    expect(service).toBeInstanceOf(RepositoryAnalyticsService);
  });
});
