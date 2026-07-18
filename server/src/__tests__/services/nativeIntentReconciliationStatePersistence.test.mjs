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
  upsertNativeIntentReconciliationState,
} from '../../services/nativeIntentReconciliationStatePersistence.mjs';

function reconciliationState(overrides = {}) {
  return {
    policyId: 44,
    candidateFingerprint: `sha256:${'a'.repeat(64)}`,
    candidateStatusId: 'requires_initial_policy_establishment',
    outcomeState: 'requires_maintenance',
    reasonId: 'requires_initial_policy_establishment',
    retryNotBefore: null,
    failureCount: 0,
    evaluatedAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

describe('nativeIntentReconciliationStatePersistence', () => {
  test('writes an unconverted policy state and rechecks native authority before commit', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ policy_id: 44 }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    const result = await upsertNativeIntentReconciliationState({
      client,
      state: reconciliationState(),
    });

    expect(result).toEqual({
      statusId: 'upserted',
      upsertedCount: 1,
      deletedCount: 0,
      rawPayloadExposed: false,
    });
    expect(client.query.mock.calls[0][0]).toContain('WHERE NOT EXISTS');
    expect(client.query.mock.calls[0][0]).toContain('FROM policy_intents active_intent');
    expect(client.query.mock.calls[0][0]).toContain('FROM policy_intent_rules authority_purpose_rule');
    expect(client.query.mock.calls[1][0]).toContain('DELETE FROM policy_native_intent_reconciliation_states');
    expect(client.query.mock.calls[1][1]).toEqual([44]);
  });

  test('clears a stale reconciliation state when native authority was committed concurrently', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ policy_id: 44 }] }),
    };

    const result = await upsertNativeIntentReconciliationState({
      client,
      state: reconciliationState(),
    });

    expect(result).toEqual({
      statusId: 'cleared_authoritative',
      upsertedCount: 0,
      deletedCount: 1,
      rawPayloadExposed: false,
    });
  });
});
