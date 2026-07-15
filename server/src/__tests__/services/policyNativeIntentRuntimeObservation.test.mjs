/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS,
  POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS,
  buildPolicyNativeIntentRuntimeObservation,
} from '../../services/policyNativeIntentRuntimeObservation.mjs';

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    ...overrides,
  };
}

function intent(overrides = {}) {
  return {
    id: 501,
    policy_id: 14,
    library_id: 4,
    schema_version: 1,
    intent_version: 1,
    active: true,
    source: 'legacy_presets',
    inference_state: 'inferred',
    review_behavior: {},
    validation_status: 'valid',
    ...overrides,
  };
}

function rule(overrides = {}) {
  return {
    intent_role: 'purpose',
    collection: 'purpose',
    signal_type: 'genres',
    operator: 'require_any',
    values: { require_any: ['Animation'] },
    constraint_mode: 'advisory',
    semantics: 'identity',
    source: 'native_intent',
    inference_state: 'inferred',
    sort_order: 0,
    ...overrides,
  };
}

function createDbClient({ rollbackAvailable = true } = {}) {
  const calls = [];

  return {
    calls,
    async query(sql) {
      calls.push(String(sql));

      if (String(sql).includes('FROM library_policies lp')) {
        return { rows: [policy()] };
      }

      if (String(sql).includes('FROM policy_intent_rollback_snapshots')) {
        return { rows: rollbackAvailable ? [{ policy_id: 14 }] : [] };
      }

      if (String(sql).includes('FROM policy_intent_rules')) {
        return { rows: [rule()] };
      }

      if (String(sql).includes('FROM policy_intent_template_applications')) {
        return { rows: [] };
      }

      if (String(sql).includes('FROM policy_intent_validation_status')) {
        return {
          rows: [{
            status: 'valid',
            error_count: 0,
            warning_count: 0,
            errors: [],
            warnings: [],
          }],
        };
      }

      if (String(sql).includes('FROM policy_intents')) {
        return { rows: [intent()] };
      }

      return { rows: [] };
    },
  };
}

describe('policyNativeIntentRuntimeObservation', () => {
  test('verifies the native runtime read and rollback snapshot after conversion', async () => {
    const dbClient = createDbClient();

    const observation = await buildPolicyNativeIntentRuntimeObservation({
      dbClient,
      policyIds: [14],
      now: '2026-07-15T16:00:00.000Z',
    });

    expect(observation.statusId)
      .toBe(POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS.VERIFIED);
    expect(observation.summary).toEqual({
      requestedPolicyCount: 1,
      observedPolicyCount: 1,
      nativeReadVerifiedCount: 1,
      rollbackAvailableCount: 1,
    });
    expect(observation.policies).toEqual([
      expect.objectContaining({
        policyId: 14,
        nativeRead: expect.objectContaining({
          verified: true,
          sourceId: 'native_intent',
          statusId: 'native_intent_active',
        }),
        rollbackAvailable: true,
      }),
    ]);
    expect(observation.validation.ok).toBe(true);
    expect(Object.values(observation.sideEffects).some(Boolean)).toBe(false);
    expect(dbClient.calls.every(sql => !/\b(INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(sql))).toBe(true);
  });

  test('blocks the observation when an active rollback snapshot is missing', async () => {
    const observation = await buildPolicyNativeIntentRuntimeObservation({
      dbClient: createDbClient({ rollbackAvailable: false }),
      policyIds: [14],
      now: '2026-07-15T16:00:00.000Z',
    });

    expect(observation.statusId)
      .toBe(POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS.BLOCKED);
    expect(observation.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS.ROLLBACK_NOT_AVAILABLE,
        policyId: 14,
      }),
    ]));
  });

  test('returns a bounded unavailable result when the read-only observation cannot run', async () => {
    const observation = await buildPolicyNativeIntentRuntimeObservation({
      dbClient: {
        query: async () => {
          throw new Error('database is unavailable');
        },
      },
      policyIds: [14],
      now: '2026-07-15T16:00:00.000Z',
    });

    expect(observation.statusId)
      .toBe(POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS.UNAVAILABLE);
    expect(observation.summary.observedPolicyCount).toBe(0);
    expect(observation.risks).toEqual([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS.OBSERVATION_UNAVAILABLE,
      }),
    ]);
    expect(JSON.stringify(observation)).not.toContain('database is unavailable');
  });

  test('rejects an invalid bounded selection before issuing a query', async () => {
    const dbClient = createDbClient();

    const observation = await buildPolicyNativeIntentRuntimeObservation({
      dbClient,
      policyIds: [14, 14],
    });

    expect(observation.statusId)
      .toBe(POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_STATUS_IDS.BLOCKED);
    expect(observation.risks).toEqual([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_RUNTIME_OBSERVATION_RISK_IDS.INVALID_SELECTION,
      }),
    ]);
    expect(dbClient.calls).toEqual([]);
  });
});
