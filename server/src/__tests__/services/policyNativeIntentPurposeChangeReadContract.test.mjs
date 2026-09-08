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
  POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS,
} from '../../services/policyNativeIntentPurposeChangeProvenance.mjs';
import {
  POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS,
  POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_VERSION,
  buildPurposeChangeAvailableResult,
  validatePolicyNativeIntentPurposeChangeRead,
} from '../../services/policyNativeIntentPurposeChangeReadContract.mjs';

const CHANGE_COMMAND = {
  command_id: 'update_purpose',
  values: [{
    signal_type: 'genres',
    operator: 'require_any',
    values: { require_any: ['Animation'] },
    constraint_mode: 'advisory',
    semantics: 'identity',
    source: 'native_intent',
    inference_state: 'inferred',
  }],
};

const PURPOSE_PROVENANCE = {
  id: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS.DECLARED_NATIVE,
  declarationRequired: false,
  rawRuleProvenanceExposed: false,
};

describe('policyNativeIntentPurposeChangeReadContract', () => {
  test('projects only the server-owned revision and typed purpose command', () => {
    const result = buildPurposeChangeAvailableResult({
      policyId: 41,
      revision: 7,
      changeCommand: CHANGE_COMMAND,
      purposeProvenance: PURPOSE_PROVENANCE,
    });

    expect(result).toEqual(expect.objectContaining({
      version: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_VERSION,
      statusId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.AVAILABLE,
      policyId: 41,
      revision: 7,
      changeCommand: CHANGE_COMMAND,
      purposeProvenance: PURPOSE_PROVENANCE,
      authority: {
        source: 'server_owned_native_intent',
        purposeChangeAllowed: true,
        browserAuthorityAccepted: false,
      },
      compatibilityDataExposed: false,
      aiDataExposed: false,
      routingDataExposed: false,
      learningDataExposed: false,
    }));
    expect(Object.values(result.sideEffects).every(value => value === false || value === true)).toBe(true);
    expect(result.sideEffects).toEqual(expect.objectContaining({
      providerAccessed: false,
      policyStorageMutated: false,
      routingAffected: false,
      learningAffected: false,
      databaseWritten: false,
    }));
    expect(validatePolicyNativeIntentPurposeChangeRead(result)).toEqual(expect.objectContaining({ ok: true }));
  });

  test('rejects an available projection that attempts to expose a non-purpose authority surface', () => {
    const result = buildPurposeChangeAvailableResult({
      policyId: 41,
      revision: 7,
      changeCommand: CHANGE_COMMAND,
      purposeProvenance: PURPOSE_PROVENANCE,
    });

    const validation = validatePolicyNativeIntentPurposeChangeRead({
      ...result,
      aiDataExposed: true,
      sideEffects: { ...result.sideEffects, routingAffected: true },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issueCount).toBeGreaterThanOrEqual(2);
  });

  test('rejects a provenance state that contradicts whether declaration is required', () => {
    const result = buildPurposeChangeAvailableResult({
      policyId: 41,
      revision: 7,
      changeCommand: CHANGE_COMMAND,
      purposeProvenance: {
        id: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS.PROFILE_DERIVED,
        declarationRequired: false,
        rawRuleProvenanceExposed: false,
      },
    });

    expect(validatePolicyNativeIntentPurposeChangeRead(result)).toEqual(expect.objectContaining({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ riskId: 'invalid_native_intent_purpose_change_read_provenance' }),
      ]),
    }));
  });
});
