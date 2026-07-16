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
  NATIVE_INTENT_RECONCILIATION_RESTORE_GATE_STATE_IDS,
  buildReconciliationExecutionEligibility,
  validateReentryAction,
} from '../../services/nativeIntentReconciliationLifecycleContract.mjs';

describe('nativeIntentReconciliationLifecycleContract', () => {
  test('fails closed for an unknown restore gate state', () => {
    const result = buildReconciliationExecutionEligibility({
      gate_state: 'unexpected_external_state',
    });

    expect(result).toEqual(expect.objectContaining({
      allowed: false,
      gateState: NATIVE_INTENT_RECONCILIATION_RESTORE_GATE_STATE_IDS.REQUIRES_MAINTENANCE,
      reasonId: 'restore_validation_failed',
      rawPayloadExposed: false,
    }));
  });

  test('allows execution only after the restore gate is ready', () => {
    const result = buildReconciliationExecutionEligibility({
      gate_state: 'ready',
      reason_id: 'restore_verified',
    });

    expect(result).toEqual(expect.objectContaining({
      allowed: true,
      gateState: 'ready',
      reasonId: 'restore_verified',
    }));
  });

  test('requires an attributable approved re-entry action', () => {
    expect(validateReentryAction({
      actorSourceId: 'manual_operator',
      reasonCode: 'operator_reviewed',
    })).toEqual(expect.objectContaining({
      ok: false,
      reasonId: 'reentry_actor_identity_required',
    }));

    expect(validateReentryAction({
      actorSourceId: 'manual_operator',
      actorId: 7,
      reasonCode: 'operator_reviewed',
    })).toEqual(expect.objectContaining({
      ok: true,
      normalizedAction: expect.objectContaining({
        actorType: 'operator',
        actorId: 7,
        reasonCode: 'operator_reviewed',
      }),
    }));
  });
});
