import { beforeEach, describe, expect, it, vi } from 'vitest';

const { addMock, closeMock, QueueMock } = vi.hoisted(() => {
  const addMock = vi.fn();
  const closeMock = vi.fn();
  const QueueMock = vi.fn(function Queue() {
    return {
      add: addMock,
      close: closeMock,
    };
  });

  return { addMock, closeMock, QueueMock };
});

vi.mock('bullmq', () => ({
  Queue: QueueMock,
}));

import { ConfigService } from '@nestjs/config';
import { DashboardSyncQueueService } from './dashboard-sync-queue.service.js';

describe('DashboardSyncQueueService', () => {
  beforeEach(() => {
    addMock.mockReset();
    closeMock.mockReset();
  });

  it('uses simple deduplication ids for outstanding syncs without a permanent custom jobId', async () => {
    const configService = { get: vi.fn().mockReturnValue('redis://localhost:6379') } as unknown as ConfigService;
    const service = new DashboardSyncQueueService(configService);

    await service.enqueueUserSync('user-123');
    await service.enqueueUserSync('user-123');

    expect(addMock).toHaveBeenCalledTimes(2);
    expect(addMock.mock.calls[0][2]).toEqual(
      expect.objectContaining({
        deduplication: { id: 'dashboard-sync-user-123' },
      }),
    );
    expect(addMock.mock.calls[0][2]).not.toHaveProperty('jobId');
    expect(addMock.mock.calls[1][2]).toEqual(
      expect.objectContaining({
        deduplication: { id: 'dashboard-sync-user-123' },
      }),
    );
  });

  it('keeps the retry and backoff settings configured', async () => {
    const configService = { get: vi.fn().mockReturnValue('redis://localhost:6379') } as unknown as ConfigService;
    const service = new DashboardSyncQueueService(configService);

    await service.enqueueUserSync('user-42');

    expect(addMock).toHaveBeenCalledWith(
      'dashboard-sync',
      { userId: 'user-42' },
      expect.objectContaining({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 50 },
        deduplication: { id: 'dashboard-sync-user-42' },
      }),
    );
  });

  it('closes the queue exactly once during module destruction', async () => {
    const configService = { get: vi.fn().mockReturnValue('redis://localhost:6379') } as unknown as ConfigService;
    const service = new DashboardSyncQueueService(configService);

    await service.onModuleDestroy();
    await service.onModuleDestroy();

    expect(closeMock).toHaveBeenCalledTimes(2);
  });
});
