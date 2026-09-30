import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { DashboardSyncProcessor } from './queue/dashboard-sync-processor.service.js';
import { WorkerModule } from './worker.module.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const configService = app.get(ConfigService);
  const processor = app.get(DashboardSyncProcessor);
  const logger = new Logger('DashboardWorker');

  const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379');

  const worker = new Worker(
    'dashboard-sync',
    async (job) => {
      const userId = job.data?.userId;
      if (!userId || typeof userId !== 'string') {
        throw new Error('Dashboard sync job is missing a userId');
      }

      await processor.process(userId);
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
