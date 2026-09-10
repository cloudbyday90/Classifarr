/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS,
} from '../../services/policyNativeIntentConfirmedOutcomePurposeSuggestionContract.mjs';
import {
  createPolicyNativeIntentConfirmedOutcomePurposeSuggestionService,
} from '../../services/policyNativeIntentConfirmedOutcomePurposeSuggestionService.mjs';

describe('policyNativeIntentConfirmedOutcomePurposeSuggestionService', () => {
  test('delegates one normalized policy read to the read-only projection', async () => {
    const db = { query: jest.fn() };
    const context = { policy_id: 17 };
    const loadContext = jest.fn().mockResolvedValue(context);
    const buildSuggestion = jest.fn().mockReturnValue({ available: true });
    const service = createPolicyNativeIntentConfirmedOutcomePurposeSuggestionService({
      loadContext,
      buildSuggestion,
    });

    await expect(service.getSuggestion({ dbClient: db, policyId: '17' }))
      .resolves.toEqual({ available: true });
    expect(loadContext).toHaveBeenCalledWith({ db, policyId: 17 });
    expect(buildSuggestion).toHaveBeenCalledWith({ context });
  });

  test('returns a bounded unavailable status for invalid input or a read failure', async () => {
    const service = createPolicyNativeIntentConfirmedOutcomePurposeSuggestionService({
      loadContext: jest.fn().mockRejectedValue(new Error('database unavailable')),
    });

    await expect(service.getSuggestion({ dbClient: { query: jest.fn() }, policyId: 17 }))
      .resolves.toEqual(expect.objectContaining({
        statusId: POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.READ_UNAVAILABLE,
        available: false,
      }));
    await expect(service.getSuggestion({ dbClient: null, policyId: 'not-an-id' }))
      .resolves.toEqual(expect.objectContaining({ policyId: null }));
  });
});
