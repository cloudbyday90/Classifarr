/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  NativeIntentReconciliationPurposeSuggestionService,
} from '../../services/nativeIntentReconciliationPurposeSuggestionService.mjs';

describe('NativeIntentReconciliationPurposeSuggestionService', () => {
  test('loads one current policy record and delegates the bounded read-only projection', async () => {
    const db = { query: jest.fn() };
    const record = { policy_id: 17 };
    const loadRecord = jest.fn().mockResolvedValue(record);
    const buildSuggestion = jest.fn().mockReturnValue({ available: true, persisted: false });
    const service = new NativeIntentReconciliationPurposeSuggestionService({
      db,
      now: () => '2026-08-28T16:00:00.000Z',
      loadRecord,
      buildSuggestion,
    });

    await expect(service.getSuggestion({ policyId: 17 })).resolves.toEqual({
      available: true,
      persisted: false,
    });
    expect(loadRecord).toHaveBeenCalledWith({ db, policyId: 17 });
    expect(buildSuggestion).toHaveBeenCalledWith({
      record,
      now: '2026-08-28T16:00:00.000Z',
    });
  });
});
