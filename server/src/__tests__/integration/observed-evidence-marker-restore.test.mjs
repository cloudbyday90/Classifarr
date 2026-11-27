/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { collectBackupSnapshot } = await import('../../services/backupSnapshot.mjs');
const { restoreAllTables } = await import('../../services/backupRestore.mjs');
const { applyPolicyInitialIntentEstablishment } = await import('../../services/policyInitialIntentEstablishmentService.mjs');
const { PolicyObservedEvidenceProvenanceRetentionService } = await import('../../services/policyObservedEvidenceProvenanceRetentionService.mjs');
const { buildPayloadDigest } = await import('../../services/policyObservedEvidenceProvenanceRetentionContract.mjs');
const { fetchActiveNativeIntentForPolicy, fetchActiveNativeIntentsForPolicies } = await import('../../services/policyNativePolicyReadService.mjs');
const { loadPolicyScopedEvidenceDigestContext } = await import('../../services/policyScopedEvidenceDigestPersistence.mjs');

const dayMs = 24 * 60 * 60 * 1000;
const redactedName = 'Observed archive redacted';
const pendingName = 'Observed archive pending';

async function setNextIds(tables, id) {
  for (const table of tables) {
    await db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, id]);
  }
}

async function establish(name, id, now) {
  const { policyId, libraryId } = await createPolicyEngineIntegrationFixture(db, { policyName: name, libraryName: name });
  await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [policyId]);
  await db.query(`INSERT INTO library_profiles
    (library_id, item_count, enriched_count, genre_distribution, last_generated_at, updated_at)
    VALUES ($1, 48, 48, '{"Animation":91.67,"Family":64.58}', $2, $2)`, [libraryId, now]);
  await setNextIds(['policy_intents', 'policy_initial_intent_establishments'], id);
  const result = await applyPolicyInitialIntentEstablishment({
    dbClient: db, policyId, actorId: 7, now,
    request: { schema_version: 1, idempotency_key: randomUUID(),
      declared_intent: { purpose: [{ signal_type: 'genres', operator: 'include', values: { include: ['Animation'] } }] } },
  });
  expect(result.establishment).toMatchObject({ applied: true, id, intentId: id });
}

async function snapshotsByPolicy() {
  const { rows } = await db.query(`SELECT snapshot.*, policy.name
    FROM policy_observed_evidence_provenance_snapshots snapshot
    JOIN library_policies policy ON policy.id = snapshot.policy_id`);
  return new Map(rows.map(row => [row.name, row]));
}

function owners({ policy_id, library_id, intent_id, establishment_id }) {
  return { policy_id, library_id, intent_id, establishment_id };
}

async function exportConfiguration() {
  const snapshot = await collectBackupSnapshot({ includePatterns: false });
  return JSON.parse(JSON.stringify(snapshot));
}

async function expectRedactedReference(policyId, since) {
  const single = await fetchActiveNativeIntentForPolicy(db, policyId);
  const bulk = (await fetchActiveNativeIntentsForPolicies(db, [policyId])).get(policyId);
  const digest = await loadPolicyScopedEvidenceDigestContext({ db, policyId, since });
  for (const reference of [single.observedEvidenceReference, bulk.observedEvidenceReference, digest.observedProfile]) {
    expect(reference).toMatchObject({ capture_state: 'captured', payload_redacted: true });
    expect(reference).not.toHaveProperty('snapshot_payload');
    expect(reference).not.toHaveProperty('retention_marker');
  }
}

test('retains the redaction record while configuration restore remaps its snapshot owners', async () => {
  await db.query(`INSERT INTO users (id, username, password_hash, role)
    VALUES (7, 'observed-archive-admin', 'synthetic-test-data', 'admin')`);
  const now = new Date();
  const firstExpiry = new Date(now.getTime() + 14 * dayMs);
  const secondExpiry = new Date(firstExpiry.getTime() + dayMs);
  const retention = new PolicyObservedEvidenceProvenanceRetentionService({
    db, lockKey: 2010, logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn() },
  });
  await establish(redactedName, '9007199254740993', now);
  await establish(pendingName, '9007199254740992', new Date(now.getTime() + dayMs));
  const captured = await snapshotsByPolicy();
  expect(await retention.cleanup({ now: firstExpiry })).toMatchObject({
    statusId: 'completed', redactedSnapshotIds: [captured.get(redactedName).id],
  });

  const source = await snapshotsByPolicy();
  const original = source.get(redactedName);
  const pending = source.get(pendingName);
  const originalMarker = original.snapshot_payload.retention_marker;
  expect(owners(originalMarker)).toEqual(owners(original));
  expect(originalMarker.payload_digest).toBe(buildPayloadDigest(captured.get(redactedName).snapshot_payload));

  let archive = await exportConfiguration();
  for (const firstId of [1001, 2001]) {
    await setNextIds(['library_policies', 'libraries', 'policy_intents', 'policy_initial_intent_establishments'], firstId);
    await db.withTransaction(client => restoreAllTables(client, archive, 'replace'));
    const restored = await snapshotsByPolicy();
    const redacted = restored.get(redactedName);
    const unredacted = restored.get(pendingName);
    expect(owners(redacted)).toEqual({
      policy_id: firstId, library_id: firstId, intent_id: firstId + 1, establishment_id: firstId + 1,
    });
    expect(redacted.snapshot_payload).toEqual(original.snapshot_payload);
    expect(redacted).toMatchObject({
      evidence_fingerprint: original.evidence_fingerprint,
      redacted_at: original.redacted_at, expires_at: original.expires_at, payload_redacted: true,
    });
    expect(unredacted.snapshot_payload).toEqual(pending.snapshot_payload);
    expect(unredacted.payload_redacted).toBe(false);
    await expectRedactedReference(redacted.policy_id, now);
    expect(await retention.cleanup({ now: firstExpiry })).toMatchObject({
      statusId: 'completed', redactedSnapshotCount: 0,
    });
    archive = await exportConfiguration();
  }

  const beforeMerge = await snapshotsByPolicy();
  await db.withTransaction(client => restoreAllTables(client, archive, 'merge'));
  expect(await snapshotsByPolicy()).toEqual(beforeMerge);
  expect(await retention.cleanup({ now: secondExpiry })).toMatchObject({
    statusId: 'completed', redactedSnapshotIds: [beforeMerge.get(pendingName).id],
  });
  const afterward = await snapshotsByPolicy();
  const newlyRedacted = afterward.get(pendingName);
  expect(newlyRedacted.snapshot_payload.retention_marker).toMatchObject({
    ...owners(newlyRedacted),
    payload_digest: buildPayloadDigest(pending.snapshot_payload),
  });
  expect(afterward.get(redactedName)).toEqual(beforeMerge.get(redactedName));
  await expectRedactedReference(newlyRedacted.policy_id, now);
});
