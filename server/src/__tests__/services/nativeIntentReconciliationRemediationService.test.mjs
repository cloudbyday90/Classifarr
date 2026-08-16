/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  NativeIntentReconciliationRemediationService,
} from '../../services/nativeIntentReconciliationRemediationService.mjs';

describe('NativeIntentReconciliationRemediationService', () => {
  test('loads a bounded current-state inventory and delegates presentation to the contract', async () => {
    const db = { query: jest.fn() };
    const records = [{ policy_id: 17 }];
    const loadRecords = jest.fn().mockResolvedValue(records);
    const buildInventory = jest.fn().mockReturnValue({ rawPayloadExposed: false });
    const service = new NativeIntentReconciliationRemediationService({
      db,
      now: () => '2026-08-16T12:00:00.000Z',
      loadRecords,
      buildInventory,
    });

    await expect(service.getInventory({ limit: 500 })).resolves.toEqual({ rawPayloadExposed: false });
    expect(loadRecords).toHaveBeenCalledWith({ db, limit: 100 });
    expect(buildInventory).toHaveBeenCalledWith({
      records,
      evaluatedAt: '2026-08-16T12:00:00.000Z',
    });
  });
});
