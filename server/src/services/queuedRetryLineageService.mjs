/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeRequestIdentity } from './requestIdentityNormalization.mjs';
import {
  hasRetryLineage, requireRetryLineage, canonicalRetryLineageId, RetryLineageAlreadyCompleted,
} from './classificationRetryLineageContract.mjs';
import {
  completeRetryLineageTransfer, lockRetryLineageTransfer, readRetryLineageProof, verifyRetryLineageItem,
} from './classificationRetryLineageRepository.mjs';

export async function readQueuedRetryLineage(client, claim, id) {
  const proof = await readRetryLineageProof(client, id);
  requireRetryLineage(proof || claim.has_retry_lineage !== true || claim.routing_classification_id != null);
  if (proof && claim.routing_classification_id != null) {
    requireRetryLineage(canonicalRetryLineageId(claim.routing_classification_id) ===
      canonicalRetryLineageId(proof.replacement_classification_id));
  }
  return proof;
}

export async function recoverLocalRetryCompletion(client, replacementId) {
  const { rows: [history] } = await client.query(`SELECT status,library_id,library_name,confidence,method
    FROM classification_history WHERE id=$1`, [replacementId]);
  const available = history && history.status !== 'reclassified';
  const reason = available ? 'saved_retry_automatic_route_withheld' : 'saved_retry_replacement_unavailable';
  return {
    success: true,
    recovered: true,
    classification_id: replacementId,
    library: available ? history.library_name : null,
    destination: { libraryId: available ? history.library_id : null, libraryName: available ? history.library_name : null },
    confidence: available ? history.confidence : null,
    method: available ? history.method : null,
    reason: available ? 'Saved retry result recovered. Automatic routing for this retry was not started.'
      : 'The saved retry result was removed or superseded. The retry was not repeated.',
    routingOutcome: { shouldRoute: false, reason, routeResult: { attempted: false, routed: false, reason } },
  };
}

export function buildQueuedRetryLineagePersistence(guard, task, proof, payload) {
  const identity = normalizeRequestIdentity(payload);
  requireRetryLineage(!identity.reason && !identity.externalReason);
  verifyRetryLineageItem(proof, identity);
  const sourceId = canonicalRetryLineageId(proof.source_classification_id);
  return (lifecycle, input, metadata) => guard.withClaim(task, async (client, claim, taskId) => {
    const current = await readQueuedRetryLineage(client, claim, taskId);
    requireRetryLineage(current && canonicalRetryLineageId(current.source_classification_id) === sourceId);
    if (current.replacement_classification_id !== null) throw new RetryLineageAlreadyCompleted();
    let transfer;
    const saved = await lifecycle.persist({
      ...input,
      client,
      beforeWrite: async () => {
        transfer = await lockRetryLineageTransfer(client, { proof: current, taskId, source: claim.source, metadata });
      },
    });
    await completeRetryLineageTransfer(client, {
      transfer, taskId, classificationId: saved.classificationId, claimToken: claim.claim_token,
    });
    return saved;
  });
}

export async function isManualRetryLineageBlocked(client, task, payload) {
  return hasRetryLineage(payload) || await readRetryLineageProof(client, task.id) !== null;
}
