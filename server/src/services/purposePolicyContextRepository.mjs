/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';

// Only the opt-in case reader executes this query. Never join current policy/library configuration.
export const PURPOSE_POLICY_CONTEXT_SQL = `WITH requested AS MATERIALIZED (
    SELECT DISTINCT unnest($1::bigint[]) AS classification_id
  ), contexts AS MATERIALIZED (
    SELECT r.classification_id::text AS "classificationId",CASE WHEN c.classification_id IS NOT NULL THEN jsonb_build_object(
      'classificationId',c.classification_id::text,'version',c.capture_version,'mediaType',c.media_type,'identityKey',c.identity_key,
      'observedMicros',(extract(epoch FROM c.observed_at)*1000000)::numeric(30,0)::text,
      'expiresMicros',(extract(epoch FROM c.expires_at)*1000000)::numeric(30,0)::text,
      'reasonId',c.reason_id,'expiredAt',c.expired_at,'payloadBytes',octet_length(c.payload::text),
      'payload',CASE WHEN c.expires_at>$2::timestamptz AND c.expired_at IS NULL
        AND octet_length(c.payload::text)<=65536 THEN c.payload END) END AS capture
    FROM requested r LEFT JOIN classification_policy_evaluation_captures c ON c.classification_id=r.classification_id
  ), budget AS (SELECT COUNT(*)::int AS captures,COALESCE(SUM(octet_length(to_jsonb(c)::text)),0)::text AS payload_bytes FROM contexts c)
  SELECT to_jsonb(c) AS input,b.captures,b.payload_bytes FROM contexts c CROSS JOIN budget b
    WHERE b.captures<=5000 AND b.payload_bytes::bigint<=$3::bigint
  UNION ALL SELECT NULL,b.captures,b.payload_bytes FROM budget b
    WHERE b.captures=0 OR b.captures>5000 OR b.payload_bytes::bigint>$3::bigint`;

/** Complete, parameter-bound input; the remaining budget includes every transferred context envelope. */
export async function readPurposePolicyContextInputs(client, input, sourceBytes) {
  const ids = new Set(input.rows.map(row => canonicalDatabaseBigintId(row?.classification_id)));
  if (ids.has(null) || ids.size > 5000 || !Number.isSafeInteger(sourceBytes) || sourceBytes < 0 || sourceBytes > 67108864) {
    throw new Error('purpose_context_invalid_input');
  }
  const { rows } = await client.query(PURPOSE_POLICY_CONTEXT_SQL, [[...ids], input.observedAt, 67108864 - sourceBytes]);
  const header = rows[0];
  if (!header || header.captures !== ids.size || !/^[0-9]{1,12}$/.test(header.payload_bytes) ||
      Number(header.payload_bytes) + sourceBytes > 67108864) throw new Error('purpose_context_input_budget');
  const contexts = new Map();
  for (const { input: row } of rows) {
    if (row === null) continue;
    if (!row || Object.keys(row).sort().join('|') !== 'capture|classificationId' || !ids.has(row.classificationId) ||
        contexts.has(row.classificationId)) throw new Error('purpose_context_input_binding');
    contexts.set(row.classificationId, row.capture);
  }
  if (contexts.size !== ids.size) throw new Error('purpose_context_invalid_input');
  return contexts;
}
