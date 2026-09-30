import { describe, expect, it, vi } from 'vitest';
import { DashboardSyncProcessor } from './dashboard-sync-processor.service.js';

describe('DashboardSyncProcessor', () => {
  it('successfully builds and persists the dashboard snapshot', async () => {
    const dashboard = {
      generatedAt: '2026-09-30T00:00:00.000Z',
      metrics: {
        openIssues: 1,
        openPullRequests: 2,
        commits7d: 3,
        activeContributors30d: 4,
      },
      repositories: [],
      recentActivity: [],
    };

    const aggregate = vi.fn().mockResolvedValue(dashboard);
    const persist = vi.fn().mockResolvedValue({ id: 'snapshot-1' });

    const processor = new DashboardSyncProcessor(
      { buildDashboard: aggregate } as any,
      { saveSnapshot: persist } as any,
    );

    await processor.process('user-123');

    expect(aggregate).toHaveBeenCalledWith('user-123');
    expect(persist).toHaveBeenCalledWith('user-123', dashboard);
  });

  it('does not persist snapshots when aggregation fails', async () => {
    const aggregate = vi.fn().mockRejectedValue(new Error('GitHub outage'));
    const persist = vi.fn();

    const processor = new DashboardSyncProcessor(
      { buildDashboard: aggregate } as any,
      { saveSnapshot: persist } as any,
    );

    await expect(processor.process('user-123')).rejects.toThrow('GitHub outage');
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects when snapshot persistence fails so BullMQ can retry', async () => {
    const dashboard = {
      generatedAt: '2026-09-30T00:00:00.000Z',
      metrics: {
        openIssues: 0,
        openPullRequests: 0,
        commits7d: 0,
        activeContributors30d: 0,
      },
      repositories: [],
      recentActivity: [],
    };

    const aggregate = vi.fn().mockResolvedValue(dashboard);
    const persist = vi.fn().mockRejectedValue(new Error('db write failed'));

    const processor = new DashboardSyncProcessor(
      { buildDashboard: aggregate } as any,
      { saveSnapshot: persist } as any,
    );

    await expect(processor.process('user-123')).rejects.toThrow('db write failed');
    expect(aggregate).toHaveBeenCalledWith('user-123');
    expect(persist).toHaveBeenCalledWith('user-123', dashboard);
  });
});
