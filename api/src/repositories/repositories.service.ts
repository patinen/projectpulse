import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { GitHubService, type GitHubRepositorySummary } from '../github/github.service.js';
import { DashboardSyncQueueService } from '../queue/dashboard-sync-queue.service.js';

export type RepositoryListItem = GitHubRepositorySummary & {
  tracked: boolean;
};

@Injectable()
export class RepositoryService {
  private readonly logger = new Logger(RepositoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GitHubService,
    private readonly dashboardSyncQueueService?: DashboardSyncQueueService,
  ) {}

  async getRepositoriesForUser(userId: string): Promise<RepositoryListItem[]> {
    const [githubRepositories, trackedRepositories] = await Promise.all([
      this.githubService.listPublicRepositoriesForUser(userId),
      this.prisma.trackedRepository.findMany({
        where: { userId },
        select: {
          repository: {
            select: {
              githubId: true,
            },
          },
        },
      }),
    ]);

    const trackedGithubIds = new Set(
      trackedRepositories
        .map((entry) => entry.repository.githubId)
        .filter(Boolean),
    );

    return githubRepositories.map((repository) => ({
      ...repository,
      tracked: trackedGithubIds.has(repository.githubId),
    }));
  }

  async trackRepository(userId: string, githubId: string): Promise<RepositoryListItem> {
    const githubRepositories = await this.githubService.listPublicRepositoriesForUser(userId);
    const githubRepository = githubRepositories.find((repository) => repository.githubId === githubId);

    if (!githubRepository) {
      throw new BadRequestException('Repository was not found in the authenticated user’s public GitHub repositories');
    }

    if (githubRepository.private) {
      throw new BadRequestException('Private repositories are not supported yet.');
    }

    const repository = await this.prisma.repository.upsert({
      where: { githubId },
      update: {
        owner: githubRepository.owner,
        name: githubRepository.name,
        fullName: githubRepository.fullName,
        private: githubRepository.private,
        defaultBranch: githubRepository.defaultBranch,
      },
      create: {
        githubId,
        owner: githubRepository.owner,
        name: githubRepository.name,
        fullName: githubRepository.fullName,
        private: githubRepository.private,
        defaultBranch: githubRepository.defaultBranch,
      },
    });

    await this.prisma.trackedRepository.upsert({
      where: {
        userId_repositoryId: {
          userId,
          repositoryId: repository.id,
        },
      },
      update: {},
      create: {
        userId,
        repositoryId: repository.id,
      },
    });

    await this.enqueueDashboardRefresh(userId);

    return {
      ...githubRepository,
      tracked: true,
    };
  }

  async untrackRepository(userId: string, githubId: string): Promise<void> {
    const repository = await this.prisma.repository.findUnique({
      where: { githubId },
      select: { id: true },
    });

    if (!repository) {
      return;
    }

    await this.prisma.trackedRepository.deleteMany({
      where: {
        userId,
        repositoryId: repository.id,
      },
    });

    await this.enqueueDashboardRefresh(userId);
  }

  private async enqueueDashboardRefresh(userId: string): Promise<void> {
    if (!this.dashboardSyncQueueService) {
      return;
    }

    try {
      await this.dashboardSyncQueueService.enqueueUserSync(userId);
    } catch (error) {
      this.logger.warn(`Queued dashboard refresh failed for user ${userId}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
