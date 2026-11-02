/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const refusals = new WeakSet();

/** Observed owned-row absence only; message/code equality is not authority. */
export function createAdjudicationAdvanceRefusal() {
  const error = new Error('adjudication_advance_not_owned');
  refusals.add(error);
  return error;
}
export const isAdjudicationAdvanceRefusal = error => refusals.has(error);
