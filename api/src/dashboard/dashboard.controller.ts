import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { DashboardSyncQueueService } from '../queue/dashboard-sync-queue.service.js';
import { DashboardService } from './dashboard.service.js';

@UseGuards(AuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly dashboardSyncQueueService: DashboardSyncQueueService,
  ) {}

  @Get()
  async getDashboard(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.dashboardService.getDashboard(request.user.id);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  async refreshDashboard(@Req() request: Request & { user: AuthenticatedUser }) {
    try {
      await this.dashboardSyncQueueService.enqueueUserSync(request.user.id);
      return { status: 'queued' };
    } catch {
      throw new ServiceUnavailableException('Dashboard refresh could not be queued right now.');
    }
  }
}
