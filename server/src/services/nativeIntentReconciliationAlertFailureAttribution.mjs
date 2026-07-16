/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS = Object.freeze({
  STATUS_READ: 'alert_status_read',
  TRANSACTION: 'alert_transaction',
  STATE_LOAD: 'alert_state_load',
  NOTIFICATION_PERSIST: 'alert_notification_persist',
  STATE_PERSIST: 'alert_state_persist',
  EVALUATION: 'alert_evaluation',
});

const NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_FIELD =
  'nativeIntentReconciliationAlertFailureStageId';
const SAFE_STAGE_ID_SET = new Set(
  Object.values(NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS),
);

const REASON_ID_BY_STAGE_AND_SQLSTATE = Object.freeze({
  [`${NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS.STATE_PERSIST}:42P08`]:
    'reconciliation_alert_state_parameter_contract_invalid',
});

function normalizeStageId(value, fallbackStageId) {
  if (SAFE_STAGE_ID_SET.has(value)) return value;
  return SAFE_STAGE_ID_SET.has(fallbackStageId)
    ? fallbackStageId
    : NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS.EVALUATION;
}

function normalizeSqlState(value) {
  return typeof value === 'string' && /^[0-9A-Z]{5}$/u.test(value)
    ? value
    : null;
}

function createNativeIntentReconciliationAlertStageError({ stageId, error }) {
  const resolvedStageId = normalizeStageId(
    error?.[NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_FIELD],
    stageId,
  );
  const attributedError = new Error('Native intent reconciliation alert stage failed');
  attributedError.name = 'NativeIntentReconciliationAlertStageError';
  attributedError[NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_FIELD] = resolvedStageId;

  const sqlState = normalizeSqlState(error?.code);
  if (sqlState) attributedError.code = sqlState;

  return attributedError;
}

async function runNativeIntentReconciliationAlertStage({ stageId, execute }) {
  try {
    return await execute();
  } catch (error) {
    throw createNativeIntentReconciliationAlertStageError({ stageId, error });
  }
}

function buildNativeIntentReconciliationAlertFailureAttribution(error) {
  const stageId = normalizeStageId(
    error?.[NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_FIELD],
  );
  const sqlState = normalizeSqlState(error?.code);
  const reasonId = REASON_ID_BY_STAGE_AND_SQLSTATE[`${stageId}:${sqlState}`] ||
    (stageId === NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS.EVALUATION
      ? 'alert_evaluation_failed'
      : `reconciliation_${stageId}_failed`);

  return {
    stageId,
    reasonId,
    categoryId: 'alert_evaluation',
    rawPayloadExposed: false,
  };
}

export {
  NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_FIELD,
  NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS,
  buildNativeIntentReconciliationAlertFailureAttribution,
  createNativeIntentReconciliationAlertStageError,
  runNativeIntentReconciliationAlertStage,
};
