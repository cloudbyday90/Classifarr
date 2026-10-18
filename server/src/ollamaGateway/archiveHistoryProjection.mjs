/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Fixed SQL only. Failed/retired bodies remain in history but are not scheduling evidence.
export const ARCHIVE_HISTORY_FIELDS = `j.id,j.ledger_id,j.provider_hash,j.policy_hash,j.revision,j.attempt,j.status,
  j.created_at,j.completed_at,j.retry_after,j.manifest_sha256,j.reason,j.recovery_protection_id,
  to_jsonb(p) AS protection,
  CASE WHEN j.status IN ('verified','awaiting_verification','retiring') THEN
    encode(sha256(convert_to(jsonb_build_array(j.manifest,j.receipt)::text,'UTF8')),'hex') END AS evidence_sha256`;
