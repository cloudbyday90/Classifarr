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
  CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
} from '../../services/classificationCandidateBoundVerificationContract.mjs';
import {
  CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION,
} from '../../services/classificationDeterministicAiMode.mjs';

export const FIXTURE_TAG = 'classification-decision-path-telemetry-transaction-fixture';
export const PRIVATE_FIXTURE_VALUE = 'synthetic-private-fixture-value';

export function buildFixtureMetadata({ mode, invoked, reasonCode, verificationStatusId = null }) {
  const classificationDetails = {
    deterministic_ai_mode: {
      version: CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION,
      mode,
      invoked,
      reason_code: reasonCode,
      policy_action: invoked ? 'prompt_confirm' : 'auto_classify',
      candidate_count: invoked ? 1 : 0,
    },
  };

  if (verificationStatusId) {
    classificationDetails.candidate_bound_verification = {
      version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
      status_id: verificationStatusId,
    };
  }

  return {
    classification_details: classificationDetails,
    fixture_tag: FIXTURE_TAG,
    fixture_private_value: PRIVATE_FIXTURE_VALUE,
  };
}

export function subtractCounts(after, before) {
  return Object.fromEntries(Object.keys(after).map((key) => [
    key,
    after[key] - before[key],
  ]));
}

/**
 * Runs an integration-test operation without allowing its test fixture data to
 * escape the explicit PostgreSQL transaction. Releasing remains guaranteed if
 * the defensive rollback itself fails.
 */
export async function withRollbackTransaction(pool, operation) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    return await operation(client);
  } finally {
    try {
      if (transactionStarted) {
        await client.query('ROLLBACK');
      }
    } finally {
      client.release();
    }
  }
}
