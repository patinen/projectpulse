import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AppService } from './app.service.js';
import { PrismaService } from './database/prisma.service.js';

describe('AppService', () => {
  it('returns connected when the database query succeeds', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;

    const service = new AppService(prisma);

    await expect(service.getHealth()).resolves.toEqual({
      status: 'ok',
      service: 'projectpulse-api',
      database: 'connected',
    });
  });

  it('throws a 503 when the database query fails', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('database unavailable')),
    } as unknown as PrismaService;

    const service = new AppService(prisma);

    await expect(service.getHealth()).rejects.toMatchObject({
      response: {
        status: 'error',
        service: 'projectpulse-api',
        database: 'disconnected',
      },
      status: 503,
    });
    await expect(service.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
