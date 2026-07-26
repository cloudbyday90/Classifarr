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
  buildPolicyManualCorrectionExecutionAuthorizationContext,
  revalidatePolicyManualCorrectionExecutionAuthorization,
} from '../../services/policyManualCorrectionExecutionAuthorization.mjs';

describe('policyManualCorrectionExecutionAuthorization', () => {
  test('authorizes only the authenticated server-derived actor that matches intake', () => {
    const context = buildPolicyManualCorrectionExecutionAuthorizationContext({
      actorId: 'operator-7',
      authenticated: true,
    });

    const authorization = revalidatePolicyManualCorrectionExecutionAuthorization({
      intake: { actorId: 'operator-7' },
      authorizationContext: context,
    });

    expect(authorization).toEqual(expect.objectContaining({
      actorTypeId: 'operator',
      actorId: 'operator-7',
      revalidated: true,
      canRecordOutcome: true,
      canWriteLearning: true,
      authorizedSourceIds: ['manual_classification_change'],
    }));
  });

  test('fails closed for an unauthenticated or mismatched actor context', () => {
    const unauthenticated = revalidatePolicyManualCorrectionExecutionAuthorization({
      intake: { actorId: 'operator-7' },
      authorizationContext: buildPolicyManualCorrectionExecutionAuthorizationContext({
        actorId: 'operator-7',
        authenticated: false,
      }),
    });
    const mismatch = revalidatePolicyManualCorrectionExecutionAuthorization({
      intake: { actorId: 'operator-7' },
      authorizationContext: buildPolicyManualCorrectionExecutionAuthorizationContext({
        actorId: 'operator-8',
        authenticated: true,
      }),
    });

    expect(unauthenticated.canRecordOutcome).toBe(false);
    expect(mismatch.canWriteLearning).toBe(false);
    expect(mismatch.authorizedSourceIds).toEqual([]);
  });
});
