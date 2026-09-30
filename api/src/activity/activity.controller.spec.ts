import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../auth/auth.guard.js';
import { ActivityController } from './activity.controller.js';

describe('ActivityController', () => {
  it('controller-level AuthGuard metadata is present', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ActivityController);

    expect(guards).toContain(AuthGuard);
  });

  it('returns the activity response for the authenticated user', async () => {
    const activityService: any = {
      getActivity: vi.fn().mockResolvedValue({ events: [] }),
    };

    const controller = new ActivityController(activityService);
    const result = await controller.getActivity({ user: { id: 'user-1' } } as any, '30d', 'all', 'acme/app');

    expect(activityService.getActivity).toHaveBeenCalledWith('user-1', {
      range: '30d',
      kind: 'all',
      repository: 'acme/app',
    });
    expect(result).toEqual({ events: [] });
  });
});
