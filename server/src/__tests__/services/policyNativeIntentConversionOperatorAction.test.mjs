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
  POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS,
  POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS,
  POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_CONFIRMATION,
  applyPolicyNativeIntentConversion,
  previewPolicyNativeIntentConversion,
} from '../../services/policyNativeIntentConversionOperatorAction.mjs';

function preset(overrides = {}) {
  return {
    id: 7,
    key: 'family',
    name: 'Family',
    source: 'builtin',
    weight: 1,
    signals: {
      genres: { require_any: ['Family'] },
    },
    custom_signals: null,
    ...overrides,
  };
}

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    library_name: 'Movies',
    library_media_type: 'movie',
    name: 'Movies Policy',
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    require_ai_validation: true,
    trust_patterns: true,
    trust_rag: true,
    trust_history: true,
    combination_mode: 'best_match',
    presets: [preset()],
    routingTarget: {
      arr_type: 'radarr',
      arr_config_id: 1,
      arr_root_folder_path: '/media/Movies',
    },
    libraryMapping: {
      arr_type: 'radarr',
      arr_config_id: 1,
      arr_root_folder_id: 9,
      arr_root_folder_path: '/media/Movies',
      quality_profile_id: 3,
    },
    profileFreshness: {
      state: 'fresh',
      stale: false,
    },
    ...overrides,
  };
}

function createApplyClient() {
  return {
    query: jest.fn(async sql => {
      if (String(sql).includes('SELECT id') && String(sql).includes('FROM policy_intents')) {
        return { rows: [] };
      }

      if (String(sql).includes('FROM library_policies') && String(sql).includes('FOR UPDATE')) {
        return { rows: [{ id: 14, library_id: 4 }], rowCount: 1 };
      }

      if (String(sql).includes('INSERT INTO policy_intents')) {
        return { rows: [{ id: '501' }], rowCount: 1 };
      }

      return { rows: [], rowCount: 1 };
    }),
  };
}

function createDbClient() {
  const applyClient = createApplyClient();
  const dbClient = {
    query: jest.fn(async sql => {
      if (String(sql).includes('FROM library_policies lp')) {
        return { rows: [policy()] };
      }

      if (String(sql).includes('FROM policy_intents')) {
        return { rows: [] };
      }

      return { rows: [], rowCount: 0 };
    }),
    withTransaction: jest.fn(async work => work(applyClient)),
  };

  return { dbClient, applyClient };
}

describe('policyNativeIntentConversionOperatorAction', () => {
  test('returns an operator-safe preview without writing policy storage', async () => {
    const { dbClient } = createDbClient();

    const result = await previewPolicyNativeIntentConversion({
      dbClient,
      now: '2026-07-15T12:00:00.000Z',
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.PREVIEW_READY);
    expect(result.confirmation).toEqual({
      requiredValue: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_CONFIRMATION,
      accepted: false,
    });
    expect(result.candidateReport.summary.convertibleCount).toBe(1);
    expect(result.sideEffects).toEqual({
      policyStorageMutated: false,
      nativeRowsInserted: false,
      migrationEventsWritten: false,
      rollbackSnapshotsWritten: false,
      legacyPathsDeleted: false,
    });
    expect(dbClient.withTransaction).not.toHaveBeenCalled();
  });

  test('rejects a missing confirmation before querying policy storage', async () => {
    const { dbClient } = createDbClient();

    const result = await applyPolicyNativeIntentConversion({
      dbClient,
      action: {
        actorId: 7,
        policyIds: [14],
        confirmation: 'confirm',
      },
      now: '2026-07-15T12:00:00.000Z',
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.BLOCKED_BY_REQUEST);
    expect(result.validation.issues).toEqual([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.CONFIRMATION_REQUIRED,
      }),
    ]);
    expect(dbClient.query).not.toHaveBeenCalled();
    expect(dbClient.withTransaction).not.toHaveBeenCalled();
  });

  test('rejects a missing verified actor before querying policy storage', async () => {
    const { dbClient } = createDbClient();

    const result = await applyPolicyNativeIntentConversion({
      dbClient,
      action: {
        policyIds: [14],
        confirmation: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_CONFIRMATION,
      },
      now: '2026-07-15T12:00:00.000Z',
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.BLOCKED_BY_REQUEST);
    expect(result.validation.issues).toEqual([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.ACTOR_REQUIRED,
      }),
    ]);
    expect(dbClient.query).not.toHaveBeenCalled();
    expect(dbClient.withTransaction).not.toHaveBeenCalled();
  });

  test('rejects a selected policy that is not present in the current report', async () => {
    const { dbClient } = createDbClient();

    const result = await applyPolicyNativeIntentConversion({
      dbClient,
      action: {
        actorId: 7,
        policyIds: [999],
        confirmation: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_CONFIRMATION,
      },
      now: '2026-07-15T12:00:00.000Z',
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.BLOCKED_BY_SELECTION);
    expect(result.selection).toEqual(expect.objectContaining({
      unknownPolicyIds: [999],
      readyPolicyIds: [],
    }));
    expect(result.validation.issues).toEqual([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_RISK_IDS.POLICY_NOT_IN_CURRENT_REPORT,
      }),
    ]);
    expect(dbClient.withTransaction).not.toHaveBeenCalled();
  });

  test('converts a selected ready policy atomically with a manual-operator audit type', async () => {
    const { dbClient, applyClient } = createDbClient();

    const result = await applyPolicyNativeIntentConversion({
      dbClient,
      action: {
        actorId: 7,
        policyIds: [14],
        confirmation: POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_CONFIRMATION,
      },
      now: '2026-07-15T12:00:00.000Z',
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS.APPLIED);
    expect(result.summary).toEqual(expect.objectContaining({
      requestedPolicyCount: 1,
      readyPolicyCount: 1,
      appliedPolicyCount: 1,
    }));
    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(applyClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_migration_events'),
      expect.arrayContaining(['conversion_started', 'operator', 7])
    );
    expect(result.sideEffects).toEqual(expect.objectContaining({
      nativeRowsInserted: true,
      migrationEventsWritten: true,
      rollbackSnapshotsWritten: true,
      legacyPathsDeleted: false,
    }));
    expect(result.runtimeObservation).toEqual(expect.objectContaining({
      statusId: expect.any(String),
      sideEffects: expect.objectContaining({
        policyStorageMutated: false,
        legacyPathsDeleted: false,
      }),
    }));
  });
});
