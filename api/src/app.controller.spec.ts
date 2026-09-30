import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHealth: async () => ({
              status: 'ok',
              service: 'projectpulse-api',
              database: 'connected',
            }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return the service health payload', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        service: 'projectpulse-api',
        database: 'connected',
      });
    });
  });
});
