/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { canonicalDatabaseBigintId, normalizeDatabaseBigintId } from './databaseIntegerValues.mjs';
import { POLICY_CONVERSION_ACTOR_SOURCE_IDS } from './policyConversionActorSources.mjs';

const REBUILD_CAPTURE_REASON = 'library_rebuild_snapshot_persisted';
const SHA256_HEX = /^[a-f0-9]{64}$/u;

function readObject(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function hasRebuildRollbackAcceptance(payload) {
  return Object.hasOwn(readObject(payload) ?? {}, 'acceptance');
}

function buildRebuildCaptureEvidence(payload) {
  const acceptance = readObject(payload)?.acceptance;
  const transitionFingerprint = acceptance?.transition_fingerprint;
  const proposalFingerprint = acceptance?.proposal_fingerprint;
  const rollbackPlanFingerprint = acceptance?.rollback_plan_fingerprint;
  const actorReference = acceptance?.actor_reference;
  const actorSourceId = acceptance?.actor_source_id;
  if (actorSourceId !== POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR ||
      ![transitionFingerprint, proposalFingerprint, rollbackPlanFingerprint, actorReference]
        .every(value => typeof value === 'string' && SHA256_HEX.test(value))) {
    return null;
  }
  return {
    transitionFingerprint,
    proposalFingerprint,
    rollbackPlanFingerprint,
    actorSourceId,
    actorReference,
    idempotencyKey: `policy:library_rebuild_acceptance:${transitionFingerprint}`,
  };
}

function indexRestoredRollbackSnapshots(archiveSnapshots, restoredIds) {
  const snapshotsById = new Map();
  for (const snapshot of archiveSnapshots ?? []) {
    const id = canonicalDatabaseBigintId(snapshot.id);
    if (id === null) continue;

    // A second archive row with the same ID cannot establish ownership.
    const restoredId = normalizeDatabaseBigintId(restoredIds.get(snapshot.id));
    const uniqueAndRestored = !snapshotsById.has(id) && restoredId !== null;
    snapshotsById.set(id, uniqueAndRestored ? { snapshot, restoredId } : null);
  }
  return snapshotsById;
}

function getRestoredRebuildRetentionBinding(event, snapshotsById) {
  if (event.event_type !== 'rollback_snapshot_created' || event.reason_code !== REBUILD_CAPTURE_REASON) {
    return undefined;
  }
  // Keep malformed JSON in the existing database validation path.
  const metadata = readObject(event.metadata === undefined ? {} : event.metadata);
  if (!metadata) return undefined;

  const originalId = canonicalDatabaseBigintId(metadata.snapshotId);
  const sourceId = canonicalDatabaseBigintId(Object.hasOwn(metadata, 'retentionSnapshotId')
    ? metadata.retentionSnapshotId
    : metadata.snapshotId);
  const candidate = snapshotsById.get(sourceId);
  const snapshot = candidate?.snapshot;
  const evidence = buildRebuildCaptureEvidence(snapshot?.snapshot_payload);
  // These archive values must resolve through the same entries in the restore maps.
  const sameOwners = event.intent_id === snapshot?.intent_id && event.policy_id === snapshot?.policy_id;
  const matches = evidence && snapshot.payload_redacted === false &&
    originalId !== null && event.actor_type === 'operator' && event.actor_id == null &&
    sameOwners && canonicalDatabaseBigintId(event.intent_id) !== null &&
    canonicalDatabaseBigintId(event.policy_id) !== null &&
    event.source_version === snapshot.snapshot_version && event.target_version === snapshot.snapshot_version &&
    Object.entries(evidence).every(([key, value]) => metadata[key] === value);

  return matches ? { destinationId: candidate.restoredId, sourceId, originalId } : { destinationId: null };
}

function restoredRebuildCaptureMetadataSql(metadataParameter, bindingParameter) {
  // PostgreSQL sees the original JSON, including decimal tokens JS cannot preserve.
  const metadata = `${metadataParameter}::jsonb`;
  const binding = `${bindingParameter}::jsonb`;
  return `(${metadata} || jsonb_build_object('retentionSnapshotId',
    CASE WHEN (${metadata} ->> CASE WHEN ${metadata} ? 'retentionSnapshotId'
      THEN 'retentionSnapshotId' ELSE 'snapshotId' END) = ${binding} ->> 'sourceId'
      AND ${metadata} ->> 'snapshotId' = ${binding} ->> 'originalId'
    THEN ${binding} -> 'destinationId'
    ELSE 'null'::jsonb END))`;
}

export {
  buildRebuildCaptureEvidence,
  getRestoredRebuildRetentionBinding,
  hasRebuildRollbackAcceptance,
  indexRestoredRollbackSnapshots,
  REBUILD_CAPTURE_REASON,
  restoredRebuildCaptureMetadataSql,
};
