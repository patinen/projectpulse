import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service.js';
import { DashboardSyncQueueService } from './dashboard-sync-queue.service.js';

@Injectable()
export class DashboardSyncScheduler {
  private readonly logger = new Logger(DashboardSyncScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardSyncQueueService: DashboardSyncQueueService,
  ) {}

  @Cron('*/15 * * * *')
  async syncTrackedUsers() {
    const userIds = await this.prisma.trackedRepository.groupBy({
      by: ['userId'],
    });

    for (const user of userIds) {
      try {
        await this.dashboardSyncQueueService.enqueueUserSync(user.userId);
      } catch (error) {
        this.logger.warn(
          `Skipping dashboard sync enqueue for user ${user.userId}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
  }
}
