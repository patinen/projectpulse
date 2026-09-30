import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { GitHubModule } from '../github/github.module.js';
import { RepositoriesController } from './repositories.controller.js';
import { RepositoryService } from './repositories.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, GitHubModule],
  controllers: [RepositoriesController],
  providers: [RepositoryService],
  exports: [RepositoryService],
})
export class RepositoriesModule {}
