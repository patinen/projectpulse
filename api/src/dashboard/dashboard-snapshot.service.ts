import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import type { DashboardResponse } from './dashboard.types.js';

@Injectable()
export class DashboardSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async saveSnapshot(userId: string, dashboard: DashboardResponse) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.dashboardSnapshot.create({
        data: {
          userId,
          openIssues: dashboard.metrics.openIssues,
          openPullRequests: dashboard.metrics.openPullRequests,
          commits7d: dashboard.metrics.commits7d,
          activeContributors30d: dashboard.metrics.activeContributors30d,
          recentActivity: dashboard.recentActivity as Prisma.InputJsonValue,
          capturedAt: new Date(dashboard.generatedAt),
        },
      });

      const rows = await Promise.all(
        dashboard.repositories.map(async (repository) => {
          const repositoryRecord = await tx.repository.findUnique({
            where: { githubId: repository.githubId },
            select: { id: true },
          });

          if (!repositoryRecord) {
            return null;
          }

          return {
            dashboardSnapshotId: snapshot.id,
            repositoryId: repositoryRecord.id,
            fullName: repository.fullName,
            language: repository.language,
            openIssues: repository.openIssues,
            openPullRequests: repository.openPullRequests,
            commits7d: repository.commits7d,
            lastActivityAt: repository.lastActivityAt ? new Date(repository.lastActivityAt) : null,
          };
        }),
      );

      const validRows = rows.filter((row): row is NonNullable<typeof row> => row !== null);
      if (validRows.length > 0) {
        await tx.repositoryMetricSnapshot.createMany({
          data: validRows,
        });
      }

      return snapshot;
    });
  }

  async getLatestSnapshot(userId: string): Promise<DashboardResponse | null> {
    const snapshot = await this.prisma.dashboardSnapshot.findFirst({
      where: { userId },
      orderBy: { capturedAt: 'desc' },
      include: {
        repositories: {
          include: {
            repository: {
              select: { githubId: true },
            },
          },
        },
      },
    });

    if (!snapshot) {
      return null;
    }

    return {
      generatedAt: snapshot.capturedAt.toISOString(),
      metrics: {
        openIssues: snapshot.openIssues,
        openPullRequests: snapshot.openPullRequests,
        commits7d: snapshot.commits7d,
        activeContributors30d: snapshot.activeContributors30d,
      },
      repositories: snapshot.repositories.map((entry) => {
        const lastActivityAt = entry.lastActivityAt instanceof Date
          ? entry.lastActivityAt.toISOString()
          : typeof entry.lastActivityAt === 'string' && entry.lastActivityAt
            ? new Date(entry.lastActivityAt).toISOString()
            : null;

        return {
          githubId: entry.repository?.githubId ?? '',
          fullName: entry.fullName,
          language: entry.language,
          openIssues: entry.openIssues,
          openPullRequests: entry.openPullRequests,
          commits7d: entry.commits7d,
          lastActivityAt,
        };
      }),
      recentActivity: Array.isArray(snapshot.recentActivity) ? (snapshot.recentActivity as Array<DashboardResponse['recentActivity'][number]>) : [],
    };
  }
}
