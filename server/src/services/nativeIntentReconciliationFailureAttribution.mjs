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
  classifyErrorFailureCategory,
} from './nativeIntentReconciliationControlContract.mjs';

const NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS = Object.freeze({
  CONTROL_ELIGIBILITY: 'control_eligibility',
  LIFECYCLE_ELIGIBILITY: 'lifecycle_eligibility',
  CANDIDATE_INPUT_LOAD: 'candidate_input_load',
  CANDIDATE_REPORT_BUILD: 'candidate_report_build',
  LIFECYCLE_PARTITION: 'lifecycle_partition',
  STATE_PLAN: 'state_plan',
  STATE_INITIAL_PERSIST: 'state_initial_persist',
  DRY_RUN_BUILD: 'dry_run_build',
  CONVERSION_APPLY: 'conversion_apply',
  STATE_OUTCOME_PERSIST: 'state_outcome_persist',
  EXECUTION_ORCHESTRATION: 'execution_orchestration',
});

const NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_FIELD =
  'nativeIntentReconciliationFailureStageId';
const SAFE_STAGE_ID_SET = new Set(Object.values(NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS));

function normalizeStageId(value) {
  return SAFE_STAGE_ID_SET.has(value)
    ? value
    : NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS.EXECUTION_ORCHESTRATION;
}

function normalizeFailureCategory(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : 'unexpected_execution_failure';
}

function copyClassifiableErrorFields(source, target) {
  if (!source || typeof source !== 'object') return target;

  if (typeof source.code === 'string') {
    target.code = source.code;
  }
  if (typeof source.failureCategory === 'string') {
    target.failureCategory = source.failureCategory;
  }
  if (typeof source.failure_category === 'string') {
    target.failure_category = source.failure_category;
  }
  if (typeof source.operatorErrorId === 'string') {
    target.operatorErrorId = source.operatorErrorId;
  }
  if (typeof source.operator_error_id === 'string') {
    target.operator_error_id = source.operator_error_id;
  }

  return target;
}

/**
 * Converts an internal exception into a static execution-stage error. The
 * original message, stack, and payload remain private to the failing call and
 * are never copied into the reconciliation result or durable support evidence.
 */
function createNativeIntentReconciliationStageError({ stageId, error }) {
  const attributedError = new Error('Native intent reconciliation execution stage failed');
  attributedError.name = 'NativeIntentReconciliationExecutionStageError';
  attributedError[NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_FIELD] = normalizeStageId(stageId);
  return copyClassifiableErrorFields(error, attributedError);
}

/**
 * Executes one bounded reconciliation stage while retaining only its stable
 * identifier for outer error handling.
 */
async function runNativeIntentReconciliationStage({ stageId, execute }) {
  try {
    return await execute();
  } catch (error) {
    throw createNativeIntentReconciliationStageError({ stageId, error });
  }
}

/**
 * Returns the safe, durable support record for an execution failure. It is
 * deliberately composed from fixed IDs rather than exception text or stack
 * material because database and provider errors can contain credentials,
 * connection details, request payloads, or internal paths.
 */
function buildNativeIntentReconciliationFailureAttribution(error) {
  const stageId = normalizeStageId(error?.[NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_FIELD]);
  const systemFailureCategory = classifyErrorFailureCategory(error) || null;
  const categoryId = normalizeFailureCategory(systemFailureCategory);

  return {
    stageId,
    reasonId: `reconciliation_${stageId}_failed`,
    categoryId,
    systemFailureCategory,
    rawPayloadExposed: false,
  };
}

export {
  NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_FIELD,
  NATIVE_INTENT_RECONCILIATION_FAILURE_STAGE_IDS,
  buildNativeIntentReconciliationFailureAttribution,
  createNativeIntentReconciliationStageError,
  runNativeIntentReconciliationStage,
};
