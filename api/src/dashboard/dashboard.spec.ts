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
});

describe('DashboardController', () => {
  it('controller-level AuthGuard metadata is present', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, DashboardController);

    expect(guards).toContain(AuthGuard);
  });
});
