import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

@Injectable()
export class DashboardSyncQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(DashboardSyncQueueService.name);
  private readonly queue: Queue;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.queue = new Queue('dashboard-sync', {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 50 },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  async enqueueUserSync(userId: string): Promise<void> {
    await this.queue.add(
      'dashboard-sync',
      { userId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 50 },
        deduplication: {
          id: `dashboard-sync-${userId}`,
        },
      },
    );
  }
}
