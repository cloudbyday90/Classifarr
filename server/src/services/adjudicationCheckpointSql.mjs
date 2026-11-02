/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Dispatch after the owned prelock: retention decisions use a fresh statement-time anchor.
export const READ_OWNED_ADJUDICATION_PROGRESS_SQL = `SELECT progress_key,
  CASE WHEN captured_at<=statement_timestamp() AND expires_at>statement_timestamp() THEN progress END AS progress
  FROM adjudication_capture_budget
  WHERE singleton=true AND revision=$1 AND finalization_attempt_id=$2::uuid AND daily_calls>0 FOR UPDATE`;
export const READ_REUSABLE_ADJUDICATION_BATCH_SQL = `SELECT batch,captured_at,expires_at FROM cached_adjudication_batch
  WHERE captured_at<=statement_timestamp() AND expires_at>statement_timestamp()`;
export const OPEN_ADJUDICATION_PROGRESS_SQL = `UPDATE adjudication_capture_budget SET progress_key=$2,progress=$3::jsonb,
  captured_at=COALESCE($4::timestamptz,statement_timestamp()),expires_at=COALESCE($5::timestamptz,statement_timestamp()+interval '7 days'),
  published_fingerprint=NULL WHERE singleton=true AND revision=$1 AND finalization_attempt_id=$6::uuid`;
export const RECORD_ADJUDICATION_PROGRESS_SQL = `UPDATE adjudication_capture_budget SET progress=$3::jsonb
  WHERE singleton=true AND revision=$1 AND finalization_attempt_id=$4::uuid AND daily_calls>0 AND progress_key=$2
    AND captured_at<=statement_timestamp() AND expires_at>statement_timestamp()`;
