import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../auth/auth.guard.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService', () => {
  it('returns the latest persisted snapshot when available', async () => {
    const snapshot = {
      generatedAt: '2026-09-30T00:00:00.000Z',
      metrics: { openIssues: 1, openPullRequests: 2, commits7d: 3, activeContributors30d: 4 },
      repositories: [],
      recentActivity: [],
    };

    const prisma: any = {
      trackedRepository: { findMany: vi.fn() },
    };

    const aggregationService: any = { buildDashboard: vi.fn() };
    const snapshotService: any = { getLatestSnapshot: vi.fn().mockResolvedValue(snapshot), saveSnapshot: vi.fn() };

    const service = new DashboardService(prisma, aggregationService, snapshotService);
    await expect(service.getDashboard('user-1')).resolves.toEqual(snapshot);
    expect(aggregationService.buildDashboard).not.toHaveBeenCalled();
  });

  it('returns zero metrics without a snapshot when no tracked repositories exist', async () => {
    const prisma: any = {
      trackedRepository: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const aggregationService: any = { buildDashboard: vi.fn() };
    const snapshotService: any = { getLatestSnapshot: vi.fn().mockResolvedValue(null), saveSnapshot: vi.fn() };

    const service = new DashboardService(prisma, aggregationService, snapshotService);
    const dashboard = await service.getDashboard('user-1');

    expect(dashboard.metrics).toEqual({
      openIssues: 0,
      openPullRequests: 0,
      commits7d: 0,
      activeContributors30d: 0,
    });
    expect(aggregationService.buildDashboard).not.toHaveBeenCalled();
    expect(snapshotService.saveSnapshot).not.toHaveBeenCalled();
  });

  it('falls back to live aggregation when no snapshot exists and preserves the generatedAt timestamp', async () => {
    const dashboard = {
      generatedAt: '2026-09-30T00:00:00.000Z',
      metrics: { openIssues: 1, openPullRequests: 2, commits7d: 3, activeContributors30d: 4 },
      repositories: [],
      recentActivity: [],
    };

    const prisma: any = {
      trackedRepository: { findMany: vi.fn().mockResolvedValue([{ repository: { id: 'repo-1' } }]) },
    };

    const aggregationService: any = {
      buildDashboard: vi.fn().mockResolvedValue(dashboard),
    };

    const snapshotService: any = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null),
      saveSnapshot: vi.fn().mockResolvedValue({ id: 'snapshot-1' }),
    };

    const service = new DashboardService(prisma, aggregationService, snapshotService);
    const result = await service.getDashboard('user-1');

    expect(aggregationService.buildDashboard).toHaveBeenCalledTimes(1);
    expect(aggregationService.buildDashboard).toHaveBeenCalledWith('user-1');
    expect(snapshotService.saveSnapshot).toHaveBeenCalledWith('user-1', dashboard);
    expect(result).toEqual(dashboard);
    expect(result.generatedAt).toBe(dashboard.generatedAt);
  });
});

describe('DashboardController', () => {
  it('controller-level AuthGuard metadata is present', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, DashboardController);

    expect(guards).toContain(AuthGuard);
  });

  it('returns queued when enqueue succeeds', async () => {
    const dashboardService: any = {
      getDashboard: vi.fn(),
    };

    const queueService: any = {
      enqueueUserSync: vi.fn().mockResolvedValue(undefined),
    };

    const controller = new DashboardController(dashboardService, queueService);
    await expect(controller.refreshDashboard({ user: { id: 'user-1' } } as any)).resolves.toEqual({ status: 'queued' });
    expect(queueService.enqueueUserSync).toHaveBeenCalledWith('user-1');
  });

  it('rejects when queue enqueue fails', async () => {
    const dashboardService: any = {
      getDashboard: vi.fn(),
    };

    const queueService: any = {
      enqueueUserSync: vi.fn().mockRejectedValue(new Error('redis down')),
    };

    const controller = new DashboardController(dashboardService, queueService);
    await expect(controller.refreshDashboard({ user: { id: 'user-1' } } as any)).rejects.toThrow('Dashboard refresh could not be queued right now.');
  });
});
