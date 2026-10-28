/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const READ_GAP_AUDIT_STATE_SQL = `SELECT status,input_fingerprint,report,
  next_check_at > statement_timestamp() AND next_check_at <= statement_timestamp()+INTERVAL '60 minutes'
    AND observed_at <= statement_timestamp() AS cooling_down
  FROM automatic_evidence_gap_audit WHERE singleton=true`;
export const SAVE_GAP_AUDIT_SQL = `INSERT INTO automatic_evidence_gap_audit
  (singleton,status,input_fingerprint,report,observed_at,evaluated_at,next_check_at)
  VALUES(true,'complete',$1,$2::jsonb,$3::timestamptz,$3::timestamptz,statement_timestamp()+INTERVAL '5 minutes')
  ON CONFLICT(singleton) DO UPDATE SET status='complete',input_fingerprint=EXCLUDED.input_fingerprint,
    report=EXCLUDED.report,observed_at=EXCLUDED.observed_at,
    evaluated_at=CASE WHEN automatic_evidence_gap_audit.input_fingerprint=EXCLUDED.input_fingerprint
      AND automatic_evidence_gap_audit.evaluated_at<=EXCLUDED.observed_at
      THEN automatic_evidence_gap_audit.evaluated_at ELSE EXCLUDED.evaluated_at END,
    next_check_at=EXCLUDED.next_check_at,failure_count=0,failure_code=NULL
  WHERE automatic_evidence_gap_audit.observed_at<=EXCLUDED.observed_at
    OR automatic_evidence_gap_audit.observed_at>statement_timestamp()`;
export const FAIL_GAP_AUDIT_SQL = `INSERT INTO automatic_evidence_gap_audit
  (singleton,status,observed_at,next_check_at,failure_count,failure_code)
  VALUES(true,'failed',statement_timestamp(),statement_timestamp()+INTERVAL '5 minutes',1,$1)
  ON CONFLICT(singleton) DO UPDATE SET status='failed',input_fingerprint=NULL,report=NULL,
    observed_at=statement_timestamp(),evaluated_at=NULL,
    failure_count=LEAST(5,automatic_evidence_gap_audit.failure_count+1),failure_code=EXCLUDED.failure_code,
    next_check_at=statement_timestamp()+LEAST(60,5*power(2,automatic_evidence_gap_audit.failure_count))*INTERVAL '1 minute'`;
export const READ_GAP_AUDIT_STATUS_SQL = `SELECT status,failure_code,observed_at,evaluated_at,next_check_at,
  CASE WHEN octet_length(report::text)<=16384 THEN report END AS report
  FROM automatic_evidence_gap_audit WHERE singleton=true`;
