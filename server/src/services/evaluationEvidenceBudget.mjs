/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const exceededLimits = new WeakSet();

/** Mint only where the amount of evidence has crossed an enforced limit. */
export function createEvidenceBudgetError(message) {
  const error = new Error(message);
  exceededLimits.add(error);
  return error;
}

export function isEvidenceBudgetError(error) {
  return exceededLimits.has(error);
}
