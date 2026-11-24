/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const INVENTORY_PROFILE_FEATURE_BUDGET = 'inventory_profile_feature_budget';

const exceededLimits = new WeakMap();

/** Mint only where the amount of evidence has crossed an enforced limit. */
export function createEvidenceBudgetError(message) {
  const error = new Error(message);
  exceededLimits.set(error, message);
  return error;
}

export function isEvidenceBudgetError(error, limit) {
  return limit === undefined ? exceededLimits.has(error) : exceededLimits.get(error) === limit;
}
