import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const cookieToken = (request.cookies as Record<string, string> | undefined)?.pp_session;

    if (!cookieToken) {
      throw new UnauthorizedException('Missing session cookie');
    }

    try {
      const userId = await this.authService.validateSessionToken(cookieToken);
      const user = await this.authService.getCurrentUser(userId);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
