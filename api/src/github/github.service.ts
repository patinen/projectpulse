import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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

export type GitHubIssueSummary = {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  createdAt: string;
  userLogin: string | null;
};

export type GitHubPullRequestSummary = {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  createdAt: string;
  userLogin: string | null;
  state: string;
  mergedAt: string | null;
};

export type GitHubCommitSummary = {
  sha: string;
  htmlUrl: string;
  message: string;
  occurredAt: string;
  authorLogin: string | null;
};

export type GitHubRepositoryMetadata = {
  githubId: string;
  fullName: string;
  name: string;
  owner: string;
  language: string | null;
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

type GitHubIssueResponse = {
  id?: number;
  number?: number;
  title?: string;
  html_url?: string;
  created_at?: string;
  user?: { login?: string | null } | null;
  pull_request?: unknown;
};

type GitHubPullRequestResponse = {
  id?: number;
  number?: number;
  title?: string;
  html_url?: string;
  created_at?: string;
  state?: string;
  merged_at?: string | null;
  user?: { login?: string | null } | null;
};

type GitHubCommitResponse = {
  sha?: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: { date?: string };
  };
  author?: { login?: string | null } | null;
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

  private async fetchGitHubJson<T>(userId: string, url: string): Promise<T> {
    const token = await this.authService.getGitHubAccessTokenForUser(userId);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(token),
    });

    if (response.status === 401) {
      throw new UnauthorizedException('GitHub authorization is invalid');
    }

    if (response.status === 403) {
      throw new ForbiddenException('GitHub API rate limit or policy rejected this request');
    }

    if (response.status === 404) {
      throw new NotFoundException('Tracked repository was not found or is inaccessible');
    }

    if (!response.ok) {
      throw new InternalServerErrorException('GitHub API request failed');
    }

    return (await response.json()) as T;
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
    const repositories: GitHubRepositorySummary[] = [];
    const safetyLimit = 10;

    for (let page = 1; page <= safetyLimit; page += 1) {
      const url = `https://api.github.com/user/repos?visibility=public&per_page=100&page=${page}`;
      const payload = await this.fetchGitHubJson<GitHubRepositoryResponse[]>(userId, url);
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

  async listRepositoryIssues(userId: string, owner: string, repo: string): Promise<GitHubIssueSummary[]> {
    const issues: GitHubIssueSummary[] = [];
    const safetyLimit = 10;

    for (let page = 1; page <= safetyLimit; page += 1) {
      const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100&page=${page}`;
      const payload = await this.fetchGitHubJson<GitHubIssueResponse[]>(userId, url);
      const pageItems = payload
        .filter((issue) => !('pull_request' in issue))
        .map((issue) => ({
          id: Number(issue.id ?? 0),
          number: Number(issue.number ?? 0),
          title: issue.title ?? 'Untitled issue',
          htmlUrl: issue.html_url ?? '',
          createdAt: issue.created_at ?? new Date().toISOString(),
          userLogin: issue.user?.login ?? null,
        }))
        .filter((issue) => issue.id > 0 && issue.number > 0);

      issues.push(...pageItems);

      if (payload.length < 100) {
        break;
      }
    }

    return issues;
  }

  async listOpenPullRequests(userId: string, owner: string, repo: string): Promise<GitHubPullRequestSummary[]> {
    const pulls: GitHubPullRequestSummary[] = [];
    const safetyLimit = 10;

    for (let page = 1; page <= safetyLimit; page += 1) {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100&page=${page}`;
      const payload = await this.fetchGitHubJson<GitHubPullRequestResponse[]>(userId, url);
      const pageItems = payload.map((pullRequest) => ({
        id: Number(pullRequest.id ?? 0),
        number: Number(pullRequest.number ?? 0),
        title: pullRequest.title ?? 'Untitled pull request',
        htmlUrl: pullRequest.html_url ?? '',
        createdAt: pullRequest.created_at ?? new Date().toISOString(),
        userLogin: pullRequest.user?.login ?? null,
        state: pullRequest.state ?? 'open',
        mergedAt: pullRequest.merged_at ?? null,
      })).filter((pullRequest) => pullRequest.id > 0 && pullRequest.number > 0);

      pulls.push(...pageItems);

      if (payload.length < 100) {
        break;
      }
    }

    return pulls;
  }

  async listRepositoryCommits(
    userId: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<GitHubCommitSummary[]> {
    const commits: GitHubCommitSummary[] = [];
    const safetyLimit = 10;

    for (let page = 1; page <= safetyLimit; page += 1) {
      const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
      url.searchParams.set('since', since.toISOString());
      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(page));

      const payload = await this.fetchGitHubJson<GitHubCommitResponse[]>(userId, url.toString());
      const pageItems = payload.map((commit) => ({
        sha: commit.sha ?? '',
        htmlUrl: commit.html_url ?? '',
        message: commit.commit?.message ?? 'Untitled commit',
        occurredAt: commit.commit?.author?.date ?? new Date().toISOString(),
        authorLogin: commit.author?.login ?? null,
      })).filter((commit) => commit.sha.length > 0);

      commits.push(...pageItems);

      if (payload.length < 100) {
        break;
      }
    }

    return commits;
  }

  async listRecentMergedPullRequests(
    userId: string,
    owner: string,
    repo: string,
  ): Promise<Array<{ id: number; title: string; htmlUrl: string; mergedAt: string; userLogin: string | null }>> {
    const pulls: Array<{ id: number; title: string; htmlUrl: string; mergedAt: string; userLogin: string | null }> = [];
    const safetyLimit = 3;

    for (let page = 1; page <= safetyLimit; page += 1) {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=20&page=${page}`;
      const payload = await this.fetchGitHubJson<GitHubPullRequestResponse[]>(userId, url);
      const pageItems = payload
        .filter((pullRequest) => pullRequest.merged_at)
        .map((pullRequest) => ({
          id: Number(pullRequest.id ?? 0),
          title: pullRequest.title ?? 'Merged pull request',
          htmlUrl: pullRequest.html_url ?? '',
          mergedAt: pullRequest.merged_at ?? new Date().toISOString(),
          userLogin: pullRequest.user?.login ?? null,
        }))
        .filter((pullRequest) => pullRequest.id > 0);

      pulls.push(...pageItems);

      if (payload.length < 20) {
        break;
      }
    }

    return pulls;
  }

  async getRepositoryMetadata(
    userId: string,
    owner: string,
    repo: string,
  ): Promise<GitHubRepositoryMetadata> {
    const payload = await this.fetchGitHubJson<{ id?: number; full_name?: string; name?: string; owner?: { login?: string }; language?: string | null }>(
      userId,
      `https://api.github.com/repos/${owner}/${repo}`,
    );

    return {
      githubId: String(payload.id ?? 0),
      fullName: payload.full_name ?? `${owner}/${repo}`,
      name: payload.name ?? repo,
      owner: payload.owner?.login ?? owner,
      language: payload.language ?? null,
    };
  }
}
