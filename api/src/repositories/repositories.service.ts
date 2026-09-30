import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { GitHubService, type GitHubRepositorySummary } from '../github/github.service.js';
import type { TrackRepositoryDto } from './dto/track-repository.dto.js';

export type RepositoryListItem = GitHubRepositorySummary & {
  tracked: boolean;
};

@Injectable()
export class RepositoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GitHubService,
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

  async trackRepository(userId: string, dto: TrackRepositoryDto): Promise<RepositoryListItem> {
    if (dto.private) {
      throw new BadRequestException('Private repositories are not supported yet.');
    }

    const repository = await this.prisma.repository.upsert({
      where: { githubId: dto.githubId },
      update: {
        owner: dto.owner,
        name: dto.name,
        fullName: dto.fullName,
        private: false,
        defaultBranch: dto.defaultBranch,
      },
      create: {
        githubId: dto.githubId,
        owner: dto.owner,
        name: dto.name,
        fullName: dto.fullName,
        private: false,
        defaultBranch: dto.defaultBranch,
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

    return {
      githubId: repository.githubId,
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      private: repository.private,
      defaultBranch: repository.defaultBranch,
      htmlUrl: `https://github.com/${repository.fullName}`,
      description: null,
      language: null,
      stars: 0,
      forks: 0,
      updatedAt: new Date().toISOString(),
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
  }
}
