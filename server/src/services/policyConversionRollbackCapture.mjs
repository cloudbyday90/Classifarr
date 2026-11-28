/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import {
  canonicalDatabaseBigintId,
  normalizeDatabaseBigintId,
  parseCanonicalDatabaseInt32Id,
} from './databaseIntegerValues.mjs';
import { POLICY_CONVERSION_ACTOR_SOURCE_IDS } from './policyConversionActorSources.mjs';

const CONVERSION_ACTOR_SOURCE_BY_TYPE = Object.freeze({
  post_upgrade: POLICY_CONVERSION_ACTOR_SOURCE_IDS.POST_UPGRADE_APPLY,
  reconciler: POLICY_CONVERSION_ACTOR_SOURCE_IDS.NATIVE_INTENT_RECONCILIATION,
  test_fixture: POLICY_CONVERSION_ACTOR_SOURCE_IDS.TEST_FIXTURE,
  maintainer: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MAINTAINER_MIGRATION_TOOL,
});
const CONVERSION_CAPTURE_ACTOR_SOURCES = Object.freeze(Object.values(CONVERSION_ACTOR_SOURCE_BY_TYPE));

function isConversionRollbackCapture(event, metadata) {
  return event.source_version == null && Object.hasOwn(CONVERSION_ACTOR_SOURCE_BY_TYPE, event.actor_type) &&
    metadata.actorSourceId === CONVERSION_ACTOR_SOURCE_BY_TYPE[event.actor_type] &&
    (event.actor_id == null || parseCanonicalDatabaseInt32Id(event.actor_id) !== null);
}

function isConversionCaptureCandidate(event, metadata) {
  return Object.hasOwn(CONVERSION_ACTOR_SOURCE_BY_TYPE, event.actor_type) ||
    CONVERSION_CAPTURE_ACTOR_SOURCES.includes(metadata.actorSourceId);
}

async function insertConversionRollbackSnapshot({
  client, intentId, policyId, targetVersion, payload, restorePath, expiresAt,
}) {
  const { rows } = await client.query(
    `INSERT INTO policy_intent_rollback_snapshots (
       intent_id, policy_id, snapshot_version, snapshot_payload, payload_redacted, restore_path, expires_at
     )
     VALUES ($1, $2, $3, $4::jsonb, FALSE, $5, $6)
     RETURNING id, policy_id, intent_id, snapshot_version, restore_path, payload_redacted`,
    [intentId, policyId, targetVersion, JSON.stringify(payload), restorePath, expiresAt],
  );
  const row = rows?.[0];
  const id = normalizeDatabaseBigintId(row?.id);
  const expectedIntent = canonicalDatabaseBigintId(intentId);
  const expectedPolicy = parseCanonicalDatabaseInt32Id(policyId);
  const expectedVersion = parseCanonicalDatabaseInt32Id(targetVersion);
  if (rows?.length !== 1 || id === null || expectedIntent === null ||
      expectedPolicy === null || expectedVersion === null ||
      canonicalDatabaseBigintId(row.intent_id) !== expectedIntent ||
      row.policy_id !== expectedPolicy || row.snapshot_version !== expectedVersion ||
      row.restore_path !== restorePath || row.payload_redacted !== false) {
    throw new Error('Conversion rollback snapshot acknowledgement did not match.');
  }
  return { id, intentId: expectedIntent, policyId: expectedPolicy, version: expectedVersion, restorePath };
}

const CONVERSION_CAPTURE_EVENT_RETURNING_SQL = `
  RETURNING id, intent_id, policy_id, event_type, actor_type, actor_id, reason_code, source_version, target_version,
    metadata ->> 'snapshotId' AS snapshot_id_text, jsonb_typeof(metadata -> 'snapshotId') AS snapshot_id_type,
    metadata -> 'restorePath' AS restore_path, metadata -> 'actorSourceId' AS actor_source_id,
    metadata ? 'retentionSnapshotId' AS has_restored_link`;

function verifyConversionCaptureEvent({ rows }, snapshot, auditContext) {
  const row = rows?.[0];
  if (rows?.length !== 1 || canonicalDatabaseBigintId(row?.id) === null ||
      canonicalDatabaseBigintId(row.intent_id) !== snapshot.intentId || row.policy_id !== snapshot.policyId ||
      row.event_type !== 'rollback_snapshot_created' ||
      row.actor_type !== auditContext.actorType || row.actor_id !== auditContext.actorId ||
      row.actor_source_id !== auditContext.actorSourceId || row.reason_code !== auditContext.reasonCode ||
      row.source_version !== null || row.target_version !== snapshot.version ||
      row.snapshot_id_text !== String(snapshot.id) || row.snapshot_id_type !== typeof snapshot.id ||
      row.restore_path !== snapshot.restorePath || row.has_restored_link !== false) {
    throw new Error('Conversion rollback snapshot creation event acknowledgement did not match.');
  }
}

export {
  CONVERSION_ACTOR_SOURCE_BY_TYPE,
  CONVERSION_CAPTURE_ACTOR_SOURCES,
  CONVERSION_CAPTURE_EVENT_RETURNING_SQL,
  insertConversionRollbackSnapshot,
  isConversionCaptureCandidate,
  isConversionRollbackCapture,
  verifyConversionCaptureEvent,
};
