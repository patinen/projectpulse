import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { TokenEncryptionService } from './token-encryption.service.js';

export type GitHubUserProfile = {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
};

export type AuthenticatedUser = {
  id: string;
  githubId: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenEncryptionService: TokenEncryptionService,
  ) {}

  createState(): string {
    return randomBytes(32).toString('hex');
  }

  validateState(expectedState: string | undefined, cookieState: string | undefined): boolean {
    return Boolean(expectedState && cookieState && expectedState === cookieState);
  }

  getGitHubAuthorizationUrl(state: string): string {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');

    if (!clientId) {
      throw new Error('GITHUB_CLIENT_ID is not configured');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.configService.get<string>('GITHUB_CALLBACK_URL') ?? 'http://localhost:3001/auth/github/callback',
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  createSessionToken(userId: string): string {
    const secret = this.configService.get<string>('AUTH_SESSION_SECRET');

    if (!secret) {
      throw new Error('AUTH_SESSION_SECRET is not configured');
    }

    return this.jwtService.sign(
      { sub: userId },
      {
        secret,
        expiresIn: '7d',
      },
    );
  }

  getSessionCookieOptions() {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProduction,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  mapGitHubProfile(profile: GitHubUserProfile): Pick<AuthenticatedUser, 'githubId' | 'login' | 'name' | 'avatarUrl'> {
    return {
      githubId: String(profile.id),
      login: profile.login,
      name: profile.name ?? null,
      avatarUrl: profile.avatar_url ?? null,
    };
  }

  async fetchGitHubUser(accessToken: string): Promise<GitHubUserProfile> {
    const response = await fetch('https://api.github.com/user', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'User-Agent': 'ProjectPulse-API',
      },
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`GitHub profile lookup failed: ${response.status} ${responseText}`);
    }

    return (await response.json()) as GitHubUserProfile;
  }

  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; tokenType: string | null; scope: string | null }> {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET');
    const callbackUrl = this.configService.get<string>('GITHUB_CALLBACK_URL') ?? 'http://localhost:3001/auth/github/callback';

    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth environment variables are not configured');
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'ProjectPulse-API',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`GitHub token exchange failed: ${response.status} ${responseText}`);
    }

    const payload = (await response.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!payload.access_token) {
      throw new Error(payload.error_description ?? 'GitHub OAuth token exchange failed');
    }

    return {
      accessToken: payload.access_token,
      tokenType: payload.token_type ?? null,
      scope: payload.scope ?? null,
    };
  }

  async upsertGitHubConnection(userId: string, accessToken: string, tokenType: string | null, scope: string | null): Promise<void> {
    const accessTokenEncrypted = this.tokenEncryptionService.encrypt(accessToken);

    await this.prisma.gitHubConnection.upsert({
      where: { userId },
      update: {
        accessTokenEncrypted,
        tokenType,
        scope,
      },
      create: {
        userId,
        accessTokenEncrypted,
        tokenType,
        scope,
      },
    });
  }

  async createUserFromGitHubProfile(profile: GitHubUserProfile): Promise<AuthenticatedUser> {
    const hasUserId = String(profile.id);
    const user = await this.prisma.user.upsert({
      where: { githubId: hasUserId },
      update: {
        login: profile.login,
        name: profile.name ?? null,
        avatarUrl: profile.avatar_url ?? null,
      },
      create: {
        githubId: hasUserId,
        login: profile.login,
        name: profile.name ?? null,
        avatarUrl: profile.avatar_url ?? null,
      },
    });

    return {
      id: user.id,
      githubId: user.githubId,
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  }

  async handleGitHubCallback(code: string, state: string, cookieState: string | undefined): Promise<{ user: AuthenticatedUser; sessionToken: string }> {
    if (!code || !state || !this.validateState(state, cookieState)) {
      throw new BadRequestException('Invalid OAuth state');
    }

    const tokenPayload = await this.exchangeCodeForToken(code);
    const githubProfile = await this.fetchGitHubUser(tokenPayload.accessToken);
    const user = await this.createUserFromGitHubProfile(githubProfile);

    await this.upsertGitHubConnection(user.id, tokenPayload.accessToken, tokenPayload.tokenType, tokenPayload.scope);

    return {
      user,
      sessionToken: this.createSessionToken(user.id),
    };
  }

  async getCurrentUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        githubId: true,
        login: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return null;
    }

    const { id, githubId, login, name, avatarUrl } = user;

    return {
      id,
      githubId,
      login,
      name,
      avatarUrl,
    };
  }

  async validateSessionToken(token: string): Promise<string> {
    const secret = this.configService.get<string>('AUTH_SESSION_SECRET');

    if (!secret) {
      throw new UnauthorizedException('Authentication is not configured');
    }

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token, { secret });

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid session payload');
      }

      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
