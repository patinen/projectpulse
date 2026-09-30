import { describe, expect, it, vi } from 'vitest';
import { DashboardSyncScheduler } from './dashboard-sync.scheduler.js';

describe('DashboardSyncScheduler', () => {
  it('queries distinct tracked users and enqueues one sync per user without aggregating itself', async () => {
    const prisma: any = {
      trackedRepository: {
        groupBy: vi.fn().mockResolvedValue([
          { userId: 'user-1' },
          { userId: 'user-2' },
        ]),
      },
    };

    const queue: any = {
      enqueueUserSync: vi.fn().mockResolvedValue(undefined),
    };

    const scheduler = new DashboardSyncScheduler(prisma, queue);
    await scheduler.syncTrackedUsers();

    expect(prisma.trackedRepository.groupBy).toHaveBeenCalledWith({ by: ['userId'] });
    expect(queue.enqueueUserSync).toHaveBeenCalledTimes(2);
    expect(queue.enqueueUserSync).toHaveBeenNthCalledWith(1, 'user-1');
    expect(queue.enqueueUserSync).toHaveBeenNthCalledWith(2, 'user-2');
  });

  it('continues enqueueing remaining users after one user fails', async () => {
    const prisma: any = {
      trackedRepository: {
        groupBy: vi.fn().mockResolvedValue([
          { userId: 'user-1' },
          { userId: 'user-2' },
        ]),
      },
    };

    const queue: any = {
      enqueueUserSync: vi.fn()
        .mockRejectedValueOnce(new Error('redis down'))
        .mockResolvedValueOnce(undefined),
    };

    const scheduler = new DashboardSyncScheduler(prisma, queue);

    await expect(scheduler.syncTrackedUsers()).resolves.toBeUndefined();
    expect(queue.enqueueUserSync).toHaveBeenCalledTimes(2);
    expect(queue.enqueueUserSync).toHaveBeenNthCalledWith(1, 'user-1');
    expect(queue.enqueueUserSync).toHaveBeenNthCalledWith(2, 'user-2');
  });
});
