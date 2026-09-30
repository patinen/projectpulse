import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

@Injectable()
export class DashboardSyncQueueService {
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
        removeOnFail: { count: 20 },
      },
    });
  }

  async enqueueUserSync(userId: string): Promise<void> {
    try {
      await this.queue.add(
        'dashboard-sync',
        { userId },
        {
          jobId: `dashboard-sync-${userId}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 30000,
          },
          removeOnComplete: { count: 20 },
          removeOnFail: { count: 20 },
        },
      );
    } catch (error) {
      this.logger.warn(`Dashboard sync queue failed for user ${userId}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
