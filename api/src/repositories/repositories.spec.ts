import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { GitHubService } from '../github/github.service.js';
import { RepositoriesController } from './repositories.controller.js';
import { RepositoryService } from './repositories.service.js';

describe('GitHubService', () => {
  let authService: Pick<AuthService, 'getGitHubAccessTokenForUser'>;
  let service: GitHubService;

  beforeEach(() => {
    authService = {
      getGitHubAccessTokenForUser: vi.fn().mockResolvedValue('token-123'),
    };
    service = new GitHubService(authService as never);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('maps GitHub repository response correctly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 42,
            owner: { login: 'octo-org' },
            name: 'projectpulse',
            full_name: 'octo-org/projectpulse',
            private: false,
            default_branch: 'main',
            html_url: 'https://github.com/octo-org/projectpulse',
            description: 'API service',
            language: 'TypeScript',
            stargazers_count: 10,
            forks_count: 5,
            updated_at: '2026-09-30T00:00:00Z',
          },
        ],
      }),
    );

    const repositories = await service.listPublicRepositoriesForUser('user-1');

    expect(repositories).toEqual([
      {
        githubId: '42',
        owner: 'octo-org',
        name: 'projectpulse',
        fullName: 'octo-org/projectpulse',
        private: false,
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/octo-org/projectpulse',
        description: 'API service',
        language: 'TypeScript',
        stars: 10,
        forks: 5,
        updatedAt: '2026-09-30T00:00:00Z',
      },
    ]);
  });

  it('filters out private repositories', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 1, owner: { login: 'octo' }, name: 'public', full_name: 'octo/public', private: false },
          { id: 2, owner: { login: 'octo' }, name: 'private', full_name: 'octo/private', private: true },
        ],
      }),
    );

    const repositories = await service.listPublicRepositoriesForUser('user-1');

    expect(repositories).toHaveLength(1);
    expect(repositories[0].githubId).toBe('1');
  });

  it('handles non-2xx GitHub responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }),
    );

    await expect(service.listPublicRepositoriesForUser('user-1')).rejects.toThrow(ForbiddenException);
  });

  it('stops pagination when fewer than 100 items are returned', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => Array.from({ length: 100 }, (_, index) => ({
          id: index + 1,
          owner: { login: 'octo' },
          name: `repo-${index + 1}`,
          full_name: `octo/repo-${index + 1}`,
          private: false,
        })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => Array.from({ length: 20 }, (_, index) => ({
          id: 100 + index + 1,
          owner: { login: 'octo' },
          name: `repo-${100 + index + 1}`,
          full_name: `octo/repo-${100 + index + 1}`,
          private: false,
        })),
      });

    vi.stubGlobal('fetch', fetchMock);

    const repositories = await service.listPublicRepositoriesForUser('user-1');

    expect(repositories).toHaveLength(120);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('issues response excludes pull requests from issue count', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 1, number: 1, title: 'Real issue', html_url: 'https://example.com/issue/1', created_at: '2026-09-01T00:00:00Z', user: { login: 'alice' } },
          { id: 2, number: 2, title: 'PR item', html_url: 'https://example.com/pull/2', created_at: '2026-09-02T00:00:00Z', user: { login: 'bob' }, pull_request: {} },
        ],
      }),
    );

    const issues = await service.listRepositoryIssues('user-1', 'octo', 'projectpulse');

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ number: 1, title: 'Real issue' });
  });

  it('issue pagination works', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => Array.from({ length: 100 }, (_, index) => ({
          id: index + 1,
          number: index + 1,
          title: `Issue ${index + 1}`,
          html_url: `https://example.com/issue/${index + 1}`,
          created_at: '2026-09-01T00:00:00Z',
          user: { login: 'alice' },
        })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{
          id: 101,
          number: 101,
          title: 'Final issue',
          html_url: 'https://example.com/issue/101',
          created_at: '2026-09-02T00:00:00Z',
          user: { login: 'alice' },
        }],
      });

    vi.stubGlobal('fetch', fetchMock);

    const issues = await service.listRepositoryIssues('user-1', 'octo', 'projectpulse');

    expect(issues).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('commits respect the supplied since date', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{
          sha: 'abc123',
          html_url: 'https://example.com/commit/abc123',
          commit: { message: 'Test commit', author: { date: '2026-09-20T00:00:00Z' } },
          author: { login: 'alice' },
        }],
      }),
    );

    const since = new Date('2026-09-15T00:00:00Z');
    await service.listRepositoryCommits('user-1', 'octo', 'projectpulse', since);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('since=2026-09-15T00%3A00%3A00.000Z'),
      expect.any(Object),
    );
  });

  it('commit mapping works when author is null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{
          sha: 'abc123',
          html_url: 'https://example.com/commit/abc123',
          commit: { message: 'First line\nSecond line', author: { date: '2026-09-20T00:00:00Z' } },
          author: null,
        }],
      }),
    );

    const commits = await service.listRepositoryCommits('user-1', 'octo', 'projectpulse', new Date('2026-09-01T00:00:00Z'));

    expect(commits).toEqual([
      {
        sha: 'abc123',
        htmlUrl: 'https://example.com/commit/abc123',
        message: 'First line\nSecond line',
        occurredAt: '2026-09-20T00:00:00Z',
        authorLogin: null,
      },
    ]);
  });

  it('pull request mapping only treats merged PRs as merged activity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: 1, title: 'Merged', html_url: 'https://example.com/m', merged_at: '2026-09-03T00:00:00Z', user: { login: 'alice' } },
          { id: 2, title: 'Open', html_url: 'https://example.com/o', merged_at: null, user: { login: 'bob' } },
        ],
      }),
    );

    const mergedPulls = await service.listRecentMergedPullRequests('user-1', 'octo', 'projectpulse');

    expect(mergedPulls).toHaveLength(1);
    expect(mergedPulls[0]).toMatchObject({ title: 'Merged', userLogin: 'alice' });
  });

  it('GitHub non-2xx errors behave correctly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }),
    );

    await expect(service.listOpenPullRequests('user-1', 'octo', 'projectpulse')).rejects.toThrow(ForbiddenException);
  });
});

