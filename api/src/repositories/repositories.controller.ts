import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { TrackRepositoryDto } from './dto/track-repository.dto.js';
import { RepositoryService } from './repositories.service.js';

@UseGuards(AuthGuard)
@Controller('repositories')
export class RepositoriesController {
  constructor(private readonly repositoryService: RepositoryService) {}

  @Get()
  async listRepositories(@Req() request: Request & { user: AuthenticatedUser }) {
    const repositories = await this.repositoryService.getRepositoriesForUser(request.user.id);

    return { repositories };
  }

  @Post(':githubId/track')
  async trackRepository(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('githubId') githubId: string,
    @Body() body: TrackRepositoryDto,
  ) {
    const payload = Object.assign({}, body, { githubId });

    if (body.githubId !== githubId) {
      return this.repositoryService.trackRepository(request.user.id, payload);
    }

    return this.repositoryService.trackRepository(request.user.id, body);
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
