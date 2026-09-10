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
  PolicyPurposeHealthService,
} from '../../services/policyPurposeHealthService.mjs';

describe('PolicyPurposeHealthService', () => {
  test('over-fetches one fixed row, trims it before aggregation, and reports a bounded window', async () => {
    const db = { query: jest.fn() };
    const records = [{ library_id: 1 }, { library_id: 2 }, { library_id: 3 }];
    const loadRecords = jest.fn().mockResolvedValue(records);
    const loadOutcomeRecords = jest.fn().mockResolvedValue([{ library_id: 1 }]);
    const buildSummary = jest.fn().mockReturnValue({ routingAffected: false });
    const service = new PolicyPurposeHealthService({
      db,
      loadRecords,
      loadOutcomeRecords,
      buildSummary,
      limit: 2,
    });

    await expect(service.getSummary()).resolves.toEqual({ routingAffected: false });
    expect(loadRecords).toHaveBeenCalledWith({ db, limit: 3 });
    expect(buildSummary).toHaveBeenCalledWith({
      records: [records[0], records[1]],
      outcomeRecords: [{ library_id: 1 }],
      outcomeQualityReadAvailable: true,
      truncated: true,
    });
  });

  test('keeps structural health available when outcome corroboration cannot be read', async () => {
    const db = { query: jest.fn() };
    const loadRecords = jest.fn().mockResolvedValue([{ library_id: 1 }]);
    const loadOutcomeRecords = jest.fn().mockRejectedValue(new Error('read failed'));
    const buildSummary = jest.fn().mockReturnValue({ routingAffected: false });
    const service = new PolicyPurposeHealthService({
      db,
      loadRecords,
      loadOutcomeRecords,
      buildSummary,
    });

    await service.getSummary();

    expect(buildSummary).toHaveBeenCalledWith({
      records: [{ library_id: 1 }],
      outcomeRecords: [],
      outcomeQualityReadAvailable: false,
      truncated: false,
    });
  });

  test('clamps a configured read limit to the existing server maximum', () => {
    const service = new PolicyPurposeHealthService({ limit: 999 });

    expect(service.limit).toBe(100);
  });
});
