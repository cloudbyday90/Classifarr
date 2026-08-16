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
  loadPolicyNativeIntentChangePurposePreflightContext,
} from './policyNativeIntentChangePurposePreflightPersistence.mjs';

function asRows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

/**
 * Reads only the active native purpose collection. The shared authority read
 * is intentionally non-locking because the write endpoint owns its later
 * transaction lock and revision comparison.
 */
async function loadPolicyNativeIntentPurposeChangeReadContext({ db, policyId }) {
  const context = await loadPolicyNativeIntentChangePurposePreflightContext({ db, policyId });
  if (!context || context.authority?.authoritative !== true || !context.activeIntent?.id) {
    return context ? { ...context, purposeRules: [] } : null;
  }

  const rulesResult = await db.query(
    `SELECT
       signal_type,
       operator,
       values,
       constraint_mode,
       semantics,
       source,
       inference_state
     FROM policy_intent_rules
     WHERE intent_id = $1
       AND intent_role = 'purpose'
       AND collection = 'purpose'
     ORDER BY sort_order, id`,
    [context.activeIntent.id],
  );

  return {
    ...context,
    purposeRules: asRows(rulesResult),
  };
}

export {
  loadPolicyNativeIntentPurposeChangeReadContext,
};
