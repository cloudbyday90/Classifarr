/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const READ_SOURCE_PAIR_STATE_SQL = `SELECT status, input_fingerprint, report, cohort, cohort_created_at::text,
  next_check_at > statement_timestamp() AND next_check_at <= statement_timestamp() + INTERVAL '60 minutes'
    AND observed_at <= statement_timestamp() AS cooling_down
  FROM automatic_source_pair_evaluation WHERE singleton=true`;

export const SAVE_SOURCE_PAIR_SQL = `INSERT INTO automatic_source_pair_evaluation
  (singleton,status,input_fingerprint,report,observed_at,evaluated_at,next_check_at,cohort,cohort_created_at)
  VALUES(true,'complete',$1,$2::jsonb,$3::timestamptz,$3::timestamptz,statement_timestamp()+INTERVAL '5 minutes',$4::jsonb,$5::timestamptz)
  ON CONFLICT(singleton) DO UPDATE SET status='complete',input_fingerprint=EXCLUDED.input_fingerprint,
    report=EXCLUDED.report,observed_at=EXCLUDED.observed_at,
    evaluated_at=CASE WHEN automatic_source_pair_evaluation.input_fingerprint=EXCLUDED.input_fingerprint
      AND automatic_source_pair_evaluation.evaluated_at<=EXCLUDED.observed_at
      THEN automatic_source_pair_evaluation.evaluated_at ELSE EXCLUDED.evaluated_at END,
    next_check_at=EXCLUDED.next_check_at,cohort=EXCLUDED.cohort,cohort_created_at=EXCLUDED.cohort_created_at,
    failure_count=0,failure_code=NULL
  WHERE automatic_source_pair_evaluation.observed_at<=EXCLUDED.observed_at
    OR automatic_source_pair_evaluation.observed_at>statement_timestamp()`;

export const FAIL_SOURCE_PAIR_SQL = `INSERT INTO automatic_source_pair_evaluation
  (singleton,status,observed_at,next_check_at,failure_count,failure_code)
  VALUES(true,'failed',statement_timestamp(),statement_timestamp()+INTERVAL '5 minutes',1,$1)
  ON CONFLICT(singleton) DO UPDATE SET status='failed',input_fingerprint=NULL,report=NULL,evaluated_at=NULL,
    observed_at=statement_timestamp(),failure_code=EXCLUDED.failure_code,
    failure_count=LEAST(5,automatic_source_pair_evaluation.failure_count+1),
    next_check_at=statement_timestamp()+LEAST(60,5*power(2,automatic_source_pair_evaluation.failure_count))*INTERVAL '1 minute',
    cohort=CASE WHEN automatic_source_pair_evaluation.cohort_created_at<=statement_timestamp()
      AND automatic_source_pair_evaluation.cohort_created_at>statement_timestamp()-INTERVAL '30 days'
      THEN automatic_source_pair_evaluation.cohort END,
    cohort_created_at=CASE WHEN automatic_source_pair_evaluation.cohort_created_at<=statement_timestamp()
      AND automatic_source_pair_evaluation.cohort_created_at>statement_timestamp()-INTERVAL '30 days'
      THEN automatic_source_pair_evaluation.cohort_created_at END`;

export const READ_SOURCE_PAIR_STATUS_SQL = `SELECT
  CASE WHEN status='failed' THEN 'failed'
    WHEN observed_at>statement_timestamp() OR observed_at<=statement_timestamp()-INTERVAL '15 minutes' THEN 'stale'
    ELSE 'complete' END AS status, observed_at,evaluated_at,next_check_at,failure_code,
  CASE WHEN status='complete' AND observed_at<=statement_timestamp()
    AND observed_at>statement_timestamp()-INTERVAL '15 minutes' THEN report END AS report
  FROM automatic_source_pair_evaluation WHERE singleton=true`;
