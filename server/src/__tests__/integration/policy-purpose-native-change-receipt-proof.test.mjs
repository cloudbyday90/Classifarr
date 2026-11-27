/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { applyPolicyInitialIntentEstablishment } from '../../services/policyInitialIntentEstablishmentService.mjs';
import { applyPolicyNativeIntentChange } from '../../services/policyNativeIntentChangeService.mjs';
import {
  buildPolicyNativeIntentChangeReceiptBindingDigest,
  normalizePolicyNativeIntentChangeReceiptRow,
} from '../../services/policyNativeIntentChangeReceiptContract.mjs';
import { hasPolicyNativeIntentChangeReceiptBinding } from '../../services/policyNativeIntentChangeReceiptPersistence.mjs';
import { loadPolicyPurposeEvidenceInventoryRecord } from '../../services/policyPurposeEvidenceInventoryPersistence.mjs';
import { loadPolicyPurposeLifecycleProvenanceReceiptRecords } from '../../services/policyPurposeLifecycleProvenanceReceiptPersistence.mjs';
import { loadHeldOutSemanticStudyLifecycleReauditSourceRecord } from '../../services/heldOutSemanticStudyLifecycleReauditSource.mjs';

const { default: db } = createIntegrationDatabaseModuleMock();
const max = '9223372036854775807';
const safe = Number.MAX_SAFE_INTEGER;
let initialSequence = 10000;

function setId(table, id) {
  return db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, id]);
}

async function makeChange({ target, event, receipt, order, signals = ['genres'] }) {
  const name = `Receipt proof fixture ${order}`;
  const { policyId } = await createPolicyEngineIntegrationFixture(db, { libraryName: name, policyName: name });
  await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [policyId]);
  initialSequence += 10;
  await setId('policy_intents', initialSequence);
  await setId('policy_intent_migration_events', initialSequence);
  const established = await applyPolicyInitialIntentEstablishment({
    dbClient: db, policyId, actorId: 7,
    request: { schema_version: 1, idempotency_key: randomUUID(),
      declared_intent: { purpose: [{ signal_type: 'genres', operator: 'include', values: { include: ['original'] } }] } },
  });
  expect(established.establishment).toMatchObject({ applied: true });
  await setId('policy_intents', target);
  await setId('policy_intent_migration_events', event);
  await setId('policy_native_intent_change_receipts', receipt);
  const input = {
    dbClient: db, policyId, actorId: 7, actorRole: 'admin', expectedRevision: 1,
    idempotencyKey: randomUUID(), now: new Date(Date.now() + order * 60_000),
    changeCommands: [{ command_id: 'update_purpose', values: signals.map(signal => ({
      signal_type: signal, operator: 'require_any', values: { require_any: ['updated'] },
      constraint_mode: 'advisory', semantics: 'identity',
    })) }],
  };
  const result = await applyPolicyNativeIntentChange(input);
  expect(result.change).toMatchObject({ applied: true, newIntentId: target, migrationEventId: event });
  const { rows: [row] } = await db.query(
    'SELECT * FROM policy_native_intent_change_receipts WHERE idempotency_key = $1', [input.idempotencyKey],
  );
  return { input, receipt: normalizePolicyNativeIntentChangeReceiptRow(row) };
}

function replaceProof({ receipt }, proof) {
  return db.query(
    `UPDATE policy_intent_migration_events
     SET metadata = (metadata - 'receiptBindingDigest') || $2::jsonb
     WHERE id = $1`,
    [receipt.migrationEventId, JSON.stringify(proof === undefined ? {} : { receiptBindingDigest: proof })],
  );
}

function readReports() {
  return db.withTransaction(async client => {
    await client.query('SET TRANSACTION READ ONLY');
    return {
      inventory: await loadPolicyPurposeEvidenceInventoryRecord({ db: client }),
      recent: await loadPolicyPurposeLifecycleProvenanceReceiptRecords({ db: client, limit: 2 }),
      heldOut: await loadHeldOutSemanticStudyLifecycleReauditSourceRecord({ db: client }),
    };
  });
}

test('reports only proven high links and fills the recent window with eligible changes', async () => {
  await db.query("INSERT INTO users (id, username, password_hash, role) VALUES (7, 'synthetic-admin', 'synthetic', 'admin')");
  const legacy = await makeChange({ target: safe, event: 900, receipt: '9007199254742251', order: 1 });
  await replaceProof(legacy);
  const targetOnly = await makeChange({ target: '9007199254740992', event: 901, receipt: 910, order: 2 });
  const eventOnly = await makeChange({ target: 902, event: '9007199254740992', receipt: 911, order: 3 });
  const both = await makeChange({ target: max, event: max, receipt: max, order: 4 });

  for (const { input } of [legacy, targetOnly, eventOnly, both]) {
    const replay = await applyPolicyNativeIntentChange(input);
    expect(replay.change).toMatchObject({ applied: true, replayed: true });
  }
  const before = await readReports();
  expect(before.inventory.current_intent_retained_purpose_lifecycle_receipt_policy_count).toBe(4);
  expect(before.heldOut.native_intent_change_count).toBe(4);
  const recentChange = {
    lifecycle_transition: 'native_intent_change',
    intent_available: true,
    specialized_purpose_rule_count: 1,
    inferred_profile_purpose_rule_count: 0,
    declared_native_purpose_rule_count: 1,
  };
  expect(before.recent).toEqual([recentChange, recentChange]);

  const missing = await makeChange({ target: '9007199254740993', event: '9007199254740993', receipt: 912, order: 5 });
  const otherAttempt = await makeChange({ target: '9007199254740994', event: '9007199254740994', receipt: 913, order: 6 });
  const wrongType = await makeChange({
    target: '9007199254740995', event: '9007199254740995', receipt: 914, order: 7, signals: ['genres', 'keywords'],
  });
  await replaceProof(missing);
  await replaceProof(otherAttempt, buildPolicyNativeIntentChangeReceiptBindingDigest({
    ...otherAttempt.receipt, idempotencyKey: randomUUID(),
  }));
  await replaceProof(wrongType, [buildPolicyNativeIntentChangeReceiptBindingDigest(wrongType.receipt)]);

  const after = await readReports();
  expect(after.recent).toEqual(before.recent);
  expect(after.heldOut).toEqual({
    normal_lifecycle_receipt_count: 11,
    initial_intent_establishment_count: 7,
    native_intent_change_count: 4,
    library_rebuild_replacement_count: 0,
  });
  expect(after.inventory).toMatchObject({
    complete_policy_evidence_count: 4,
    current_intent_lifecycle_receipt_policy_count: 4,
    current_intent_retained_purpose_lifecycle_receipt_policy_count: 4,
    lifecycle_receipt_required_policy_count: 3,
  });

  for (const { input, receipt } of [missing, otherAttempt, wrongType]) {
    expect(await hasPolicyNativeIntentChangeReceiptBinding({ client: db, receipt })).toBe(false);
    const replay = await applyPolicyNativeIntentChange(input);
    expect(replay.change.applied).toBe(false);
  }
  const { rows: [counts] } = await db.query(`SELECT COUNT(*)::int AS receipt_count
    FROM policy_native_intent_change_receipts`);
  expect(counts.receipt_count).toBe(7);
});
