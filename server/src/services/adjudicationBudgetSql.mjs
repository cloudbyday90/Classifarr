/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const today = "(statement_timestamp() AT TIME ZONE 'UTC')::date";
export const RESET_ADJUDICATION_DAY_SQL = `UPDATE adjudication_capture_budget SET
  quota_day=${today},calls_reserved=0,tokens_reserved=0 WHERE quota_day<${today}`;
export const PRUNE_ADJUDICATION_PROGRESS_SQL = `UPDATE adjudication_capture_budget SET
  progress_key=NULL,progress=NULL,captured_at=NULL,expires_at=NULL,published_fingerprint=NULL
  WHERE captured_at>statement_timestamp() OR expires_at<=statement_timestamp()`;
export const READ_ADJUDICATION_BUDGET_SQL = `SELECT revision,daily_calls,daily_tokens,quota_day::text,
  calls_reserved,tokens_reserved,selection_offset,next_check_at,status,published_fingerprint,
  next_check_at>statement_timestamp() AND next_check_at<=statement_timestamp()+interval '60 minutes' AS cooling_down
  FROM adjudication_capture_budget WHERE singleton=true`;
export const RESERVE_ADJUDICATION_SQL = `UPDATE adjudication_capture_budget SET
  calls_reserved=calls_reserved+1,tokens_reserved=tokens_reserved+8448
  WHERE singleton=true AND revision=$1 AND daily_calls>0 AND daily_tokens>0
    AND calls_reserved<daily_calls AND tokens_reserved+8448<=daily_tokens
    AND quota_day<=${today} RETURNING calls_reserved`;
export const PUBLISH_ADJUDICATION_PROGRESS_SQL = `INSERT INTO cached_adjudication_batch(singleton,batch,captured_at,expires_at)
  SELECT true,progress,captured_at,expires_at FROM adjudication_capture_budget
    WHERE singleton=true AND revision=$1 AND progress_key=$2 AND daily_calls>0
      AND captured_at<=statement_timestamp() AND expires_at>statement_timestamp()
  ON CONFLICT(singleton) DO UPDATE SET batch=EXCLUDED.batch,captured_at=EXCLUDED.captured_at,expires_at=EXCLUDED.expires_at`;
