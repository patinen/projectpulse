import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';

export type GitHubRepositorySummary = {
  githubId: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
};

type GitHubRepositoryResponse = {
  id?: number;
  owner?: { login?: string };
  name?: string;
  full_name?: string;
  private?: boolean;
  default_branch?: string;
  html_url?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  updated_at?: string;
};

@Injectable()
export class GitHubService {
  constructor(private readonly authService: AuthService) {}

  private buildHeaders(token: string): HeadersInit {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': 'ProjectPulse-API',
    };
  }

  private mapRepository(repo: GitHubRepositoryResponse): GitHubRepositorySummary | null {
    if (!repo.id || !repo.owner?.login || !repo.name || !repo.full_name) {
      return null;
    }

    if (repo.private) {
      return null;
    }

    return {
      githubId: String(repo.id),
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      private: false,
      defaultBranch: repo.default_branch ?? 'main',
      htmlUrl: repo.html_url ?? '',
      description: repo.description ?? null,
      language: repo.language ?? null,
      stars: Number(repo.stargazers_count ?? 0),
      forks: Number(repo.forks_count ?? 0),
      updatedAt: repo.updated_at ?? new Date().toISOString(),
    };
  }

  async listPublicRepositoriesForUser(userId: string): Promise<GitHubRepositorySummary[]> {
    const token = await this.authService.getGitHubAccessTokenForUser(userId);
    const repositories: GitHubRepositorySummary[] = [];
    const safetyLimit = 10;

    for (let page = 1; page <= safetyLimit; page += 1) {
      const url = `https://api.github.com/user/repos?visibility=public&per_page=100&page=${page}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(token),
      });

      if (response.status === 401) {
        throw new UnauthorizedException('GitHub access is no longer valid');
      }

      if (response.status === 403) {
        throw new ForbiddenException('GitHub API rate limit or access policy rejected this request');
      }

      if (!response.ok) {
        throw new InternalServerErrorException('Failed to load public repositories from GitHub');
      }

      const payload = (await response.json()) as GitHubRepositoryResponse[];
      const pageRepositories = payload
        .map((repo) => this.mapRepository(repo))
        .filter((repo): repo is GitHubRepositorySummary => repo !== null);

      repositories.push(...pageRepositories);

      if (payload.length < 100) {
        break;
      }
    }

    return repositories;
  }
}