describe('RepositoryService', () => {
  let prisma: any;
  let githubService: any;
  let service: RepositoryService;

  beforeEach(() => {
    prisma = {
      trackedRepository: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      repository: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
      },
    };

    githubService = {
      listPublicRepositoriesForUser: vi.fn(),
    };

    service = new RepositoryService(prisma, githubService);
  });

  it('merges tracked state correctly', async () => {
    githubService.listPublicRepositoriesForUser.mockResolvedValue([
      { githubId: '1', owner: 'octo', name: 'one', fullName: 'octo/one', private: false, defaultBranch: 'main', htmlUrl: 'https://...', description: null, language: 'TS', stars: 1, forks: 1, updatedAt: '2026-09-30T00:00:00Z' },
      { githubId: '2', owner: 'octo', name: 'two', fullName: 'octo/two', private: false, defaultBranch: 'main', htmlUrl: 'https://...', description: null, language: 'JS', stars: 2, forks: 2, updatedAt: '2026-09-30T00:00:00Z' },
    ]);
    prisma.trackedRepository.findMany.mockResolvedValue([{ repository: { githubId: '1' } }]);

    const result = await service.getRepositoriesForUser('user-1');

    expect(result).toEqual([
      { githubId: '1', owner: 'octo', name: 'one', fullName: 'octo/one', private: false, defaultBranch: 'main', htmlUrl: 'https://...', description: null, language: 'TS', stars: 1, forks: 1, updatedAt: '2026-09-30T00:00:00Z', tracked: true },
      { githubId: '2', owner: 'octo', name: 'two', fullName: 'octo/two', private: false, defaultBranch: 'main', htmlUrl: 'https://...', description: null, language: 'JS', stars: 2, forks: 2, updatedAt: '2026-09-30T00:00:00Z', tracked: false },
    ]);
  });

  it('tracking a valid GitHub repository uses the authoritative GitHub metadata', async () => {
    githubService.listPublicRepositoriesForUser.mockResolvedValue([
      {
        githubId: '777',
        owner: 'octo',
        name: 'tracked',
        fullName: 'octo/tracked',
        private: false,
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/octo/tracked',
        description: 'authoritative description',
        language: 'TypeScript',
        stars: 12,
        forks: 3,
        updatedAt: '2026-09-30T00:00:00Z',
      },
    ]);

    prisma.repository.upsert.mockResolvedValue({
      id: 'repo-1',
      githubId: '777',
      owner: 'octo',
      name: 'tracked',
      fullName: 'octo/tracked',
      private: false,
      defaultBranch: 'main',
    });

    const result = await service.trackRepository('user-1', '777');

    expect(prisma.repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { githubId: '777' },
        create: expect.objectContaining({ githubId: '777', owner: 'octo', fullName: 'octo/tracked' }),
      }),
    );
    expect(prisma.trackedRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_repositoryId: {
            userId: 'user-1',
            repositoryId: 'repo-1',
          },
        },
      }),
    );
    expect(result).toMatchObject({
      githubId: '777',
      owner: 'octo',
      name: 'tracked',
      fullName: 'octo/tracked',
      tracked: true,
      description: 'authoritative description',
    });
  });

  it('duplicate tracking is idempotent', async () => {
    githubService.listPublicRepositoriesForUser.mockResolvedValue([
      {
        githubId: '777',
        owner: 'octo',
        name: 'tracked',
        fullName: 'octo/tracked',
        private: false,
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/octo/tracked',
        description: 'authoritative description',
        language: 'TypeScript',
        stars: 12,
        forks: 3,
        updatedAt: '2026-09-30T00:00:00Z',
      },
    ]);

    prisma.repository.upsert.mockResolvedValue({
      id: 'repo-1',
      githubId: '777',
      owner: 'octo',
      name: 'tracked',
      fullName: 'octo/tracked',
      private: false,
      defaultBranch: 'main',
    });

    await expect(service.trackRepository('user-1', '777')).resolves.toBeDefined();
    expect(prisma.trackedRepository.upsert).toHaveBeenCalled();
  });

  it('rejects an unknown githubId', async () => {
    githubService.listPublicRepositoriesForUser.mockResolvedValue([]);

    await expect(service.trackRepository('user-1', 'missing-id')).rejects.toThrow(BadRequestException);
  });

  it('private repository tracking is rejected', async () => {
    githubService.listPublicRepositoriesForUser.mockResolvedValue([
      {
        githubId: '777',
        owner: 'octo',
        name: 'private',
        fullName: 'octo/private',
        private: true,
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/octo/private',
        description: null,
        language: null,
        stars: 0,
        forks: 0,
        updatedAt: '2026-09-30T00:00:00Z',
      },
    ]);

    await expect(service.trackRepository('user-1', '777')).rejects.toThrow(BadRequestException);
  });

  it('untracking deletes only the user relation and is idempotent when missing', async () => {
    prisma.repository.findUnique.mockResolvedValue({ id: 'repo-1' });
    await expect(service.untrackRepository('user-1', '777')).resolves.toBeUndefined();
    expect(prisma.trackedRepository.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', repositoryId: 'repo-1' },
    });

    prisma.repository.findUnique.mockResolvedValue(null);
    await expect(service.untrackRepository('user-2', 'missing')).resolves.toBeUndefined();
    expect(prisma.trackedRepository.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('successful track calls enqueueUserSync for the user', async () => {
    const queueService = { enqueueUserSync: vi.fn().mockResolvedValue(undefined) };
    const serviceWithQueue = new RepositoryService(prisma, githubService, queueService as any);

    githubService.listPublicRepositoriesForUser.mockResolvedValue([
      {
        githubId: '777',
        owner: 'octo',
        name: 'tracked',
        fullName: 'octo/tracked',
        private: false,
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/octo/tracked',
        description: 'authoritative description',
        language: 'TypeScript',
        stars: 12,
        forks: 3,
        updatedAt: '2026-09-30T00:00:00Z',
      },
    ]);

    prisma.repository.upsert.mockResolvedValue({ id: 'repo-1', githubId: '777' });

    await expect(serviceWithQueue.trackRepository('user-1', '777')).resolves.toMatchObject({ tracked: true });
    expect(queueService.enqueueUserSync).toHaveBeenCalledWith('user-1');
  });

  it('successful untrack calls enqueueUserSync for the user', async () => {
    const queueService = { enqueueUserSync: vi.fn().mockResolvedValue(undefined) };
    const serviceWithQueue = new RepositoryService(prisma, githubService, queueService as any);

    prisma.repository.findUnique.mockResolvedValue({ id: 'repo-1' });

    await expect(serviceWithQueue.untrackRepository('user-1', '777')).resolves.toBeUndefined();
    expect(queueService.enqueueUserSync).toHaveBeenCalledWith('user-1');
  });

  it('queue enqueue failure does not reject an otherwise successful track', async () => {
    const queueService = { enqueueUserSync: vi.fn().mockRejectedValue(new Error('redis down')) };
    const serviceWithQueue = new RepositoryService(prisma, githubService, queueService as any);

    githubService.listPublicRepositoriesForUser.mockResolvedValue([
      {
        githubId: '777',
        owner: 'octo',
        name: 'tracked',
        fullName: 'octo/tracked',
        private: false,
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/octo/tracked',
        description: 'authoritative description',
        language: 'TypeScript',
        stars: 12,
        forks: 3,
        updatedAt: '2026-09-30T00:00:00Z',
      },
    ]);

    prisma.repository.upsert.mockResolvedValue({ id: 'repo-1', githubId: '777' });

    await expect(serviceWithQueue.trackRepository('user-1', '777')).resolves.toMatchObject({ tracked: true });
    expect(queueService.enqueueUserSync).toHaveBeenCalledWith('user-1');
  });

  it('queue enqueue failure does not restore an untracked relation', async () => {
    const queueService = { enqueueUserSync: vi.fn().mockRejectedValue(new Error('redis down')) };
    const serviceWithQueue = new RepositoryService(prisma, githubService, queueService as any);

    prisma.repository.findUnique.mockResolvedValue({ id: 'repo-1' });

    await expect(serviceWithQueue.untrackRepository('user-1', '777')).resolves.toBeUndefined();
    expect(prisma.trackedRepository.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', repositoryId: 'repo-1' },
    });
  });
});

describe('RepositoriesController', () => {
  it('controller-level AuthGuard metadata is present', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, RepositoriesController);

    expect(guards).toContain(AuthGuard);
  });
});

