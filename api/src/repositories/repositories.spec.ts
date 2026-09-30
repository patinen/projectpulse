import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { GitHubService } from '../github/github.service.js';
import { RepositoriesController } from './repositories.controller.js';
import { RepositoryService } from './repositories.service.js';
import type { TrackRepositoryDto } from './dto/track-repository.dto.js';

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

  it('tracking upserts Repository and creates TrackedRepository', async () => {
    const dto: TrackRepositoryDto = {
      githubId: '777',
      owner: 'octo',
      name: 'tracked',
      fullName: 'octo/tracked',
      private: false,
      defaultBranch: 'main',
    };

    prisma.repository.upsert.mockResolvedValue({
      id: 'repo-1',
      githubId: '777',
      owner: 'octo',
      name: 'tracked',
      fullName: 'octo/tracked',
      private: false,
      defaultBranch: 'main',
    });

    const result = await service.trackRepository('user-1', dto);

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
    expect(result.tracked).toBe(true);
  });

  it('duplicate tracking is idempotent', async () => {
    const dto: TrackRepositoryDto = {
      githubId: '777',
      owner: 'octo',
      name: 'tracked',
      fullName: 'octo/tracked',
      private: false,
      defaultBranch: 'main',
    };

    prisma.repository.upsert.mockResolvedValue({
      id: 'repo-1',
      githubId: '777',
      owner: 'octo',
      name: 'tracked',
      fullName: 'octo/tracked',
      private: false,
      defaultBranch: 'main',
    });

    await expect(service.trackRepository('user-1', dto)).resolves.toBeDefined();
    expect(prisma.trackedRepository.upsert).toHaveBeenCalled();
  });

  it('private repository tracking is rejected', async () => {
    const dto = {
      githubId: '777',
      owner: 'octo',
      name: 'private',
      fullName: 'octo/private',
      private: true,
      defaultBranch: 'main',
    };

    await expect(service.trackRepository('user-1', dto as TrackRepositoryDto)).rejects.toThrow(BadRequestException);
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
});

describe('RepositoriesController', () => {
  it('repository endpoints are protected by AuthGuard', () => {
    const prototype = RepositoriesController.prototype as {
      listRepositories: unknown;
      trackRepository: unknown;
      untrackRepository: unknown;
    };

    expect(Reflect.getMetadata('guards', prototype.listRepositories)).toContain(AuthGuard);
    expect(Reflect.getMetadata('guards', prototype.trackRepository)).toContain(AuthGuard);
    expect(Reflect.getMetadata('guards', prototype.untrackRepository)).toContain(AuthGuard);
  });
});
