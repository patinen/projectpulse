import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { GitHubModule } from '../github/github.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { DashboardAggregationService } from './dashboard-aggregation.service.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardSnapshotService } from './dashboard-snapshot.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, GitHubModule, QueueModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardAggregationService, DashboardSnapshotService],
  exports: [DashboardService, DashboardAggregationService, DashboardSnapshotService],
})
export class DashboardModule {}
