/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Distinct from scheduler GAP_ANALYSIS (2001): manual and scheduled entrypoints
// share this inner lock without trying to reacquire the outer scheduler session.
export const METADATA_REFILL_OWNER_LOCK = 2023;

export async function withMetadataRefillOwnership(db, refill) {
  let result = { queued: 0 };
  await db.withSessionAdvisoryLock(METADATA_REFILL_OWNER_LOCK, async () => {
    result = await refill();
  });
  return result;
}
