/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_PROSPECTIVE_OUTCOME_SQL } from './inventoryProspectiveOutcomeRepository.mjs';
import { INVENTORY_PROSPECTIVE_ACTIVITY_SQL } from './inventoryProspectiveActivityRepository.mjs';
import { INVENTORY_PROSPECTIVE_MAX_INPUT_BYTES } from './inventoryProspectiveLimits.mjs';
import { READ_POLICY_EVALUATION_INPUT_SQL } from './policyEvaluationCaptureRead.mjs';

// Admit the materialized bounded payload in PostgreSQL before transferring private rows.
export const READ_INVENTORY_PROSPECTIVE_INPUT_SQL = `WITH audit_rows AS MATERIALIZED (${INVENTORY_PROSPECTIVE_OUTCOME_SQL}),
  budget AS (SELECT COUNT(*)::int AS captures,COALESCE(SUM(pg_column_size(to_jsonb(r))),0)::text AS payload_bytes FROM audit_rows r)
  SELECT to_jsonb(r)||jsonb_build_object('classification_id',r.classification_id::text) AS input,b.captures,b.payload_bytes
  FROM audit_rows r CROSS JOIN budget b WHERE b.captures<=5000 AND b.payload_bytes::bigint<=$3::bigint
  UNION ALL SELECT NULL,b.captures,b.payload_bytes FROM budget b
  WHERE b.captures=0 OR b.captures>5000 OR b.payload_bytes::bigint>$3::bigint`;

/** Caller owns a coherent UTC read-only transaction. Prefixes preserve existing audit failure contracts. */
export async function readInventoryProspectiveSnapshot(client, errorPrefix = 'inventory_disagreement', { policyEvaluation = false } = {}) {
  if (!['inventory_disagreement', 'evidence_gap_audit'].includes(errorPrefix)) throw new Error('inventory_prospective_invalid_reader');
  const fail = suffix => { throw new Error(`${errorPrefix}_${suffix}`); };
  const clock = (await client.query("SELECT date_trunc('milliseconds',transaction_timestamp()) AS observed_at")).rows[0]?.observed_at;
  const observedAt = clock instanceof Date && Number.isFinite(clock.getTime()) ? clock.toISOString() : clock;
  if (typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt)) || new Date(observedAt).toISOString() !== observedAt) fail('invalid_clock');
  const window = { since: new Date(Date.parse(observedAt) - 30 * 86400000).toISOString(), until: observedAt };
  const params = [window.since, window.until];
  const activity = (await client.query(INVENTORY_PROSPECTIVE_ACTIVITY_SQL, params)).rows[0];
  const result = await client.query(policyEvaluation ? READ_POLICY_EVALUATION_INPUT_SQL : READ_INVENTORY_PROSPECTIVE_INPUT_SQL,
    [...params, INVENTORY_PROSPECTIVE_MAX_INPUT_BYTES]);
  const header = result.rows[0];
  if (!header || !Number.isSafeInteger(header.captures) || header.captures < 0 || !/^[0-9]{1,12}$/.test(header.payload_bytes)) fail('invalid_input');
  if (header.captures > 5000 || Number(header.payload_bytes) > INVENTORY_PROSPECTIVE_MAX_INPUT_BYTES) fail('input_budget');
  const rows = result.rows.filter(row => row.input !== null).map(row => row.input);
  if (rows.length !== header.captures) fail('invalid_input');
  return { observedAt, inputs: { observedAt, window, activity, rows } };
}
