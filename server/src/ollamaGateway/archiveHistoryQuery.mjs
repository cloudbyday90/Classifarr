/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Keep whole job values out of the complete metadata scan/join/sort. Only the
// eligible branch may fetch them. One statement preserves one MVCC snapshot.
export const ARCHIVE_HISTORY_QUERY = `WITH metadata AS MATERIALIZED (
    SELECT j.id,j.ledger_id,j.provider_hash,j.policy_hash,j.revision,j.attempt,j.status,
      j.created_at,j.completed_at,j.retry_after,j.manifest_sha256,j.reason,j.recovery_protection_id
    FROM gateway_archive.job j ORDER BY j.created_at,j.id LIMIT 10001
  ), fingerprints AS MATERIALIZED (
    SELECT j.id,encode(sha256(convert_to(to_jsonb(j)::text,'UTF8')),'hex') AS evidence_sha256
    FROM gateway_archive.job j JOIN metadata m ON m.id=j.id
    WHERE j.status IN ('verified','awaiting_verification','retiring')
  ), selected AS MATERIALIZED (
    SELECT m.*,to_jsonb(p) AS protection,f.evidence_sha256
    FROM metadata m LEFT JOIN gateway_archive.protection p ON p.id=m.recovery_protection_id
      LEFT JOIN fingerprints f ON f.id=m.id
  ), budget AS MATERIALIZED (
    SELECT count(*)::int AS history_count,coalesce(sum(octet_length(row_to_json(s)::text)),0)::float8 AS history_bytes FROM selected s
  ) SELECT s.*,b.history_count,b.history_bytes FROM budget b LEFT JOIN selected s
    ON b.history_count<=10000 AND b.history_bytes<=$1 ORDER BY s.created_at,s.id`;
