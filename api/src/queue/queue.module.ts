import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { DashboardSyncQueueService } from './dashboard-sync-queue.service.js';
import { DashboardSyncScheduler } from './dashboard-sync.scheduler.js';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [DashboardSyncQueueService, DashboardSyncScheduler],
  exports: [DashboardSyncQueueService],
})
export class QueueModule {}
