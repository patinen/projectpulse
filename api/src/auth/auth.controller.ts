import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { AuthGuard } from './auth.guard.js';
import { AuthenticatedUser, AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('github')
  githubLogin(@Req() request: Request, @Res() response: Response) {
    const state = randomBytes(32).toString('hex');
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      path: '/',
      maxAge: 10 * 60 * 1000,
    };

    response.cookie('oauth_state', state, cookieOptions);
    return response.redirect(this.authService.getGitHubAuthorizationUrl(state));
  }

  @Get('github/callback')
  async githubCallback(
    @Req() request: Request,
    @Res() response: Response,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    const cookieState = (request.cookies as Record<string, string> | undefined)?.oauth_state;

    if (!this.authService.validateState(state, cookieState)) {
      response.clearCookie('oauth_state', { path: '/' });
      throw new BadRequestException('Invalid OAuth state');
    }

    response.clearCookie('oauth_state', { path: '/' });

    const { sessionToken } = await this.authService.handleGitHubCallback(code, state, cookieState);
    const webUrl = this.configService.get<string>('WEB_URL') ?? 'http://localhost:3000';

    response.cookie('pp_session', sessionToken, this.authService.getSessionCookieOptions());
    return response.redirect(webUrl);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@Req() request: Request & { user: AuthenticatedUser }) {
    return request.user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Res({ passthrough: true }) response: Response) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    response.clearCookie('pp_session', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
    });

    return;
  }
}
