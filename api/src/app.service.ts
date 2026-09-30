import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './database/prisma.service.js';

export type HealthResponse = {
  status: 'ok';
  service: 'projectpulse-api';
  database: 'connected';
};

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        service: 'projectpulse-api',
        database: 'connected',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'projectpulse-api',
        database: 'disconnected',
      });
    }
  }
}
