import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GitHubService } from './github.service.js';

@Module({
  imports: [AuthModule],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}
