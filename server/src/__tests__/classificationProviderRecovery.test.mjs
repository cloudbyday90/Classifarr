/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildProviderRecovery,
  getProviderRecoveryMode,
  isProviderRecoveryRoutingBlocked,
  PROVIDER_RECOVERY_MODE_IDS,
  requiresProviderRecoveryReview,
} from '../services/classificationProviderRecovery.mjs';

describe('classificationProviderRecovery', () => {
  test('projects a transient provider failure into a bounded retry state', () => {
    const recovery = buildProviderRecovery({
      recoveryMode: PROVIDER_RECOVERY_MODE_IDS.RETRY_QUEUED,
    });

    expect(recovery).toEqual({
      version: 'provider_recovery.v1',
      mode: PROVIDER_RECOVERY_MODE_IDS.RETRY_QUEUED,
    });
    expect(Object.isFrozen(recovery)).toBe(true);
    expect(JSON.stringify(recovery)).not.toContain('error');
  });

  test('requires review and blocks routing for a permanent provider failure', () => {
    const result = {
      provider_recovery: buildProviderRecovery(),
    };

    expect(getProviderRecoveryMode(result)).toBe(PROVIDER_RECOVERY_MODE_IDS.REVIEW_REQUIRED);
    expect(requiresProviderRecoveryReview(result)).toBe(true);
    expect(isProviderRecoveryRoutingBlocked(result)).toBe(true);
  });

  test('fails closed for unrecognized recovery projections', () => {
    const result = {
      provider_recovery: { version: 'untrusted', mode: PROVIDER_RECOVERY_MODE_IDS.REVIEW_REQUIRED },
    };

    expect(getProviderRecoveryMode(result)).toBeNull();
    expect(requiresProviderRecoveryReview(result)).toBe(true);
    expect(isProviderRecoveryRoutingBlocked(result)).toBe(true);
  });
});
