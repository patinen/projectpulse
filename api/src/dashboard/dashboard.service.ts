import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { GitHubService } from '../github/github.service.js';
import type {
  DashboardActivity,
  DashboardRepositorySummary,
  DashboardResponse,
} from './dashboard.types.js';

type TrackedRepositoryRef = {
  githubId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
};

type RepositorySnapshot = {
  repository: DashboardRepositorySummary;
  recentActivity: DashboardActivity[];
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GitHubService,
  ) {}

  async getDashboard(userId: string): Promise<DashboardResponse> {
    const trackedRepositories = await this.prisma.trackedRepository.findMany({
      where: { userId },
      select: {
        repository: {
          select: {
            githubId: true,
            owner: true,
            name: true,
            fullName: true,
            defaultBranch: true,
          },
        },
      },
    });

    if (trackedRepositories.length === 0) {
      return {
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

    const repositories = trackedRepositories.map((entry) => entry.repository);
    const snapshots = await Promise.all(
      repositories.map(async (repo) => this.getRepositorySnapshot(userId, repo).catch((error) => {
        if (this.shouldSkipMissingRepository(error)) {
          return null;
        }

        throw error;
      })),
    );

    const validSnapshots = snapshots.filter((entry): entry is RepositorySnapshot => entry !== null);

    const metrics = validSnapshots.reduce(
      (accumulator, snapshot) => {
        const repo = snapshot.repository;
        accumulator.openIssues += repo.openIssues;
        accumulator.openPullRequests += repo.openPullRequests;
        accumulator.commits7d += repo.commits7d;
        return accumulator;
      },
      {
        openIssues: 0,
        openPullRequests: 0,
        commits7d: 0,
        activeContributors30d: 0,
      },
    );

    const contributorLogins = new Set<string>();
    for (const snapshot of validSnapshots) {
      for (const event of snapshot.recentActivity) {
        if (event.kind === 'commit pushed' && event.actor) {
          contributorLogins.add(event.actor);
        }
      }
    }
    metrics.activeContributors30d = contributorLogins.size;

    const normalizedActivity = validSnapshots
      .flatMap((snapshot) => snapshot.recentActivity)
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, 10);

    return {
      metrics,
      repositories: validSnapshots.map((snapshot) => snapshot.repository),
      recentActivity: normalizedActivity,
    };
  }

  private async getRepositorySnapshot(
    userId: string,
    repository: TrackedRepositoryRef,
  ): Promise<RepositorySnapshot> {
    const [issues, openPullRequests, commits, metadata, mergedPullRequests] = await Promise.all([
      this.githubService.listRepositoryIssues(userId, repository.owner, repository.name),
      this.githubService.listOpenPullRequests(userId, repository.owner, repository.name),
      this.githubService.listRepositoryCommits(userId, repository.owner, repository.name, this.getDateDaysAgo(30)),
      this.githubService.getRepositoryMetadata(userId, repository.owner, repository.name),
      this.githubService.listRecentMergedPullRequests(userId, repository.owner, repository.name),
    ]);

    const sevenDaysAgo = this.getDateDaysAgo(7);
    const commits7d = commits.filter((commit) => new Date(commit.occurredAt).getTime() >= sevenDaysAgo.getTime()).length;

    const repositorySummary: DashboardRepositorySummary = {
      githubId: repository.githubId,
      fullName: repository.fullName,
      language: metadata.language ?? null,
      openIssues: issues.length,
      openPullRequests: openPullRequests.length,
      commits7d,
      lastActivityAt: this.getLastActivityTimestamp([
        ...issues.map((issue) => issue.createdAt),
        ...openPullRequests.map((pullRequest) => pullRequest.createdAt),
        ...mergedPullRequests.map((pullRequest) => pullRequest.mergedAt),
        ...commits.map((commit) => commit.occurredAt),
      ]),
    };

    const recentActivity = [
      ...issues.map((issue) => ({
        id: `issue:${repository.fullName}:${issue.id}`,
        kind: 'issue opened' as const,
        repository: repository.fullName,
        title: issue.title,
        actor: issue.userLogin,
        occurredAt: issue.createdAt,
        url: issue.htmlUrl,
      })),
      ...mergedPullRequests.map((pullRequest) => ({
        id: `pr:${repository.fullName}:${pullRequest.id}`,
        kind: 'pull request merged' as const,
        repository: repository.fullName,
        title: pullRequest.title,
        actor: pullRequest.userLogin,
        occurredAt: pullRequest.mergedAt,
        url: pullRequest.htmlUrl,
      })),
      ...commits.map((commit) => ({
        id: `commit:${repository.fullName}:${commit.sha}`,
        kind: 'commit pushed' as const,
        repository: repository.fullName,
        title: this.getFirstLine(commit.message),
        actor: commit.authorLogin,
        occurredAt: commit.occurredAt,
        url: commit.htmlUrl,
      })),
    ].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, 10);

    return {
      repository: repositorySummary,
      recentActivity,
    };
  }

  private shouldSkipMissingRepository(error: unknown): boolean {
    if (error instanceof NotFoundException) {
      return true;
    }

    if (typeof error === 'object' && error !== null) {
      const status = 'status' in error ? Number((error as { status?: number }).status) : undefined;
      if (status === 404) {
        return true;
      }

      const message = 'message' in error ? String((error as { message?: string }).message ?? '') : '';
      if (message.toLowerCase().includes('not found')) {
        return true;
      }
    }

    return false;
  }

  private getDateDaysAgo(days: number): Date {
    const timestamp = Date.now() - days * 24 * 60 * 60 * 1000;
    return new Date(timestamp);
  }

  private getLastActivityTimestamp(values: Array<string | null | undefined>): string | null {
    const validDates = values
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((timestamp) => Number.isFinite(timestamp));

    if (validDates.length === 0) {
      return null;
    }

    return new Date(Math.max(...validDates)).toISOString();
  }

  private getFirstLine(value: string): string {
    return value.split(/\r?\n/)[0]?.trim() || value;
  }
}
