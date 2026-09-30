import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { TrackRepositoryDto } from './dto/track-repository.dto.js';
import { RepositoryAnalyticsService } from './repository-analytics.service.js';
import { RepositoryService } from './repositories.service.js';

@UseGuards(AuthGuard)
@Controller('repositories')
export class RepositoriesController {
  constructor(
    private readonly repositoryService: RepositoryService,
    private readonly repositoryAnalyticsService: RepositoryAnalyticsService,
  ) {}

  @Get()
  async listRepositories(@Req() request: Request & { user: AuthenticatedUser }) {
    const repositories = await this.repositoryService.getRepositoriesForUser(request.user.id);

    return { repositories };
  }

  @Get(':githubId/analytics')
  async getRepositoryAnalytics(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('githubId') githubId: string,
    @Query('range') range?: string,
  ) {
    return this.repositoryAnalyticsService.getAnalytics(request.user.id, githubId, range ?? '30d');
  }

  @Post(':githubId/track')
  async trackRepository(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('githubId') githubId: string,
    @Body() body: TrackRepositoryDto,
  ) {
    if (body?.githubId && body.githubId !== githubId) {
      throw new BadRequestException('Repository identity does not match the route');
    }

    return this.repositoryService.trackRepository(request.user.id, githubId);
  }

  @Delete(':githubId/track')
  @HttpCode(HttpStatus.NO_CONTENT)
  async untrackRepository(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('githubId') githubId: string,
  ) {
    await this.repositoryService.untrackRepository(request.user.id, githubId);
    return;
  }
}
