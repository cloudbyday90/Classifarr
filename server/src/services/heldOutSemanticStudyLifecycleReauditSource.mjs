/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as database from '../config/database.mjs';
import {
  buildPolicyPurposeLifecycleReceiptSourceCtesSql,
  POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS,
} from './policyPurposeLifecycleReceiptSources.mjs';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || {} : {};
}

/**
 * Reads a fixed aggregate state from the durable, verified normal-policy
 * lifecycle receipts. The database deliberately retains all identifiers,
 * values, library details, configuration, and media records.
 */
export async function loadHeldOutSemanticStudyLifecycleReauditSourceRecord({
  db = database,
} = {}) {
  const result = await db.query(
    `WITH ${buildPolicyPurposeLifecycleReceiptSourceCtesSql({
      scope: 'aggregate-receipt-state',
    })}
     SELECT
       COUNT(*)::INTEGER AS normal_lifecycle_receipt_count,
       COUNT(*) FILTER (
         WHERE lifecycle_transition = '${POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS.INITIAL_INTENT_ESTABLISHMENT}'
       )::INTEGER AS initial_intent_establishment_count,
       COUNT(*) FILTER (
         WHERE lifecycle_transition = '${POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS.NATIVE_INTENT_CHANGE}'
       )::INTEGER AS native_intent_change_count,
       COUNT(*) FILTER (
         WHERE lifecycle_transition = '${POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS.LIBRARY_REBUILD_REPLACEMENT}'
       )::INTEGER AS library_rebuild_replacement_count
     FROM normal_lifecycle_receipts`,
  );

  return firstRow(result);
}
