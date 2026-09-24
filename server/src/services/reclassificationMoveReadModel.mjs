/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Static SQL fragments only; do not interpolate request values or the private plan.
export const moveRecoveryJsonSql = `jsonb_build_object(
  'operationId', move.id, 'state', move.state, 'reasonCode', move.reason_code,
  'nextAttemptAt', CASE WHEN move.state IN ('moving', 'files_verified') THEN move.next_attempt_at END,
  'updatedAt', move.updated_at, 'completedAt', move.completed_at)`;

export const historyMoveRecoverySql = `(SELECT ${moveRecoveryJsonSql}
  FROM reclassification_move_operations move WHERE move.classification_id = ch.id
  ORDER BY (move.state <> 'completed') DESC, move.created_at DESC, move.id DESC LIMIT 1)`;
