/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  PolicyProfileRefreshAutomationService,
} from '../../services/policyProfileRefreshAutomationService.mjs';

describe('PolicyProfileRefreshAutomationService', () => {
  test('continues delivering committed refreshes when native readiness planning fails', async () => {
    const planner = { run: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    const worker = { run: jest.fn().mockResolvedValue({ claimed: 1, completed: 1 }) };
    const logger = { warn: jest.fn() };
    const service = new PolicyProfileRefreshAutomationService({
      nativeProfileRefreshPlanner: planner,
      outboxWorker: worker,
      loggerInstance: logger,
    });

    await expect(service.run()).resolves.toEqual({
      version: 'policy.profile_refresh_automation.v1',
      planning: {
        statusId: 'failed',
        reasonId: 'native_profile_refresh_planning_failed',
      },
      delivery: { claimed: 1, completed: 1 },
    });
    expect(worker.run).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Native policy profile refresh planning failed',
      expect.not.objectContaining({ error: 'database unavailable' }),
    );
  });
});
