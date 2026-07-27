/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_PROFILE_REFRESH_OUTBOX_WORKER_VERSION =
  'policy.profile_refresh_outbox_worker.v1';

const POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

const POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS = Object.freeze({
  EXECUTION_FAILED: 'profile_refresh_execution_failed',
  LEASE_EXPIRED: 'profile_refresh_lease_expired',
});

const POLICY_PROFILE_REFRESH_OUTBOX_WORKER_BATCH_SIZE = 10;
const POLICY_PROFILE_REFRESH_OUTBOX_WORKER_MAX_ATTEMPTS = 3;
const POLICY_PROFILE_REFRESH_OUTBOX_WORKER_LEASE_SECONDS = 180;
const POLICY_PROFILE_REFRESH_OUTBOX_WORKER_RETRY_DELAYS_SECONDS = Object.freeze([
  60,
  300,
]);

function getPolicyProfileRefreshOutboxRetryDelaySeconds(attemptCount) {
  const normalizedAttemptCount = Number(attemptCount);
  if (!Number.isInteger(normalizedAttemptCount) || normalizedAttemptCount < 1) {
    return POLICY_PROFILE_REFRESH_OUTBOX_WORKER_RETRY_DELAYS_SECONDS[0];
  }

  return POLICY_PROFILE_REFRESH_OUTBOX_WORKER_RETRY_DELAYS_SECONDS[
    Math.min(
      normalizedAttemptCount - 1,
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_RETRY_DELAYS_SECONDS.length - 1,
    )
  ];
}

export {
  getPolicyProfileRefreshOutboxRetryDelaySeconds,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_BATCH_SIZE,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_LEASE_SECONDS,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_MAX_ATTEMPTS,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_RETRY_DELAYS_SECONDS,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_VERSION,
};
