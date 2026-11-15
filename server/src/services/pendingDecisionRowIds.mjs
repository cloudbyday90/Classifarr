/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';

const MAX_SAFE_ID = BigInt(Number.MAX_SAFE_INTEGER);

function canonicalPendingRowId(value) {
  const exact = canonicalDatabaseBigintId(value);
  if (exact === null) throw new Error('Invalid pending classification row identifier');
  return exact;
}

/** Match the production parser without rounding any predecessor identity. */
export function pendingDecisionPredecessorId(value) {
  const exact = canonicalPendingRowId(value);
  return BigInt(exact) <= MAX_SAFE_ID ? Number(exact) : exact;
}

/** Validate while rollback is possible; preserve every valid callback value/type. */
export function validatePendingDecisionInsertedId(value) {
  canonicalPendingRowId(value);
  return value;
}
