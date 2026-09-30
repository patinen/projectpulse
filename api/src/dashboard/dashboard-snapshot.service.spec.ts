import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';
import { DashboardSnapshotService } from './dashboard-snapshot.service.js';
import type { DashboardResponse } from './dashboard.types.js';

describe('DashboardSnapshotService', () => {
  it('saves aggregate metrics, repository rows, and recentActivity JSON and reconstructs the response', async () => {
    const dashboard: DashboardResponse = {
      generatedAt: '2026-09-30T00:00:00.000Z',
      metrics: {
        openIssues: 2,
        openPullRequests: 1,
        commits7d: 4,
        activeContributors30d: 3,
      },
      repositories: [
        {
          githubId: '42',
          fullName: 'octo/projectpulse',
          language: 'TypeScript',
          openIssues: 2,
          openPullRequests: 1,
          commits7d: 4,
          lastActivityAt: '2026-09-30T00:00:00.000Z',
        },
      ],
      recentActivity: [
        {
          id: 'commit:octo/projectpulse:abc',
          kind: 'commit pushed',
          repository: 'octo/projectpulse',
          title: 'Merge fix',
          actor: 'alice',
          occurredAt: '2026-09-30T00:00:00.000Z',
          url: 'https://example.com/commit/abc',
        },
      ],
    };

    const create = vi.fn().mockResolvedValue({
      id: 'snapshot-1',
      capturedAt: new Date('2026-09-30T00:00:00.000Z'),
      userId: 'user-1',
      metrics: dashboard.metrics,
      recentActivity: dashboard.recentActivity,
      repositories: [],
    });

    const prisma: any = {
      $transaction: vi.fn(async (callback) => callback({
        repository: {
          findUnique: vi.fn().mockResolvedValue({ id: 'repo-1' }),
        },
        dashboardSnapshot: {
          create: create,
        },
        repositoryMetricSnapshot: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      })),
      repository: {
        findUnique: vi.fn().mockResolvedValue({ id: 'repo-1' }),
      },
      dashboardSnapshot: {
        create: create,
      },
      repositoryMetricSnapshot: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const service = new DashboardSnapshotService(prisma);
    const snapshot = await service.saveSnapshot('user-1', dashboard);

    expect(snapshot.id).toBe('snapshot-1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          recentActivity: dashboard.recentActivity,
        }),
      }),
    );

    prisma.dashboardSnapshot.findFirst = vi.fn().mockResolvedValue({
      id: 'snapshot-1',
      capturedAt: new Date('2026-09-30T00:00:00.000Z'),
      openIssues: 2,
      openPullRequests: 1,
      commits7d: 4,
      activeContributors30d: 3,
      recentActivity: dashboard.recentActivity,
      repositories: [{
        fullName: 'octo/projectpulse',
        language: 'TypeScript',
        openIssues: 2,
        openPullRequests: 1,
        commits7d: 4,
        lastActivityAt: '2026-09-30T00:00:00.000Z',
      }],
    });

    const reconstructed = await service.getLatestSnapshot('user-1');
    expect(reconstructed).toMatchObject({
      generatedAt: '2026-09-30T00:00:00.000Z',
      metrics: { openIssues: 2, openPullRequests: 1, commits7d: 4, activeContributors30d: 3 },
      repositories: [{ fullName: 'octo/projectpulse', language: 'TypeScript' }],
      recentActivity: dashboard.recentActivity,
    });
  });

  it('selects the latest snapshot by capturedAt descending', async () => {
    const prisma: any = {
      dashboardSnapshot: {
        findFirst: vi.fn().mockResolvedValue({
          capturedAt: new Date('2026-09-29T00:00:00.000Z'),
          openIssues: 1,
          openPullRequests: 0,
          commits7d: 3,
          activeContributors30d: 2,
          recentActivity: [],
          repositories: [],
        }),
      },
      repository: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      repositoryMetricSnapshot: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const service = new DashboardSnapshotService(prisma);
    const result = await service.getLatestSnapshot('user-1');
    expect(result).toBeTruthy();
    expect(prisma.dashboardSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: { capturedAt: 'desc' },
      }),
    );
  });
});

describe('DashboardService snapshot read path', () => {
  it('returns latest persisted snapshot without calling GitHub', async () => {
    const snapshot = {
      generatedAt: '2026-09-30T00:00:00.000Z',
      metrics: {
        openIssues: 4,
        openPullRequests: 2,
        commits7d: 7,
        activeContributors30d: 3,
      },
      repositories: [],
      recentActivity: [],
    };

    const prisma: any = {
      trackedRepository: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const aggregationService: any = {
      buildDashboard: vi.fn(),
    };

    const snapshotService: any = {
      getLatestSnapshot: vi.fn().mockResolvedValue(snapshot),
      saveSnapshot: vi.fn(),
    };

    const service = new DashboardService(prisma, aggregationService, snapshotService);
    await expect(service.getDashboard('user-1')).resolves.toEqual(snapshot);
    expect(aggregationService.buildDashboard).not.toHaveBeenCalled();
  });

  it('first load without snapshot performs live aggregation and persists it', async () => {
    const liveResponse = {
      generatedAt: '2026-09-30T00:00:00.000Z',
      metrics: { openIssues: 1, openPullRequests: 2, commits7d: 3, activeContributors30d: 4 },
      repositories: [],
      recentActivity: [],
    };

    const prisma: any = {
      trackedRepository: { findMany: vi.fn().mockResolvedValue([{ repository: { id: 'repo-1' } }]) },
    };

    const aggregationService: any = {
      buildDashboard: vi.fn().mockResolvedValue(liveResponse),
    };

    const snapshotService: any = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null),
      saveSnapshot: vi.fn().mockResolvedValue({ id: 'snapshot-1' }),
    };

    const service = new DashboardService(prisma, aggregationService, snapshotService);
    const result = await service.getDashboard('user-1');

    expect(aggregationService.buildDashboard).toHaveBeenCalledWith('user-1');
    expect(snapshotService.saveSnapshot).toHaveBeenCalledWith('user-1', liveResponse);
    expect(result).toEqual(liveResponse);
  });

  it('returns empty dashboard without snapshot when no tracked repositories exist', async () => {
    const prisma: any = {
      trackedRepository: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const aggregationService: any = { buildDashboard: vi.fn() };
    const snapshotService: any = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null),
      saveSnapshot: vi.fn(),
    };

    const service = new DashboardService(prisma, aggregationService, snapshotService);
    const result = await service.getDashboard('user-1');

    expect(result.metrics).toEqual({
      openIssues: 0,
      openPullRequests: 0,
      commits7d: 0,
      activeContributors30d: 0,
    });
    expect(snapshotService.saveSnapshot).not.toHaveBeenCalled();
    expect(aggregationService.buildDashboard).not.toHaveBeenCalled();
  });
});
