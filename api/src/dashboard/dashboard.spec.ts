import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../auth/auth.guard.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService', () => {
  it('returns zero metrics and empty arrays when no repositories are tracked', async () => {
    const prisma: any = {
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const githubService: any = {};
    const service = new DashboardService(prisma, githubService);

    await expect(service.getDashboard('user-1')).resolves.toEqual({
      metrics: {
        openIssues: 0,
        openPullRequests: 0,
        commits7d: 0,
        activeContributors30d: 0,
      },
      repositories: [],
      recentActivity: [],
    });
  });

  it('aggregates metrics and recent activity across tracked repositories', async () => {
    const prisma: any = {
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([
          {
            repository: {
              githubId: '1',
              owner: 'octo',
              name: 'alpha',
              fullName: 'octo/alpha',
              defaultBranch: 'main',
            },
          },
          {
            repository: {
              githubId: '2',
              owner: 'octo',
              name: 'beta',
              fullName: 'octo/beta',
              defaultBranch: 'main',
            },
          },
        ]),
      },
    };

    const githubService: any = {
      listRepositoryIssues: vi.fn()
        .mockResolvedValueOnce([
          { id: 11, number: 1, title: 'Issue one', htmlUrl: 'https://example.com/1', createdAt: '2026-09-15T00:00:00Z', userLogin: 'alice' },
          { id: 12, number: 2, title: 'Issue two', htmlUrl: 'https://example.com/2', createdAt: '2026-09-20T00:00:00Z', userLogin: 'bob' },
        ])
        .mockResolvedValueOnce([
          { id: 21, number: 3, title: 'Issue three', htmlUrl: 'https://example.com/3', createdAt: '2026-09-10T00:00:00Z', userLogin: 'carol' },
        ]),
      listOpenPullRequests: vi.fn()
        .mockResolvedValueOnce([
          { id: 101, number: 1, title: 'PR one', htmlUrl: 'https://example.com/pr/1', createdAt: '2026-09-14T00:00:00Z', userLogin: 'alice', state: 'open', mergedAt: null },
          { id: 102, number: 2, title: 'PR two', htmlUrl: 'https://example.com/pr/2', createdAt: '2026-09-16T00:00:00Z', userLogin: 'bob', state: 'open', mergedAt: null },
        ])
        .mockResolvedValueOnce([
          { id: 201, number: 4, title: 'PR three', htmlUrl: 'https://example.com/pr/3', createdAt: '2026-09-18T00:00:00Z', userLogin: 'dana', state: 'open', mergedAt: null },
        ]),
      listRepositoryCommits: vi.fn()
        .mockResolvedValueOnce([
          { sha: 'aaa', htmlUrl: 'https://example.com/commit/aaa', message: 'First commit', occurredAt: '2026-09-29T10:00:00Z', authorLogin: 'alice' },
          { sha: 'bbb', htmlUrl: 'https://example.com/commit/bbb', message: 'Second commit', occurredAt: '2026-09-26T10:00:00Z', authorLogin: null },
          { sha: 'ccc', htmlUrl: 'https://example.com/commit/ccc', message: 'Old commit', occurredAt: '2026-08-28T10:00:00Z', authorLogin: 'dana' },
        ])
        .mockResolvedValueOnce([
          { sha: 'ddd', htmlUrl: 'https://example.com/commit/ddd', message: 'Other commit', occurredAt: '2026-09-27T10:00:00Z', authorLogin: 'alice' },
        ]),
      listRecentMergedPullRequests: vi.fn()
        .mockResolvedValueOnce([
          { id: 1001, title: 'Merged A', htmlUrl: 'https://example.com/pr/merge-a', mergedAt: '2026-09-28T00:00:00Z', userLogin: 'alice' },
        ])
        .mockResolvedValueOnce([]),
      getRepositoryMetadata: vi.fn()
        .mockResolvedValueOnce({ language: 'TypeScript' })
        .mockResolvedValueOnce({ language: 'Go' }),
    };

    const service = new DashboardService(prisma, githubService);
    const dashboard = await service.getDashboard('user-1');

    expect(dashboard.metrics).toEqual({
      openIssues: 3,
      openPullRequests: 3,
      commits7d: 3,
      activeContributors30d: 2,
    });
    expect(dashboard.recentActivity.length).toBeLessThanOrEqual(10);
    expect(dashboard.recentActivity[0]?.kind).toBe('commit pushed');
    expect(dashboard.repositories[0]).toMatchObject({
      githubId: '1',
      fullName: 'octo/alpha',
      language: 'TypeScript',
      openIssues: 2,
      openPullRequests: 2,
      commits7d: 2,
    });
  });

  it('active contributors are derived from all 30-day commits, not truncated activity', async () => {
    const prisma: any = {
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([
          {
            repository: {
              githubId: '1',
              owner: 'octo',
              name: 'alpha',
              fullName: 'octo/alpha',
              defaultBranch: 'main',
            },
          },
        ]),
      },
    };

    const commitAuthors = Array.from({ length: 12 }, (_, index) => `author-${index + 1}`);
    const githubService: any = {
      listRepositoryIssues: vi.fn().mockResolvedValue([]),
      listOpenPullRequests: vi.fn().mockResolvedValue([]),
      listRepositoryCommits: vi.fn().mockResolvedValue(
        commitAuthors.map((login, index) => ({
          sha: `sha-${index + 1}`,
          htmlUrl: `https://example.com/${index + 1}`,
          message: `Commit ${index + 1}`,
          occurredAt: '2026-09-29T00:00:00Z',
          authorLogin: login,
        })),
      ),
      listRecentMergedPullRequests: vi.fn().mockResolvedValue([]),
      getRepositoryMetadata: vi.fn().mockResolvedValue({ language: 'TypeScript' }),
    };

    const service = new DashboardService(prisma, githubService);
    const dashboard = await service.getDashboard('user-1');

    expect(dashboard.metrics.activeContributors30d).toBe(12);
    expect(dashboard.recentActivity.length).toBeLessThanOrEqual(10);
    expect(dashboard.recentActivity.length).toBe(10);
  });

  it('null commit authors are excluded and duplicate logins count once across repositories', async () => {
    const prisma: any = {
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([
          {
            repository: {
              githubId: '1',
              owner: 'octo',
              name: 'alpha',
              fullName: 'octo/alpha',
              defaultBranch: 'main',
            },
          },
          {
            repository: {
              githubId: '2',
              owner: 'octo',
              name: 'beta',
              fullName: 'octo/beta',
              defaultBranch: 'main',
            },
          },
        ]),
      },
    };

    const githubService: any = {
      listRepositoryIssues: vi.fn().mockResolvedValue([]),
      listOpenPullRequests: vi.fn().mockResolvedValue([]),
      listRepositoryCommits: vi.fn()
        .mockResolvedValueOnce([
          { sha: 'a1', htmlUrl: 'https://example.com/a1', message: 'A1', occurredAt: '2026-09-29T00:00:00Z', authorLogin: 'alice' },
          { sha: 'a2', htmlUrl: 'https://example.com/a2', message: 'A2', occurredAt: '2026-09-28T00:00:00Z', authorLogin: null },
          { sha: 'a3', htmlUrl: 'https://example.com/a3', message: 'A3', occurredAt: '2026-09-27T00:00:00Z', authorLogin: 'alice' },
        ])
        .mockResolvedValueOnce([
          { sha: 'b1', htmlUrl: 'https://example.com/b1', message: 'B1', occurredAt: '2026-09-26T00:00:00Z', authorLogin: 'alice' },
          { sha: 'b2', htmlUrl: 'https://example.com/b2', message: 'B2', occurredAt: '2026-09-25T00:00:00Z', authorLogin: 'bob' },
          { sha: 'b3', htmlUrl: 'https://example.com/b3', message: 'B3', occurredAt: '2026-09-24T00:00:00Z', authorLogin: null },
        ]),
      listRecentMergedPullRequests: vi.fn().mockResolvedValue([]),
      getRepositoryMetadata: vi.fn().mockResolvedValue({ language: 'TypeScript' }),
    };

    const service = new DashboardService(prisma, githubService);
    const dashboard = await service.getDashboard('user-1');

    expect(dashboard.metrics.activeContributors30d).toBe(2);
    expect(dashboard.metrics.activeContributors30d).not.toBe(3);
  });

  it('skips deleted repositories without failing the whole dashboard', async () => {
    const prisma: any = {
      trackedRepository: {
        findMany: vi.fn().mockResolvedValue([
          {
            repository: {
              githubId: '1',
              owner: 'octo',
              name: 'alpha',
              fullName: 'octo/alpha',
              defaultBranch: 'main',
            },
          },
          {
            repository: {
              githubId: '2',
              owner: 'octo',
              name: 'beta',
              fullName: 'octo/beta',
              defaultBranch: 'main',
            },
          },
        ]),
      },
    };

    const githubService: any = {
      listRepositoryIssues: vi.fn()
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce([]),
      listOpenPullRequests: vi.fn().mockResolvedValue([]),
      listRepositoryCommits: vi.fn().mockResolvedValue([]),
      listRecentMergedPullRequests: vi.fn().mockResolvedValue([]),
      getRepositoryMetadata: vi.fn().mockResolvedValue({ language: 'TypeScript' }),
    };

    const service = new DashboardService(prisma, githubService);
    const dashboard = await service.getDashboard('user-1');

    expect(dashboard.metrics).toEqual({
      openIssues: 0,
      openPullRequests: 0,
      commits7d: 0,
      activeContributors30d: 0,
    });
    expect(dashboard.repositories).toHaveLength(1);
  });
});

describe('DashboardController', () => {
  it('controller-level AuthGuard metadata is present', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, DashboardController);

    expect(guards).toContain(AuthGuard);
  });
});
