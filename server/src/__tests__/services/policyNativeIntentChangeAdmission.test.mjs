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
  POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS,
  POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS,
  POLICY_NATIVE_INTENT_CHANGE_ADMISSION_VERSION,
  POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS,
  buildPolicyNativeIntentChangeAdmission,
  validatePolicyNativeIntentChangeAdmission,
} from '../../services/policyNativeIntentChangeAdmission.mjs';

const VALID_PURPOSE_CHANGE_VALUES = [{
  signal_type: 'genres',
  operator: 'require_any',
  values: { require_any: ['Animation'] },
  constraint_mode: 'advisory',
  semantics: 'identity',
}];

const VALID_INPUT = {
  policyId: 42,
  expectedRevision: 3,
  actorId: 1,
  actorRole: 'admin',
  idempotencyKey: 'a'.repeat(32),
  changeCommands: [{
    commandId: POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_PURPOSE,
    values: VALID_PURPOSE_CHANGE_VALUES,
  }],
  authorityState: { stateId: 'single_active_native_intent', currentRevision: 3 },
};

describe('policyNativeIntentChangeAdmission', () => {
  test('admits a valid change command when revision matches and authority is active', () => {
    const admission = buildPolicyNativeIntentChangeAdmission(VALID_INPUT);

    expect(admission).toEqual(expect.objectContaining({
      version: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_VERSION,
      statusId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.ADMITTED,
      admitted: true,
      policyId: 42,
      actorId: 1,
      expectedRevision: 3,
      currentRevision: 3,
      riskCount: 0,
      retryable: false,
      recoveryRequired: false,
    }));
    expect(admission.validation.ok).toBe(true);
    expect(admission.admittedCommands).toHaveLength(1);
    expect(admission.admittedCommands[0].commandId).toBe('update_purpose');
    expect(admission.nextStep.stepId).toBe('persist_native_intent_change');
    expect(Object.values(admission.sideEffects).every(v => v === false)).toBe(true);
  });

  test('rejects a non-admin actor with authorization_rejected', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      actorRole: 'user',
    });

    expect(admission.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.AUTHORIZATION_REJECTED);
    expect(admission.admitted).toBe(false);
    expect(admission.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.UNAUTHORIZED_ACTOR,
      }),
    ]));
  });

  test('produces stale_revision when expected revision does not match', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      expectedRevision: 2,
      authorityState: { stateId: 'single_active_native_intent', currentRevision: 3 },
    });

    expect(admission.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.STALE_REVISION);
    expect(admission.admitted).toBe(false);
    expect(admission.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.REVISION_MISMATCH,
      }),
    ]));
  });

  test('produces policy_replaced when a newer version is active', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      authorityState: { stateId: 'policy_replaced', currentRevision: 5 },
    });

    expect(admission.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.STALE_REVISION);
    expect(admission.admitted).toBe(false);
  });

  test('produces unavailable_authority when no active native intent exists', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      authorityState: { stateId: 'no_active_native_intent' },
    });

    expect(admission.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.UNAVAILABLE_AUTHORITY);
    expect(admission.admitted).toBe(false);
    expect(admission.recoveryRequired).toBe(true);
  });

  test('produces recovery_required when authority is ambiguous', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      authorityState: { stateId: 'ambiguous_active_native_intents', currentRevision: 3 },
    });

    expect(admission.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RECOVERY_REQUIRED);
    expect(admission.admitted).toBe(false);
    expect(admission.recoveryRequired).toBe(true);
  });

  test('produces recovery_required when authority is non-authoritative', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      authorityState: { stateId: 'single_non_authoritative_active_intent', currentRevision: 3 },
    });

    expect(admission.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RECOVERY_REQUIRED);
    expect(admission.admitted).toBe(false);
  });

  test('rejects an unknown change command', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      changeCommands: [
        { commandId: 'bogus_command', values: [] },
        {
          commandId: POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_PURPOSE,
          values: VALID_PURPOSE_CHANGE_VALUES,
        },
      ],
    });

    expect(admission.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.UNKNOWN_COMMAND);
    expect(admission.admitted).toBe(false);
    expect(admission.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.UNKNOWN_CHANGE_COMMAND,
      }),
    ]));
  });

  test('rejects browser-synthesized legacy compatibility fields', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      legacyPayload: { customSignals: { genre: 'Comedy' }, presetWeights: 1.5 },
    });

    expect(admission.admitted).toBe(false);
    expect(admission.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.LEGACY_FIELD_DETECTED,
      }),
    ]));
  });

  test('rejects native establishment fields on the change path', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      legacyPayload: { native_intent_establishment: { declared_intent: {} } },
    });

    expect(admission.admitted).toBe(false);
    expect(admission.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.ESTABLISHMENT_FIELD_DETECTED,
      }),
    ]));
  });

  test('produces retryable when change command set is empty', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      changeCommands: [],
    });

    expect(admission.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RETRYABLE);
    expect(admission.admitted).toBe(false);
    expect(admission.retryable).toBe(true);
  });

  test('rejects an update_purpose command whose entries do not satisfy the shared typed contract', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      changeCommands: [{
        command_id: POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_PURPOSE,
        values: [{
          signal_type: 'genres',
          operator: 'require_any',
          values: { require_any: [] },
        }],
      }],
    });

    expect(admission.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RETRYABLE);
    expect(admission.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.INVALID_CHANGE_COMMAND,
      }),
    ]));
  });

  test('rejects an invalid idempotency key', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      idempotencyKey: 'short',
    });

    expect(admission.admitted).toBe(false);
    expect(admission.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.INVALID_IDEMPOTENCY_KEY,
      }),
    ]));
  });

  test('rejects a missing policy identifier', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      policyId: null,
    });

    expect(admission.admitted).toBe(false);
    expect(admission.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.MISSING_POLICY_ID,
      }),
    ]));
  });

  test('admits all six allow-listed change commands', () => {
    const allCommands = Object.values(POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS).map(commandId => ({
      commandId,
      values: commandId === POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_PURPOSE
        ? VALID_PURPOSE_CHANGE_VALUES
        : [],
    }));

    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      changeCommands: allCommands,
    });

    expect(admission.admitted).toBe(true);
    expect(admission.admittedCommands).toHaveLength(6);
  });

  test('rejects an admission that claims admitted but carries risks', () => {
    const admission = buildPolicyNativeIntentChangeAdmission({
      ...VALID_INPUT,
      actorRole: 'user',
    });
    const tampered = { ...admission, admitted: true };

    const validation = validatePolicyNativeIntentChangeAdmission(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.ADMITTED_WITH_RISKS,
      }),
    ]));
  });

  test('rejects an admission with an unsupported version', () => {
    const admission = buildPolicyNativeIntentChangeAdmission(VALID_INPUT);
    const validation = validatePolicyNativeIntentChangeAdmission({
      ...admission,
      version: 'policy.native_intent_change_admission.v0',
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.VERSION_MISMATCH,
      }),
    ]));
  });

  test('rejects an admission that reports a performed side effect', () => {
    const admission = buildPolicyNativeIntentChangeAdmission(VALID_INPUT);
    const tampered = {
      ...admission,
      sideEffects: { ...admission.sideEffects, databaseWritten: true },
    };

    const validation = validatePolicyNativeIntentChangeAdmission(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_INTENT_CHANGE_ADMISSION_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });
});
