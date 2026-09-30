import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { GitHubModule } from '../github/github.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { RepositoriesController } from './repositories.controller.js';
import { RepositoryService } from './repositories.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, GitHubModule, QueueModule],
  controllers: [RepositoriesController],
  providers: [RepositoryService],
  exports: [RepositoryService],
})
export class RepositoriesModule {}
