import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { DashboardAggregationService } from './dashboard-aggregation.service.js';
import { DashboardSnapshotService } from './dashboard-snapshot.service.js';
import type { DashboardResponse } from './dashboard.types.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardAggregationService: DashboardAggregationService,
    private readonly dashboardSnapshotService: DashboardSnapshotService,
  ) {}

  async getDashboard(userId: string): Promise<DashboardResponse> {
    const existingSnapshot = await this.dashboardSnapshotService.getLatestSnapshot(userId);
    if (existingSnapshot) {
      return existingSnapshot;
    }

    const trackedRepositories = await this.prisma.trackedRepository.findMany({
      where: { userId },
      select: { repository: { select: { id: true } } },
    });

    if (trackedRepositories.length === 0) {
      return this.emptyDashboard();
    }

    const liveDashboard = await this.dashboardAggregationService.buildDashboard(userId);
    await this.dashboardSnapshotService.saveSnapshot(userId, liveDashboard);
    return liveDashboard;
  }

  private emptyDashboard(): DashboardResponse {
    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        openIssues: 0,
        openPullRequests: 0,
        commits7d: 0,
        activeContributors30d: 0,
      },
      repositories: [],
      recentActivity: [],
    };
  }
}
