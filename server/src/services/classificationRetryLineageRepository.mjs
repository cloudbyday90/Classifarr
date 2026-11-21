/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { normalizeRequestIdentity } from './requestIdentityNormalization.mjs';
import {
  canonicalRetryLineageId, projectRetryLineageReferences, requireCompatibleLineageReferences,
  isRetryLineageSource, requireLineageItemMatch, requireRetryLineage, retryLineageHistoryItem, retryLineageItem,
  RETRY_LINEAGE_MAX_REFERENCES,
} from './classificationRetryLineageContract.mjs';

const REFERENCE_LIMIT = RETRY_LINEAGE_MAX_REFERENCES + 1;
const READ_REQUESTS = `SELECT id,media_type,tmdb_id,tvdb_id FROM media_requests
  WHERE classification_id=$1 ORDER BY id LIMIT $2 FOR UPDATE`;
const READ_WEBHOOKS = `SELECT id,media_type,tmdb_id,tvdb_id FROM webhook_log
  WHERE classification_id=$1 ORDER BY id LIMIT $2 FOR UPDATE`;

async function readReferences(client, sourceId) {
  const requests = await client.query(READ_REQUESTS, [sourceId, REFERENCE_LIMIT]);
  const webhooks = await client.query(READ_WEBHOOKS, [sourceId, REFERENCE_LIMIT]);
  return { requests: projectRetryLineageReferences(requests.rows), webhooks: projectRetryLineageReferences(webhooks.rows) };
}

export async function captureRetryLineage(client, sourceId) {
  const references = await readReferences(client, sourceId);
  if (!references.requests.length && !references.webhooks.length) return null;
  return references;
}

export function prepareRetryLineageProof({ row, references, taskSource, payload }) {
  requireRetryLineage(isRetryLineageSource(taskSource));
  requireRetryLineage(row.metadata?.classification_details?.outcome_link?.replacement_classification_id == null);
  const item = retryLineageHistoryItem(row);
  requireCompatibleLineageReferences(item, references.requests);
  requireCompatibleLineageReferences(item, references.webhooks);
  const identity = normalizeRequestIdentity(payload);
  requireRetryLineage(!identity.reason && !identity.externalReason);
  requireLineageItemMatch(item, retryLineageItem(identity.mediaType, identity.tmdbId, identity.tvdbId));
  // The title search is not a verified TVDB-to-TMDB crosswalk.
  requireRetryLineage(item.tmdb !== null || (payload.overview && payload.genres.length > 0));
  return { version: 1, item, ...references };
}

export async function saveRetryLineageProof(client, { sourceId, taskId, proof }) {
  const result = await client.query(`INSERT INTO classification_retry_lineage_proofs
    (task_id,source_classification_id,evidence) VALUES($1,$2,$3::jsonb)`,
  [canonicalRetryLineageId(taskId), canonicalRetryLineageId(sourceId), JSON.stringify(proof)]);
  requireRetryLineage(result.rowCount === 1);
}

export async function readRetryLineageProof(client, taskId) {
  const { rows: [proof] } = await client.query(`SELECT source_classification_id,evidence,replacement_classification_id,completed_claim_token
    FROM classification_retry_lineage_proofs WHERE task_id=$1`, [taskId]);
  return proof ?? null;
}

export function verifyRetryLineageItem(proof, { mediaType, tmdbId, tvdbId }) {
  requireRetryLineage(proof?.evidence?.version === 1);
  requireLineageItemMatch(proof.evidence.item, retryLineageItem(mediaType, tmdbId, tvdbId));
}

function requireExactReferences(expected, actual) {
  const projected = projectRetryLineageReferences(expected);
  requireRetryLineage(JSON.stringify(projected) === JSON.stringify(actual));
}

export async function lockRetryLineageTransfer(client, { proof, taskId, source, metadata }) {
  requireRetryLineage(proof && proof.replacement_classification_id === null);
  verifyRetryLineageItem(proof, { mediaType: metadata.media_type, tmdbId: metadata.tmdb_id, tvdbId: metadata.tvdb_id });
  const sourceId = canonicalRetryLineageId(proof.source_classification_id);
  const { rows: [history] } = await client.query(`SELECT tmdb_id,media_type,metadata,status FROM classification_history
    WHERE id=$1 FOR UPDATE`, [sourceId]);
  const outcome = history?.metadata?.classification_details?.outcome_link;
  requireRetryLineage(history?.status === 'reclassified' && outcome?.type === 'retried' &&
    outcome?.source === source && outcome.replacement_classification_id == null &&
    canonicalRetryLineageId(outcome?.replacement_task_id) === taskId);
  requireLineageItemMatch(proof.evidence.item, retryLineageHistoryItem(history));
  const references = await readReferences(client, sourceId);
  requireExactReferences(proof.evidence.requests, references.requests);
  requireExactReferences(proof.evidence.webhooks, references.webhooks);
  requireRetryLineage(references.requests.length + references.webhooks.length > 0);
  return { sourceId, references };
}

export async function completeRetryLineageTransfer(client, { transfer, taskId, classificationId, claimToken }) {
  const replacementId = canonicalRetryLineageId(classificationId);
  const { sourceId, references } = transfer;
  const moveRequests = await client.query(`UPDATE media_requests SET classification_id=$1
    WHERE classification_id=$2 AND id=ANY($3::integer[])`, [replacementId, sourceId, references.requests.map(row => row.id)]);
  const moveWebhooks = await client.query(`UPDATE webhook_log SET classification_id=$1
    WHERE classification_id=$2 AND id=ANY($3::integer[])`, [replacementId, sourceId, references.webhooks.map(row => row.id)]);
  requireRetryLineage(moveRequests.rowCount === references.requests.length && moveWebhooks.rowCount === references.webhooks.length);
  const outcome = await classificationOutcomeService.recordOutcome(sourceId, {
    replacement_classification_id: classificationId,
  }, { client, requireWrite: true });
  requireRetryLineage(outcome.updated === true);
  const saved = await client.query(`UPDATE classification_retry_lineage_proofs
    SET replacement_classification_id=$2, completed_claim_token=$3::uuid
    WHERE task_id=$1 AND replacement_classification_id IS NULL`, [taskId, replacementId, claimToken]);
  requireRetryLineage(saved.rowCount === 1);
}
