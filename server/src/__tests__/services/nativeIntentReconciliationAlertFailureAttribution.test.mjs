/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_FIELD,
  NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS,
  buildNativeIntentReconciliationAlertFailureAttribution,
  createNativeIntentReconciliationAlertStageError,
  runNativeIntentReconciliationAlertStage,
} from '../../services/nativeIntentReconciliationAlertFailureAttribution.mjs';

describe('Native intent reconciliation alert failure attribution', () => {
  test('maps the known PostgreSQL parameter contract failure without retaining source text', () => {
    const sourceError = Object.assign(
      new Error('inconsistent types deduced for parameter $2; postgres://secret@example'),
      { code: '42P08' },
    );
    const error = createNativeIntentReconciliationAlertStageError({
      stageId: NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS.STATE_PERSIST,
      error: sourceError,
    });

    expect(error).toMatchObject({
      name: 'NativeIntentReconciliationAlertStageError',
      code: '42P08',
      [NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_FIELD]:
        NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS.STATE_PERSIST,
    });
    expect(error.message).not.toContain('secret');
    expect(buildNativeIntentReconciliationAlertFailureAttribution(error)).toEqual({
      stageId: NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS.STATE_PERSIST,
      reasonId: 'reconciliation_alert_state_parameter_contract_invalid',
      categoryId: 'alert_evaluation',
      rawPayloadExposed: false,
    });
  });

  test('retains the inner safe stage when the transaction wrapper rethrows it', async () => {
    const sourceError = Object.assign(new Error('database detail must remain private'), {
      code: '42P08',
    });

    await expect(runNativeIntentReconciliationAlertStage({
      stageId: NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS.TRANSACTION,
      execute: () => runNativeIntentReconciliationAlertStage({
        stageId: NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS.STATE_PERSIST,
        execute: async () => {
          throw sourceError;
        },
      }),
    })).rejects.toMatchObject({
      code: '42P08',
      [NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_FIELD]:
        NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS.STATE_PERSIST,
    });
  });
});
