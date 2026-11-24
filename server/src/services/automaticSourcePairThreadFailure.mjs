/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { createEvidenceBudgetError, INVENTORY_PROFILE_FEATURE_BUDGET, isEvidenceBudgetError } from './evaluationEvidenceBudget.mjs';

export function sourcePairThreadFailure(error, includePlan) {
  return !includePlan && isEvidenceBudgetError(error, INVENTORY_PROFILE_FEATURE_BUDGET)
    ? { failure: INVENTORY_PROFILE_FEATURE_BUDGET }
    : { failed: true };
}

export function readSourcePairThreadFailure(message) {
  if (!message || typeof message !== 'object' || Reflect.ownKeys(message).length !== 1) return null;
  // A cloned record can arrive from a different JavaScript realm.
  const prototype = Object.getPrototypeOf(message);
  if (prototype !== null && Object.getPrototypeOf(prototype) !== null) return null;
  const field = Object.getOwnPropertyDescriptor(message, 'failure');
  return field?.enumerable && field.value === INVENTORY_PROFILE_FEATURE_BUDGET
    ? createEvidenceBudgetError(INVENTORY_PROFILE_FEATURE_BUDGET)
    : null;
}
