import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { ActivityService } from './activity.service.js';

@UseGuards(AuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async getActivity(
    @Req() request: Request & { user: AuthenticatedUser },
    @Query('range') range?: string,
    @Query('kind') kind?: string,
    @Query('repository') repository?: string,
  ) {
    return this.activityService.getActivity(request.user.id, {
      range,
      kind,
      repository,
    });
  }
}
