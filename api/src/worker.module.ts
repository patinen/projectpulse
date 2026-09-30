import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { GitHubModule } from './github/github.module.js';
import { DashboardAggregationService } from './dashboard/dashboard-aggregation.service.js';
import { DashboardSnapshotService } from './dashboard/dashboard-snapshot.service.js';
import { DashboardSyncProcessor } from './queue/dashboard-sync-processor.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    GitHubModule,
  ],
  providers: [DashboardAggregationService, DashboardSnapshotService, DashboardSyncProcessor],
})
export class WorkerModule {}
