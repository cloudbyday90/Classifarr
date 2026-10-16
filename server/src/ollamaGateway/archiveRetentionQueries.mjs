/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RETENTION_REVIEW_LIMIT, validateRetentionInventory } from './archiveRetentionContract.mjs';

// Fixed SQL shared by reporting, archive selection and review. $1=active request, $2=cutoff.
export const archiveCategorySql = `CASE WHEN b.request_id=$1::uuid THEN 'active'
  WHEN EXISTS(SELECT 1 FROM ollama_gateway.recovery_receipt r WHERE r.request_id=b.request_id)
    OR EXISTS(SELECT 1 FROM ollama_gateway.provider_stop_intent s WHERE s.binding_id=b.id) THEN 'lifecycle'
  WHEN c.outcome IS NULL OR c.outcome NOT IN ('response_completed','provider_rejected','not_dispatched') THEN 'unknown'
  WHEN b.admitted_at >= $2::timestamptz OR c.recorded_at >= $2::timestamptz THEN 'recent'
  ELSE 'older_terminal_review' END`;

const entrySelect = `SELECT b.id AS "bindingId",b.request_id AS "requestId",b.attempt::text AS attempt,
  encode(sha256(convert_to(jsonb_build_object('binding',to_jsonb(b),'completion',to_jsonb(c),'peer',to_jsonb(p))::text,'UTF8')),'hex') AS "rowSha256",
  (${archiveCategorySql}) AS category
  FROM ollama_gateway.request_binding b
  LEFT JOIN ollama_gateway.completion_receipt c ON c.request_id=b.request_id
  LEFT JOIN ollama_gateway.upstream_peer_observation p ON p.binding_id=b.id`;

// Only call inside the archive's read-only snapshot, never a pooled standalone query.
export async function readRetentionState(client) {
  return (await client.query(`SELECT active_request,
    encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex') AS digest
    FROM ollama_gateway.admission a WHERE singleton`)).rows[0];
}

export async function captureRetentionInventory(client, report) {
  const state = await readRetentionState(client);
  // Use the ledger/attempt index and bound identities before joining peer records or hashing full rows.
  // Both reads stay in the caller's one read-only snapshot; LIMIT on a wide join alone is not a work bound.
  const selected = await client.query(`SELECT b.id FROM ollama_gateway.request_binding b
    LEFT JOIN ollama_gateway.completion_receipt c ON c.request_id=b.request_id
    WHERE b.ledger_id=$3::uuid AND (${archiveCategorySql})='older_terminal_review'
    ORDER BY b.attempt LIMIT $4`, [state.active_request, report.cutoff, report.ledgerId, RETENTION_REVIEW_LIMIT]);
  const rows = selected.rows.length ? await readRetentionEntries(client, state.active_request, report.cutoff, selected.rows.map(row => row.id)) : [];
  return validateRetentionInventory({ version: 1, ledgerSha256: state.digest,
    entries: rows.map(({ category: _category, ...entry }) => entry),
    totalCandidates: report.categories.older_terminal_review,
    hasMore: report.categories.older_terminal_review > RETENTION_REVIEW_LIMIT }, report.categories.older_terminal_review);
}

export async function readRetentionEntries(client, activeRequest, cutoff, bindingIds) {
  return (await client.query(`${entrySelect} WHERE b.id=ANY($3::uuid[]) ORDER BY b.attempt`,
    [activeRequest, cutoff, bindingIds])).rows;
}
