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
  POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID,
  PolicyNativeIntentChangePurposePreflightValidationError,
  buildPolicyNativeIntentChangePurposePreflight,
  buildPolicyNativeIntentChangePurposePreflightCandidate,
  normalizePolicyNativeIntentChangePurposeCommand,
} from '../../services/policyNativeIntentChangePurposePreflightContract.mjs';

function validCommand(term = 'shared-purpose-token') {
  return {
    command_id: POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID,
    values: [{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: [term] },
      semantics: 'identity',
    }],
  };
}

describe('native intent purpose change preflight contract', () => {
  test('derives only transient required identity terms from the typed update_purpose command', () => {
    const candidate = buildPolicyNativeIntentChangePurposePreflightCandidate(validCommand());

    expect(candidate).toEqual({
      terms: [{ signalType: 'genres', termKey: 'shared-purpose-token' }],
      requiredSignalTypeCount: 1,
      requiredTermCount: 1,
    });
  });

  test('excludes compatibility entries from specialized coverage while retaining strict request validation', () => {
    const candidate = buildPolicyNativeIntentChangePurposePreflightCandidate({
      command_id: POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID,
      values: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['shared-purpose-token'] },
        semantics: 'compatibility',
      }],
    });

    expect(candidate).toEqual({
      terms: [],
      requiredSignalTypeCount: 0,
      requiredTermCount: 0,
    });
  });

  test('canonicalizes a non-empty purpose command once for both preflight and persistence', () => {
    expect(normalizePolicyNativeIntentChangePurposeCommand({
      command_id: 'update_purpose',
      values: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Animation', 'Animation'] },
      }],
    })).toEqual({
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
    });
  });

  test.each([
    [{ command_id: 'update_hard_limits', values: [] }],
    [{ command_id: POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID, values: [], authority_state: {} }],
    [{ command_id: POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID, values: [{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: [] },
      semantics: 'identity',
    }] }],
    [{ command_id: POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID, values: [{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['allowed'], injected: ['not-allowed'] },
      semantics: 'identity',
    }] }],
    [{ command_id: POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID, values: [{
      signal_type: 'language',
      operator: 'require_any',
      values: { require_any: ['en'] },
      semantics: 'identity',
    }] }],
  ])('rejects a command outside the explicit typed update_purpose contract', (command) => {
    expect(() => buildPolicyNativeIntentChangePurposePreflightCandidate(command))
      .toThrow(PolicyNativeIntentChangePurposePreflightValidationError);
  });

  test('returns revision-bound aggregate advice without retaining or returning purpose terms', () => {
    const response = buildPolicyNativeIntentChangePurposePreflight({
      context: { intent_version: 4 },
      expectedRevision: 4,
      candidate: buildPolicyNativeIntentChangePurposePreflightCandidate(validCommand()),
      overlap: {
        shared_required_term_count: 1,
        overlapping_destination_count: 2,
      },
      evaluatedAt: '2026-08-16T12:00:00.000Z',
    });

    expect(response).toEqual(expect.objectContaining({
      commandId: 'update_purpose',
      expectedRevision: 4,
      currentRevision: 4,
      advisory: true,
      commandRetained: false,
      rawConfigurationExposed: false,
      changeAuthorized: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
      coverage: expect.objectContaining({
        statusId: 'broad_overlap_review_required',
        requiredTermCount: 1,
        sharedRequiredTermCount: 1,
        overlappingDestinationCount: 2,
      }),
    }));
    expect(JSON.stringify(response)).not.toContain('shared-purpose-token');
  });
});
