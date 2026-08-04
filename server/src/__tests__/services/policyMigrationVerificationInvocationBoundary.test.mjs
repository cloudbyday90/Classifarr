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
  POLICY_MIGRATION_VERIFICATION_INVOCATION_RISK_IDS,
  POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS,
  buildPolicyMigrationVerificationInvocationAdmission,
} from '../../services/policyMigrationVerificationInvocationBoundary.mjs';

function invocation(overrides = {}) {
  return {
    proposal: { library: { libraryId: 6, mediaType: 'movie' } },
    acceptanceTransition: {
      policyContext: { policyId: 44, intentId: 101, libraryId: 6 },
    },
    now: new Date('2026-07-29T14:00:00.000Z'),
    ...overrides,
  };
}

describe('policyMigrationVerificationInvocationBoundary', () => {
  test('admits one cloned fixed invocation for the library rebuild cutover', () => {
    const input = invocation();
    const result = buildPolicyMigrationVerificationInvocationAdmission({
      invocationScopeId:
        POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS.LIBRARY_REBUILD_CUTOVER,
      input,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      issues: [],
      normalWorkflowSurface: false,
      sideEffects: {
        databaseRead: false,
        verificationRunPersisted: false,
        policyStorageMutated: false,
        routingWritten: false,
        learningWritten: false,
        providerAccessed: false,
        schedulerTriggered: false,
      },
    }));
    expect(result.acceptedInput).toEqual(input);
    expect(result.acceptedInput).not.toBe(input);
    expect(result.acceptedInput.proposal).not.toBe(input.proposal);
  });

  test.each([
    [
      'scope mismatch',
      'policy_authoring',
      invocation(),
      POLICY_MIGRATION_VERIFICATION_INVOCATION_RISK_IDS.INVALID_INVOCATION_SCOPE,
    ],
    [
      'unexpected client control',
      POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS.LIBRARY_REBUILD_CUTOVER,
      invocation({ providerId: 9 }),
      POLICY_MIGRATION_VERIFICATION_INVOCATION_RISK_IDS.UNEXPECTED_INVOCATION_FIELD,
    ],
    [
      'missing server evaluation time',
      POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS.LIBRARY_REBUILD_CUTOVER,
      invocation({ now: '2026-07-29T14:00:00.000Z' }),
      POLICY_MIGRATION_VERIFICATION_INVOCATION_RISK_IDS.INVALID_INVOCATION_INPUT,
    ],
  ])('rejects %s without a usable invocation', (_name, invocationScopeId, input, riskId) => {
    const result = buildPolicyMigrationVerificationInvocationAdmission({
      invocationScopeId,
      input,
    });

    expect(result.ok).toBe(false);
    expect(result.acceptedInput).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId }),
    ]));
  });
});
