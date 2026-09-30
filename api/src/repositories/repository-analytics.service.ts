import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export type RepositoryAnalyticsRange = '7d' | '30d' | '90d';

export type RepositoryAnalyticsPoint = {
  capturedAt: string;
  openIssues: number;
  openPullRequests: number;
  commits7d: number;
};

export type RepositoryAnalyticsCurrent = {
  openIssues: number;
  openPullRequests: number;
  commits7d: number;
  lastActivityAt: string | null;
  capturedAt: string;
};

export type RepositoryAnalyticsResponse = {
  repository: {
    githubId: string;
    fullName: string;
    language: string | null;
  };
  range: {
    value: RepositoryAnalyticsRange;
    from: string;
    to: string;
  };
  current: RepositoryAnalyticsCurrent | null;
  history: RepositoryAnalyticsPoint[];
};

@Injectable()
export class RepositoryAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(
    userId: string,
    githubId: string,
    rangeValue: string = '30d',
  ): Promise<RepositoryAnalyticsResponse> {
    const range = this.normalizeRange(rangeValue);
    const trackedRepository = await this.prisma.trackedRepository.findFirst({
      where: {
        userId,
        repository: {
          is: {
            githubId,
          },
        },
      },
      select: {
        repository: {
          select: {
            githubId: true,
            fullName: true,
            language: true,
          },
        },
      },
    });

    if (!trackedRepository) {
      throw new NotFoundException('Repository is not tracked for this user.');
    }

    const repository = trackedRepository.repository;
    const latestSnapshot = await this.prisma.repositoryMetricSnapshot.findFirst({
      where: {
        repository: {
          is: {
            githubId,
          },
        },
        dashboardSnapshot: {
          is: {
            userId,
          },
        },
      },
      orderBy: {
        dashboardSnapshot: {
          capturedAt: 'desc',
        },
      },
      include: {
        dashboardSnapshot: {
          select: {
            capturedAt: true,
          },
        },
      },
    });

    const rangeFrom = new Date(Date.now() - this.getRangeDays(range) * 24 * 60 * 60 * 1000);
    const rangeSnapshots = await this.prisma.repositoryMetricSnapshot.findMany({
      where: {
        repository: {
          is: {
            githubId,
          },
        },
        dashboardSnapshot: {
          is: {
            userId,
            capturedAt: {
              gte: rangeFrom,
            },
          },
        },
      },
      include: {
        dashboardSnapshot: {
          select: {
            capturedAt: true,
          },
        },
      },
      orderBy: [
        { dashboardSnapshot: { capturedAt: 'asc' } },
        { id: 'asc' },
      ],
    });

    const current = latestSnapshot
      ? {
          openIssues: latestSnapshot.openIssues,
          openPullRequests: latestSnapshot.openPullRequests,
          commits7d: latestSnapshot.commits7d,
          lastActivityAt: latestSnapshot.lastActivityAt ? latestSnapshot.lastActivityAt.toISOString() : null,
          capturedAt: latestSnapshot.dashboardSnapshot.capturedAt.toISOString(),
        }
      : null;

    const history = this.reduceDailyHistory(rangeSnapshots);

    return {
      repository: {
        githubId: repository.githubId,
        fullName: repository.fullName,
        language: repository.language,
      },
      range: {
        value: range,
        from: rangeFrom.toISOString(),
        to: new Date().toISOString(),
      },
      current,
      history,
    };
  }

  private normalizeRange(rangeValue: string): RepositoryAnalyticsRange {
    if (rangeValue === '7d' || rangeValue === '30d' || rangeValue === '90d') {
      return rangeValue;
    }

    throw new BadRequestException('Unsupported analytics range. Use 7d, 30d, or 90d.');
  }

  private getRangeDays(range: RepositoryAnalyticsRange): number {
    switch (range) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      default:
        return 30;
    }
  }

  private reduceDailyHistory(rows: Array<{
    openIssues: number;
    openPullRequests: number;
    commits7d: number;
    dashboardSnapshot: {
      capturedAt: Date;
    };
  }>): RepositoryAnalyticsPoint[] {
    const newestByDay = new Map<string, RepositoryAnalyticsPoint>();

    for (const row of rows) {
      const date = new Date(row.dashboardSnapshot.capturedAt);
      const dayKey = date.toISOString().slice(0, 10);
      const point: RepositoryAnalyticsPoint = {
        capturedAt: date.toISOString(),
        openIssues: row.openIssues,
        openPullRequests: row.openPullRequests,
        commits7d: row.commits7d,
      };

      const existing = newestByDay.get(dayKey);
      if (!existing || new Date(point.capturedAt).getTime() >= new Date(existing.capturedAt).getTime()) {
        newestByDay.set(dayKey, point);
      }
    }

    return [...newestByDay.values()].sort(
      (left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime(),
    );
  }
}
