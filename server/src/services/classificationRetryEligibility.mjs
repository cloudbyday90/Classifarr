/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AUTOMATIC_RECOVERY_TASK_SOURCE, isAutomaticRecoveryDue } from './automaticClassificationRecoveryPolicy.mjs';

export const MANUAL_RETRY_TASK_SOURCE = 'manual_retry';
export const SCHEDULER_RETRY_TASK_SOURCE = 'retry_queue';

function hasValidBudget(row) {
  return Number.isSafeInteger(row?.retry_count) && row.retry_count >= 0 &&
    Number.isSafeInteger(row?.max_retries) && row.max_retries > 0;
}

// This method is produced by the pre-route AI failure path with no destination.
// Do not infer recoverability from arbitrary error text or provider metadata.
export function getExhaustedRetryRecovery(row) {
  if (row?.status !== 'failed' || row.method !== 'queued_for_retry' ||
      row.library_id !== null || row.retry_after !== null || !hasValidBudget(row) ||
      row.retry_count < row.max_retries) return null;

  return { eligible: true, reasonCode: 'retry_exhausted' };
}

export function getClassificationRetryEligibility(row, taskSource = MANUAL_RETRY_TASK_SOURCE) {
  if (taskSource === AUTOMATIC_RECOVERY_TASK_SOURCE) {
    const eligible = getExhaustedRetryRecovery(row) !== null && isAutomaticRecoveryDue(row);
    return { eligible, reasonCode: eligible ? null : 'automatic_recovery_ineligible' };
  }
  if (taskSource === SCHEDULER_RETRY_TASK_SOURCE) {
    if (row?.status !== 'pending_retry') return { eligible: false, reasonCode: 'status_ineligible' };
    if (!hasValidBudget(row) || row.retry_count >= row.max_retries) {
      return { eligible: false, reasonCode: 'retry_budget_exhausted' };
    }
    return { eligible: true, reasonCode: null };
  }

  const eligible = row?.status === 'awaiting_decision' || row?.status === 'pending_retry' ||
    (taskSource === MANUAL_RETRY_TASK_SOURCE && getExhaustedRetryRecovery(row) !== null);
  return { eligible, reasonCode: eligible ? null : 'status_ineligible' };
}
