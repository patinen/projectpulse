import { Injectable } from '@nestjs/common';
import { DashboardAggregationService } from '../dashboard/dashboard-aggregation.service.js';
import { DashboardSnapshotService } from '../dashboard/dashboard-snapshot.service.js';

@Injectable()
export class DashboardSyncProcessor {
  constructor(
    private readonly dashboardAggregationService: DashboardAggregationService,
    private readonly dashboardSnapshotService: DashboardSnapshotService,
  ) {}

  async process(userId: string): Promise<void> {
    const dashboard = await this.dashboardAggregationService.buildDashboard(userId);
    await this.dashboardSnapshotService.saveSnapshot(userId, dashboard);
  }
}
