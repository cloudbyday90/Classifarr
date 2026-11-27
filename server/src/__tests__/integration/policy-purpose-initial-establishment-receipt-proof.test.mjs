/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { applyPolicyInitialIntentEstablishment } = await import('../../services/policyInitialIntentEstablishmentService.mjs');
const { loadPolicyPurposeEvidenceInventoryRecord } = await import('../../services/policyPurposeEvidenceInventoryPersistence.mjs');
const { loadPolicyPurposeLifecycleProvenanceReceiptRecords } = await import('../../services/policyPurposeLifecycleProvenanceReceiptPersistence.mjs');
const { loadHeldOutSemanticStudyLifecycleReauditSourceRecord } = await import('../../services/heldOutSemanticStudyLifecycleReauditSource.mjs');

async function establish(name, id, signals) {
  const { policyId, libraryId } = await createPolicyEngineIntegrationFixture(db, { policyName: name, libraryName: name });
  await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [policyId]);
  for (const table of ['policy_intents', 'policy_intent_migration_events']) {
    await db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, id]);
  }
  const input = {
    dbClient: db, policyId, actorId: 7,
    request: { schema_version: 1, idempotency_key: randomUUID(), declared_intent: {
      purpose: signals.map(signal_type => ({
        signal_type, operator: 'include', values: { include: ['synthetic-term'] },
      })),
    } },
  };
  const result = await applyPolicyInitialIntentEstablishment(input);
  expect(result.establishment).toMatchObject({ applied: true, intentId: id });
  return { policyId, libraryId, input };
}

function readReports() {
  return db.withTransaction(async client => {
    await client.query('SET TRANSACTION READ ONLY');
    const inventory = await loadPolicyPurposeEvidenceInventoryRecord({ db: client });
    const recent = await loadPolicyPurposeLifecycleProvenanceReceiptRecords({ db: client, limit: 1 });
    const heldOut = await loadHeldOutSemanticStudyLifecycleReauditSourceRecord({ db: client });
    return { current: inventory.current_intent_lifecycle_receipt_policy_count, recent, heldOut };
  });
}

test('rejects mismatched initial events and refills recent reports with proven history', async () => {
  await db.query("INSERT INTO users (id, username, password_hash, role) VALUES (7, 'synthetic-admin', 'synthetic', 'admin')");
  const safe = 501;
  await establish('Safe establishment', safe, ['genres']);
  const older = await readReports();
  expect(older.current).toBe(1);
  expect(older.heldOut.initial_intent_establishment_count).toBe(1);
  expect(older.recent).toEqual([{
    lifecycle_transition: 'initial_intent_establishment',
    intent_available: true,
    specialized_purpose_rule_count: 1,
    inferred_profile_purpose_rule_count: 0,
    declared_native_purpose_rule_count: 1,
  }]);

  const lower = '9007199254740992';
  const upper = '9007199254740993';
  const { policyId, libraryId, input } = await establish('Large establishment', upper, ['genres', 'keywords']);
  const proven = await readReports();
  expect(proven.current).toBe(2);
  expect(proven.heldOut.initial_intent_establishment_count).toBe(2);
  expect(proven.recent[0].declared_native_purpose_rule_count).toBe(2);

  await db.query(`INSERT INTO policy_intents
    (id, policy_id, library_id, intent_version, active, source, inference_state, validation_status)
    VALUES ($1, $2, $3, 1, FALSE, 'native_intent', 'inferred', 'valid')`, [lower, policyId, libraryId]);
  await db.query(`INSERT INTO policy_intent_migration_events
    (id, intent_id, policy_id, event_type, actor_type, actor_id, source_version, target_version, reason_code, metadata)
    SELECT $1, $1, policy_id, event_type, actor_type, actor_id, source_version, target_version, reason_code, metadata
    FROM policy_intent_migration_events WHERE id = $2`, [lower, upper]);
  const { rows: linked } = await db.query(`UPDATE policy_initial_intent_establishments SET migration_event_id = $1
    WHERE policy_id = $2 RETURNING intent_id, migration_event_id`, [lower, policyId]);
  expect(linked).toEqual([{ intent_id: upper, migration_event_id: lower }]);
  expect(await readReports()).toEqual(older);
  expect((await applyPolicyInitialIntentEstablishment(input)).establishment).toMatchObject({ replayed: true, intentId: upper });
  await db.query('UPDATE policy_initial_intent_establishments SET migration_event_id = $1 WHERE policy_id = $2', [upper, policyId]);

  const { rows: [event] } = await db.query('SELECT metadata FROM policy_intent_migration_events WHERE id = $1', [safe]);
  for (const [kind, actor, sourceVersion, targetVersion, metadata] of [
    ['rollback_snapshot_created', 7, null, 1, event.metadata],
    ['initial_intent_established', 8, null, 1, event.metadata],
    ['initial_intent_established', 7, 1, 1, event.metadata],
    ['initial_intent_established', 7, null, 2, event.metadata],
    ['initial_intent_established', 7, null, 1, { ...event.metadata, authority_source_id: null }],
    ['initial_intent_established', 7, null, 1, { ...event.metadata, request_fingerprint: [event.metadata.request_fingerprint] }],
  ]) {
    await db.query(`UPDATE policy_intent_migration_events
      SET event_type = $2, actor_id = $3, source_version = $4, target_version = $5, metadata = $6::jsonb WHERE id = $1`,
    [safe, kind, actor, sourceVersion, targetVersion, JSON.stringify(metadata)]);
    const rejected = await readReports();
    expect(rejected.current).toBe(1);
    expect(rejected.heldOut.initial_intent_establishment_count).toBe(1);
  }
  await db.query(`UPDATE policy_intent_migration_events
    SET metadata = $2::jsonb WHERE id = $1`, [safe, JSON.stringify(event.metadata)]);

  await db.query(`UPDATE policy_intent_rollback_snapshots SET payload_redacted = TRUE, snapshot_payload = '{}'::jsonb
    WHERE intent_id = $1`, [upper]);
  await db.query('UPDATE policy_intents SET active = FALSE WHERE id = $1', [upper]);
  const historical = await readReports();
  expect(historical.current).toBe(1);
  expect(historical.heldOut).toEqual(proven.heldOut);
  expect(historical.recent).toEqual(proven.recent);
});
