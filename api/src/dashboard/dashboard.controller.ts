import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { DashboardService } from './dashboard.service.js';

@UseGuards(AuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.dashboardService.getDashboard(request.user.id);
  }
}
