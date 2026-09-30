import { Injectable } from '@nestjs/common';

export type HealthResponse = {
  status: 'ok';
  service: 'projectpulse-api';
};

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'projectpulse-api',
    };
  }
}
