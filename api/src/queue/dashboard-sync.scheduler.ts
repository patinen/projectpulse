import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service.js';
import { DashboardSyncQueueService } from './dashboard-sync-queue.service.js';

@Injectable()
export class DashboardSyncScheduler {
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
      await this.dashboardSyncQueueService.enqueueUserSync(user.userId);
    }
  }
}
