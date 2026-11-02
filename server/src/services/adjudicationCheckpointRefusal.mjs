/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const refusals = new WeakSet();

/** Exact owned-row absence, observed by the repository; never inferred from payload/errors. */
export function createAdjudicationCheckpointRefusal() {
  const error = new Error('adjudication_checkpoint_not_owned');
  refusals.add(error);
  return error;
}
export const isAdjudicationCheckpointRefusal = error => refusals.has(error);
