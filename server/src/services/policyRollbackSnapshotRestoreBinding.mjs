/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { canonicalDatabaseBigintId, normalizeDatabaseBigintId } from './databaseIntegerValues.mjs';
import { isConversionCaptureCandidate, isConversionRollbackCapture } from './policyConversionRollbackCapture.mjs';
import {
  buildRebuildCaptureEvidence,
  readRollbackArchiveObject,
  REBUILD_CAPTURE_REASON,
} from './policyRollbackSnapshotRebuildProvenance.mjs';

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

function matchesCaptureEvidence({ rebuild, event, metadata, snapshot }) {
  if (!rebuild) {
    return isConversionRollbackCapture(event, metadata) &&
      typeof snapshot.restore_path === 'string' && snapshot.restore_path.length > 0 &&
      metadata.restorePath === snapshot.restore_path;
  }
  const evidence = buildRebuildCaptureEvidence(snapshot.snapshot_payload);
  return evidence && event.actor_type === 'operator' && event.actor_id == null &&
    event.source_version === snapshot.snapshot_version &&
    Object.entries(evidence).every(([key, value]) => metadata[key] === value);
}

function getRestoredRollbackRetentionBinding(event, snapshotsById) {
  if (event.event_type !== 'rollback_snapshot_created') return undefined;

  // Keep malformed JSON in the existing database validation path.
  const metadata = readRollbackArchiveObject(event.metadata === undefined ? {} : event.metadata);
  if (!metadata) return undefined;

  const conversion = isConversionCaptureCandidate(event, metadata);
  const rebuild = !conversion && event.reason_code === REBUILD_CAPTURE_REASON;
  const hasReference = Object.hasOwn(metadata, 'snapshotId') || Object.hasOwn(metadata, 'retentionSnapshotId');
  if (!rebuild && (!conversion || !hasReference)) return undefined;

  const originalId = canonicalDatabaseBigintId(metadata.snapshotId);
  const sourceId = canonicalDatabaseBigintId(Object.hasOwn(metadata, 'retentionSnapshotId')
    ? metadata.retentionSnapshotId
    : metadata.snapshotId);
  const candidate = snapshotsById.get(sourceId);
  const snapshot = candidate?.snapshot;
  // These archive values must resolve through the same entries in the restore maps.
  const sameOwners = event.intent_id === snapshot?.intent_id && event.policy_id === snapshot?.policy_id;
  const matches = snapshot?.payload_redacted === false && originalId !== null &&
    sameOwners && canonicalDatabaseBigintId(event.intent_id) !== null &&
    canonicalDatabaseBigintId(event.policy_id) !== null &&
    event.target_version === snapshot.snapshot_version &&
    matchesCaptureEvidence({ rebuild, event, metadata, snapshot });

  return matches ? { destinationId: candidate.restoredId, sourceId, originalId } : { destinationId: null };
}

function restoredRollbackCaptureMetadataSql(metadataParameter, bindingParameter) {
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
  getRestoredRollbackRetentionBinding,
  indexRestoredRollbackSnapshots,
  restoredRollbackCaptureMetadataSql,
};
