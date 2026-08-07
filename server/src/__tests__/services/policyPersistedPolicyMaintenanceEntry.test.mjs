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
  POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS,
  POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS,
  POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_VERSION,
  POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS,
  buildPolicyPersistedPolicyMaintenanceEntry,
  validatePolicyPersistedPolicyMaintenanceEntry,
} from '../../services/policyPersistedPolicyMaintenanceEntry.mjs';

const AUTHORITATIVE_NATIVE = {
  policySource: 'native_intent',
  authorityState: { stateId: 'single_active_native_intent' },
  readinessState: { stateId: 'ready' },
  hasActivePolicy: true,
};

describe('policyPersistedPolicyMaintenanceEntry', () => {
  test('classifies a ready native policy as native_change_eligible', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry(AUTHORITATIVE_NATIVE);

    expect(entry).toEqual(expect.objectContaining({
      version: POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_VERSION,
      dispositionId: POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.NATIVE_CHANGE_ELIGIBLE,
      maintenanceAvailable: true,
    }));
    expect(entry.validation.ok).toBe(true);
    expect(entry.nextAdmittedAction).toEqual(expect.objectContaining({
      actionId: 'enter_native_maintenance',
      requiresRevisionCheck: true,
      requiresAdministrator: true,
    }));
    expect(entry.nextAdmittedAction.allowedChangeCommands).toEqual(
      POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS);
  });

  test('classifies a native policy with a hard-limit block as inspect_only', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry({
      ...AUTHORITATIVE_NATIVE,
      readinessState: { stateId: 'blocked_by_hard_limit' },
    });

    expect(entry.dispositionId).toBe(POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.INSPECT_ONLY);
    expect(entry.maintenanceAvailable).toBe(false);
    expect(entry.nextAdmittedAction).toBe(null);
  });

  test('classifies a native policy with ambiguous authority as recovery_required', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry({
      policySource: 'native_intent',
      authorityState: { stateId: 'ambiguous_active_native_intents' },
      readinessState: { stateId: 'ready' },
      hasActivePolicy: true,
    });

    expect(entry.dispositionId).toBe(POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.RECOVERY_REQUIRED);
    expect(entry.maintenanceAvailable).toBe(false);
  });

  test('classifies a native policy with non-authoritative authority as recovery_required', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry({
      policySource: 'native_intent',
      authorityState: { stateId: 'single_non_authoritative_active_intent' },
      readinessState: { stateId: 'ready' },
      hasActivePolicy: true,
    });

    expect(entry.dispositionId).toBe(POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.RECOVERY_REQUIRED);
  });

  test('classifies a native policy with stale profile as recovery_required', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry({
      ...AUTHORITATIVE_NATIVE,
      readinessState: { stateId: 'stale_profile' },
    });

    expect(entry.dispositionId).toBe(POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.RECOVERY_REQUIRED);
  });

  test('classifies a compatibility policy as compatibility_maintenance_only', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry({
      policySource: 'compatibility',
      authorityState: { stateId: 'no_active_native_intent' },
      readinessState: { stateId: 'ready' },
      hasActivePolicy: true,
    });

    expect(entry.dispositionId).toBe(
      POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.COMPATIBILITY_MAINTENANCE_ONLY);
    expect(entry.compatibilityMaintenanceIsolated).toBe(true);
    expect(entry.nextAdmittedAction).toBe(null);
  });

  test('classifies a policy with no active record as create_path', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry({
      policySource: 'native_intent',
      authorityState: { stateId: 'no_active_native_intent' },
      readinessState: { stateId: 'ready' },
      hasActivePolicy: false,
    });

    expect(entry.dispositionId).toBe(POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.CREATE_PATH);
    expect(entry.maintenanceAvailable).toBe(false);
  });

  test('does not expose native change action for compatibility policies', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry({
      policySource: 'legacy_presets',
      authorityState: { stateId: 'no_active_native_intent' },
      hasActivePolicy: true,
    });

    expect(entry.dispositionId).toBe(
      POLICY_PERSISTED_POLICY_MAINTENANCE_DISPOSITION_IDS.COMPATIBILITY_MAINTENANCE_ONLY);
    expect(entry.nextAdmittedAction).toBe(null);
  });

  test('the next admitted action binds to the six allow-listed change commands', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry(AUTHORITATIVE_NATIVE);

    expect(entry.nextAdmittedAction.allowedChangeCommands).toHaveLength(6);
    expect(entry.nextAdmittedAction.allowedChangeCommands).toEqual([
      'update_purpose',
      'update_hard_limits',
      'update_avoid_rules',
      'update_helpful_matches',
      'update_routing_target',
      'update_review_triggers',
    ]);
  });

  test('rejects an unsupported version in validation', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry(AUTHORITATIVE_NATIVE);
    const validation = validatePolicyPersistedPolicyMaintenanceEntry({
      ...entry,
      version: 'policy.persisted_policy_maintenance_entry.v0',
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS.VERSION_MISMATCH,
      }),
    ]));
  });

  test('rejects a native_change_eligible entry without a next admitted action', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry(AUTHORITATIVE_NATIVE);
    const tampered = { ...entry, nextAdmittedAction: null };

    const validation = validatePolicyPersistedPolicyMaintenanceEntry(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS.NATIVE_CHANGE_WITHOUT_AUTHORITY,
      }),
    ]));
  });

  test('rejects a compatibility entry that exposes a native change action', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry({
      policySource: 'compatibility',
      authorityState: { stateId: 'no_active_native_intent' },
      hasActivePolicy: true,
    });
    const tampered = {
      ...entry,
      nextAdmittedAction: { actionId: 'enter_native_maintenance' },
    };

    const validation = validatePolicyPersistedPolicyMaintenanceEntry(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS.COMPATIBILITY_WITH_NATIVE_DISPOSITION,
      }),
    ]));
  });

  test('rejects a presentation that reports a performed side effect', () => {
    const entry = buildPolicyPersistedPolicyMaintenanceEntry(AUTHORITATIVE_NATIVE);
    const tampered = {
      ...entry,
      sideEffects: { ...entry.sideEffects, databaseWritten: true },
    };

    const validation = validatePolicyPersistedPolicyMaintenanceEntry(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PERSISTED_POLICY_MAINTENANCE_ENTRY_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });
});
