/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const READ_AUTOMATIC_EVALUATION_STATE_SQL = `
  SELECT status, input_fingerprint, failure_count, report,
    next_check_at > statement_timestamp() AND next_check_at <= statement_timestamp() + INTERVAL '60 minutes'
      AND observed_at <= statement_timestamp() AS cooling_down
  FROM automatic_destination_evaluation WHERE singleton = true`;

export const SAVE_AUTOMATIC_EVALUATION_SQL = `
  INSERT INTO automatic_destination_evaluation
    (singleton, status, input_fingerprint, report, observed_at, evaluated_at, next_check_at)
  VALUES (true, 'complete', $1, $2::jsonb, $3::timestamptz, $3::timestamptz, statement_timestamp() + INTERVAL '5 minutes')
  ON CONFLICT (singleton) DO UPDATE SET status = 'complete', input_fingerprint = EXCLUDED.input_fingerprint,
    report = EXCLUDED.report, observed_at = EXCLUDED.observed_at,
    evaluated_at = CASE WHEN automatic_destination_evaluation.input_fingerprint = EXCLUDED.input_fingerprint
      AND automatic_destination_evaluation.evaluated_at <= EXCLUDED.observed_at
      THEN automatic_destination_evaluation.evaluated_at ELSE EXCLUDED.evaluated_at END,
    next_check_at = EXCLUDED.next_check_at, failure_count = 0, failure_code = NULL
  WHERE automatic_destination_evaluation.observed_at <= EXCLUDED.observed_at
    OR automatic_destination_evaluation.observed_at > statement_timestamp()`;

export const FAIL_AUTOMATIC_EVALUATION_SQL = `
  INSERT INTO automatic_destination_evaluation
    (singleton, status, observed_at, next_check_at, failure_count, failure_code)
  VALUES (true, 'failed', statement_timestamp(), statement_timestamp() + INTERVAL '5 minutes', 1, $1)
  ON CONFLICT (singleton) DO UPDATE SET status = 'failed', input_fingerprint = NULL, report = NULL,
    observed_at = statement_timestamp(), evaluated_at = NULL,
    failure_count = LEAST(5, automatic_destination_evaluation.failure_count + 1), failure_code = EXCLUDED.failure_code,
    next_check_at = statement_timestamp() + LEAST(60, 5 * power(2, automatic_destination_evaluation.failure_count)) * INTERVAL '1 minute'`;

export const READ_AUTOMATIC_EVALUATION_STATUS_SQL = `
  SELECT CASE WHEN status = 'failed' THEN 'failed'
    WHEN observed_at > statement_timestamp() OR observed_at <= statement_timestamp() - INTERVAL '15 minutes' THEN 'stale'
    ELSE 'complete' END AS status,
    observed_at, evaluated_at, next_check_at, failure_code,
    CASE WHEN status = 'complete' AND observed_at <= statement_timestamp()
      AND observed_at > statement_timestamp() - INTERVAL '15 minutes' THEN report END AS report
  FROM automatic_destination_evaluation WHERE singleton = true`;
