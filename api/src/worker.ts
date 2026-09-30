import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { AppModule } from './app.module.js';
import { DashboardAggregationService } from './dashboard/dashboard-aggregation.service.js';
import { DashboardSnapshotService } from './dashboard/dashboard-snapshot.service.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configService = app.get(ConfigService);
  const aggregationService = app.get(DashboardAggregationService);
  const snapshotService = app.get(DashboardSnapshotService);
  const logger = new Logger('DashboardWorker');

  const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379');

  const worker = new Worker(
    'dashboard-sync',
    async (job) => {
      const userId = job.data?.userId;
      if (!userId || typeof userId !== 'string') {
        throw new Error('Dashboard sync job is missing a userId');
      }

      const dashboard = await aggregationService.buildDashboard(userId);
      await snapshotService.saveSnapshot(userId, dashboard);
      logger.log(`Synced dashboard snapshot for user ${userId}`);
    },
    {
      connection: { url: redisUrl },
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 50 },
    },
  );

  worker.on('completed', (job) => {
    logger.log(`Dashboard sync completed for job ${job.id}`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`Dashboard sync failed for job ${job?.id}: ${error.message}`);
  });

  const shutdown = async () => {
    await worker.close();
    await app.close();
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

void bootstrap();
