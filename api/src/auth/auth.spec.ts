import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { TokenEncryptionService } from './token-encryption.service.js';

describe('TokenEncryptionService', () => {
  const createConfig = (keyValue?: string) => ({
    get: vi.fn((key: string) => (key === 'GITHUB_TOKEN_ENCRYPTION_KEY' ? keyValue ?? 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' : undefined)),
  });

  it('encrypts and decrypts a token round trip', () => {
    const service = new TokenEncryptionService(createConfig(Buffer.from('12345678901234567890123456789012').toString('base64')) as never);
    const token = 'gho_secret_token_value';

    const encrypted = service.encrypt(token);

    expect(encrypted).not.toBe(token);
    expect(service.decrypt(encrypted)).toBe(token);
  });

  it('ciphertext is not plaintext', () => {
    const service = new TokenEncryptionService(createConfig(Buffer.from('12345678901234567890123456789012').toString('base64')) as never);
    const token = 'gho_secret_token_value';

    expect(service.encrypt(token)).not.toBe(token);
  });

  it('two encryptions of the same token produce different ciphertext', () => {
    const service = new TokenEncryptionService(createConfig(Buffer.from('12345678901234567890123456789012').toString('base64')) as never);
    const token = 'gho_secret_token_value';

    expect(service.encrypt(token)).not.toBe(service.encrypt(token));
  });

  it('rejects invalid encryption key length', () => {
    const service = new TokenEncryptionService(createConfig(Buffer.alloc(16).toString('base64')) as never);

    expect(() => service.encrypt('gho_token')).toThrow('must decode to exactly 32 bytes');
  });

  it('rejects malformed encrypted payloads', () => {
    const service = new TokenEncryptionService(createConfig(Buffer.from('12345678901234567890123456789012').toString('base64')) as never);

    expect(() => service.decrypt('not:v1:payload')).toThrow('Invalid encrypted token format');
  });
});

describe('AuthService', () => {
  let prisma: any;
  let jwtService: JwtService;
  let configService: any;
  let tokenEncryptionService: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
      },
      gitHubConnection: {
        upsert: vi.fn(),
      },
    };

    jwtService = new JwtService({ secret: 'projectpulse-session-secret' });
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'GITHUB_CLIENT_ID') return 'client-id';
        if (key === 'GITHUB_CLIENT_SECRET') return 'client-secret';
        if (key === 'GITHUB_CALLBACK_URL') return 'http://localhost:3001/auth/github/callback';
        if (key === 'AUTH_SESSION_SECRET') return 'projectpulse-session-secret';
        return undefined;
      }),
    };

    tokenEncryptionService = {
      encrypt: vi.fn((token: string) => `encrypted:${token}`),
    };

    service = new AuthService(prisma, jwtService, configService, tokenEncryptionService);
  });

  it('state match succeeds', () => {
    expect(service.validateState('abc', 'abc')).toBe(true);
  });

  it('state mismatch fails', () => {
    expect(service.validateState('abc', 'def')).toBe(false);
  });

  it('missing state fails', () => {
    expect(service.validateState(undefined, 'abc')).toBe(false);
    expect(service.validateState('abc', undefined)).toBe(false);
  });

  it('GitHub profile mapping converts numeric GitHub id to string', () => {
    expect(service.mapGitHubProfile({ id: 123456, login: 'octocat', name: 'OctoCat', avatar_url: 'https://example.com/avatar.png' })).toEqual({
      githubId: '123456',
      login: 'octocat',
      name: 'OctoCat',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('GitHub user upsert maps GitHub fields correctly', async () => {
    prisma.user.upsert.mockResolvedValue({
      id: 'user-1',
      githubId: '123456',
      login: 'octocat',
      name: 'OctoCat',
      avatarUrl: 'https://example.com/avatar.png',
    });

    const result = await service.createUserFromGitHubProfile({
      id: 123456,
      login: 'octocat',
      name: 'OctoCat',
      avatar_url: 'https://example.com/avatar.png',
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          githubId: '123456',
          login: 'octocat',
          name: 'OctoCat',
          avatarUrl: 'https://example.com/avatar.png',
        },
      }),
    );
    expect(result).toEqual({
      id: 'user-1',
      githubId: '123456',
      login: 'octocat',
      name: 'OctoCat',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('valid session token returns the ProjectPulse user id', async () => {
    const token = jwtService.sign({ sub: 'user-123' }, { secret: 'projectpulse-session-secret', expiresIn: '1h' });

    await expect(service.validateSessionToken(token)).resolves.toBe('user-123');
  });

  it('does not expose GitHubConnection or token fields from getCurrentUser', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      githubId: '123456',
      login: 'octocat',
      name: 'OctoCat',
      avatarUrl: 'https://example.com/avatar.png',
      accessTokenEncrypted: 'secret-token',
      githubConnection: { userId: 'user-123' },
    });

    const user = await service.getCurrentUser('user-123');

    expect(user).toEqual({
      id: 'user-123',
      githubId: '123456',
      login: 'octocat',
      name: 'OctoCat',
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(user).not.toHaveProperty('accessTokenEncrypted');
    expect(user).not.toHaveProperty('githubConnection');
  });

  it('invalid session token returns UnauthorizedException', async () => {
    await expect(service.validateSessionToken('not-a-valid-jwt')).rejects.toThrow(UnauthorizedException);
  });

  it('expired session token returns UnauthorizedException', async () => {
    const expiredToken = jwtService.sign({ sub: 'user-123' }, { secret: 'projectpulse-session-secret', expiresIn: -1 });

    await expect(service.validateSessionToken(expiredToken)).rejects.toThrow(UnauthorizedException);
  });

  it('getCurrentUser selects only the public profile fields', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      githubId: '123456',
      login: 'octocat',
      name: 'OctoCat',
      avatarUrl: 'https://example.com/avatar.png',
    });

    const user = await service.getCurrentUser('user-123');

    expect(user).toEqual({
      id: 'user-123',
      githubId: '123456',
      login: 'octocat',
      name: 'OctoCat',
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(Object.keys(user!)).toEqual(['id', 'githubId', 'login', 'name', 'avatarUrl']);
    expect(user).not.toHaveProperty('accessTokenEncrypted');
    expect(user).not.toHaveProperty('githubConnection');
  });
});

describe('AuthGuard', () => {
  it('missing session cookie returns 401', async () => {
    const authService = {
      validateSessionToken: vi.fn(),
      getCurrentUser: vi.fn(),
    };
    const guard = new AuthGuard(authService as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ cookies: {} }),
      }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('invalid session returns 401', async () => {
    const authService = {
      validateSessionToken: vi.fn().mockRejectedValue(new UnauthorizedException('Invalid or expired session')),
      getCurrentUser: vi.fn(),
    };
    const guard = new AuthGuard(authService as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ cookies: { pp_session: 'bad-token' } }),
      }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('valid session loads the user and attaches it to the request', async () => {
    const authService = {
      validateSessionToken: vi.fn().mockResolvedValue('user-123'),
      getCurrentUser: vi.fn().mockResolvedValue({
        id: 'user-123',
        githubId: '123456',
        login: 'octocat',
        name: 'OctoCat',
        avatarUrl: 'https://example.com/avatar.png',
      }),
    };
    const guard = new AuthGuard(authService as never);
    const request: any = { cookies: { pp_session: 'valid-token' } };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as never;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-123',
      githubId: '123456',
      login: 'octocat',
      name: 'OctoCat',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });
});

describe('AuthController', () => {
  it('uses a generated state and sets the OAuth cookie for GitHub login', () => {
    const authService = {
      createState: vi.fn().mockReturnValue('generated-state'),
      getGitHubAuthorizationUrl: vi.fn().mockReturnValue('https://github.com/login/oauth/authorize?client_id=client-id'),
    };
    const configService = { get: vi.fn((key: string) => (key === 'NODE_ENV' ? 'development' : undefined)) };
    const response: any = {
      cookie: vi.fn(),
      redirect: vi.fn().mockReturnValue('redirected'),
    };

    const controller = new AuthController(authService as never, configService as never);

    const result = controller.githubLogin(response);

    expect(authService.createState).toHaveBeenCalled();
    expect(response.cookie).toHaveBeenCalledWith(
      'oauth_state',
      'generated-state',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
      }),
    );
    expect(response.redirect).toHaveBeenCalledWith('https://github.com/login/oauth/authorize?client_id=client-id');
    expect(result).toBe('redirected');
  });

  it('rejects a mismatched OAuth state during callback', async () => {
    const authService = {
      validateState: vi.fn().mockReturnValue(false),
      handleGitHubCallback: vi.fn(),
    };
    const configService = { get: vi.fn() };
    const request: any = { cookies: { oauth_state: 'cookie-state' } };
    const response: any = {
      clearCookie: vi.fn(),
    };

    const controller = new AuthController(authService as never, configService as never);

    await expect(controller.githubCallback(request, response, 'auth-code', 'state-from-query')).rejects.toThrow(BadRequestException);
    expect(response.clearCookie).toHaveBeenCalledWith('oauth_state', { path: '/' });
    expect(authService.handleGitHubCallback).not.toHaveBeenCalled();
  });

  it('/auth/me response cannot expose GitHubConnection or encrypted token fields', async () => {
    const publicUser = {
      id: 'user-123',
      githubId: '123456',
      login: 'octocat',
      name: 'OctoCat',
      avatarUrl: 'https://example.com/avatar.png',
    };
    const request: any = {
      user: {
        ...publicUser,
        accessTokenEncrypted: 'secret-token',
        githubConnection: { userId: 'user-123' },
        accessToken: 'gho_super_secret',
      },
    };

    const controller = new AuthController({} as never, { get: vi.fn() } as never);
    const result = await controller.getCurrentUser(request);

    expect(result).toEqual(publicUser);
    expect(result).not.toHaveProperty('accessTokenEncrypted');
    expect(result).not.toHaveProperty('githubConnection');
    expect(result).not.toHaveProperty('accessToken');
  });
});
