/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Immutable pre-optimization query from acea8e51e. Fixture only; never a runtime fallback.
export const HISTORY_REFERENCE_SQL = `WITH selected AS MATERIALIZED (
    SELECT j.id,j.ledger_id,j.provider_hash,j.policy_hash,j.revision,j.attempt,j.status,
  j.created_at,j.completed_at,j.retry_after,j.manifest_sha256,j.reason,j.recovery_protection_id,
  to_jsonb(p) AS protection,
  CASE WHEN j.status IN ('verified','awaiting_verification','retiring') THEN
    encode(sha256(convert_to(to_jsonb(j)::text,'UTF8')),'hex') END AS evidence_sha256
    FROM gateway_archive.job j LEFT JOIN gateway_archive.protection p ON p.id=j.recovery_protection_id
    ORDER BY j.created_at,j.id LIMIT 10001
  ), budget AS MATERIALIZED (
    SELECT count(*)::int AS history_count,coalesce(sum(octet_length(row_to_json(s)::text)),0)::float8 AS history_bytes FROM selected s
  ) SELECT s.*,b.history_count,b.history_bytes FROM budget b LEFT JOIN selected s
    ON b.history_count<=10000 AND b.history_bytes<=$1 ORDER BY s.created_at,s.id`;
export const HISTORY_REFERENCE_VALUES = Object.freeze([8388608]);
