/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { buildLibraryRebuildRemovalInventoryFixture: buildRemovalInventory, createLibraryRebuildIdentityFixture } =
  await import('../setup/createLibraryRebuildIdentityFixture.mjs');
const { persistPolicyLibraryRebuildRollbackSnapshot } =
  await import('../../services/policyLibraryRebuildSnapshotGate.mjs');
const { applyPolicyLibraryRebuildReplacement, validatePolicyLibraryRebuildReplacementGate } =
  await import('../../services/policyLibraryRebuildReplacementGate.mjs');
const { createPolicyLibraryRebuildCutoverOrchestrator } = await import('../../services/policyLibraryRebuildCutoverOrchestrator.mjs');
const { validatePolicyLibraryRebuildCutoverResult } = await import('../../services/policyLibraryRebuildCutoverContract.mjs');
const { createPolicyLibraryRebuildLegacyDeletionReadinessService } =
  await import('../../services/policyLibraryRebuildLegacyDeletionReadinessService.mjs');
const { validatePolicyLibraryRebuildLegacyDeletionReadiness } =
  await import('../../services/policyLibraryRebuildLegacyDeletionReadiness.mjs');
const { createPolicyLibraryRebuildLegacyFinalRemovalAuditService } =
  await import('../../services/policyLibraryRebuildLegacyFinalRemovalAuditService.mjs');
const { validatePolicyLibraryRebuildLegacyFinalRemovalPlan } =
  await import('../../services/policyLibraryRebuildLegacyFinalRemovalPlan.mjs');
const { applyPolicyNativeIntentReversion } = await import('../../services/policyNativeIntentReversionService.mjs');
const { getActivePolicies } = await import('../../services/policyEngineQueries.mjs');

const { fixture, closeRollbackWindow } = createLibraryRebuildIdentityFixture(db);
const readiness = createPolicyLibraryRebuildLegacyDeletionReadinessService({ dbClient: db, buildRemovalInventory });
const finalAudit = createPolicyLibraryRebuildLegacyFinalRemovalAuditService({ dbClient: db, buildRemovalInventory });
const lower = '9007199254740992';
const upper = '9007199254740993';
const maximum = '9223372036854775807';

function setNextIntentId(id) {
  return db.query("SELECT setval(pg_get_serial_sequence('policy_intents', 'id'), $1::bigint, false)", [id]);
}

async function prepareReplacement(tag, ordinal, replacementId) {
  await setNextIntentId(300 + ordinal);
  const item = await fixture(tag, 960 + ordinal, 860 + ordinal);
  expect(await persistPolicyLibraryRebuildRollbackSnapshot(item.args)).toMatchObject({
    statusId: 'rollback_snapshot_persisted',
  });
  await setNextIntentId(replacementId);
  return item;
}

function insertInactiveNeighbor(item, id) {
  return db.query(`INSERT INTO policy_intents
    (id, policy_id, library_id, intent_version, active, source, inference_state, validation_status)
    VALUES ($1, $2, $3, 2, false, 'native_intent', 'inferred', 'valid')`,
  [id, item.policyId, item.args.transition.policyContext.libraryId]);
}

async function countDependentRows(intentId) {
  const { rows: [counts] } = await db.query(`SELECT
    (SELECT count(*)::int FROM policy_intent_rules WHERE intent_id = $1 AND intent_role = 'purpose') AS purpose_rules,
    (SELECT count(*)::int FROM policy_intent_routing_targets WHERE intent_id = $1) AS routing_targets,
    (SELECT count(*)::int FROM policy_intent_validation_status WHERE intent_id = $1) AS validation_rows,
    (SELECT count(*)::int FROM policy_intent_migration_events WHERE intent_id = $1) AS events`, [intentId]);
  return counts;
}

test.each([
  ['safe', 1, 211],
  ['adjacent', 2, upper],
  ['maximum', 3, maximum],
])('keeps the %s successor exact from header creation through runtime and removal', async (tag, ordinal, intentId) => {
  const item = await prepareReplacement(tag, ordinal, intentId);
  if (intentId === upper) await insertInactiveNeighbor(item, lower);
  const cutover = await createPolicyLibraryRebuildCutoverOrchestrator({ dbClient: db }).run(item.args);
  const replay = await applyPolicyLibraryRebuildReplacement(item.args);
  expect(cutover).toMatchObject({
    statusId: 'cutover_applied', ok: true, execution: { replacementIntentId: intentId },
  });
  expect(replay).toMatchObject({
    statusId: 'already_applied', validation: { ok: true }, execution: { replacementIntentId: intentId, idempotent: true },
    sideEffects: { nativeIntentCreated: false, nativeRulesWritten: false, migrationEventWritten: false },
  });

  const { rows: [relational] } = await db.query(`SELECT
    original.replaced_by_intent_id, original.active AS original_active, successor.active AS successor_active,
    gate.replacement_intent_id, event.intent_id AS event_target,
    event.metadata ->> 'replacementIntentId' AS event_reference,
    jsonb_typeof(event.metadata -> 'replacementIntentId') AS event_reference_type
    FROM policy_library_rebuild_execution_gates gate
    JOIN policy_intents original ON original.id = gate.intent_id
    JOIN policy_intents successor ON successor.id = gate.replacement_intent_id
    JOIN policy_intent_migration_events event ON event.id = gate.replacement_event_id
    WHERE gate.id = $1`, [item.gateId]);
  expect(relational).toEqual({
    replaced_by_intent_id: intentId, original_active: false, successor_active: true,
    replacement_intent_id: intentId, event_target: intentId,
    event_reference: String(intentId), event_reference_type: typeof intentId,
  });
  expect(await countDependentRows(intentId)).toEqual({
    purpose_rules: 1, routing_targets: 1, validation_rows: 1, events: 1,
  });
  if (intentId === upper) {
    expect(await countDependentRows(lower)).toEqual({
      purpose_rules: 0, routing_targets: 0, validation_rows: 0, events: 0,
    });
  }

  const policies = await getActivePolicies({ dbClient: db, throwOnError: true });
  expect(policies.find(policy => policy.id === item.policyId)).toMatchObject({
    native_intent_version: 2,
    policy_runtime_authority: { sourceId: 'native_intent', validationOk: true },
    policy_intent_contract: {
      purpose: [expect.objectContaining({ signal_type: 'studios', values: { require_any: ['Disney'] } })],
    },
    policy_intent_authority_context: { routing_target: { arr_type: 'radarr', target_status: 'configured' } },
    presets: [],
  });

  if (typeof intentId === 'number') {
    await db.query(`UPDATE policy_intent_migration_events
      SET metadata = metadata - 'replacementIntentId' WHERE id = $1`, [replay.execution.replacementEventId]);
    expect(await applyPolicyLibraryRebuildReplacement(item.args)).toMatchObject({
      statusId: 'already_applied', execution: { replacementIntentId: intentId },
    });
  }
  const expired = await closeRollbackWindow(item);
  const ready = await readiness.evaluate(expired);
  const plan = await finalAudit.audit(expired);
  const expected = {
    cutover: { replacementIntentId: intentId }, runtimeAuthority: { activeNativeIntentId: intentId },
  };
  expect(ready).toMatchObject({ ...expected, readyForFinalRemovalAudit: true, validation: { ok: true } });
  expect(plan).toMatchObject({ ...expected, readyForGlobalReleaseRetirementGate: true, validation: { ok: true } });
  if (typeof intentId === 'string') {
    for (const [result, section, validate] of [
      [cutover, 'execution', validatePolicyLibraryRebuildCutoverResult],
      [replay, 'execution', validatePolicyLibraryRebuildReplacementGate],
      [ready, 'cutover', validatePolicyLibraryRebuildLegacyDeletionReadiness],
      [plan, 'cutover', validatePolicyLibraryRebuildLegacyFinalRemovalPlan],
    ]) {
      expect(validate({
        ...result, [section]: { ...result[section], replacementIntentId: Number(intentId) },
      }).ok).toBe(false);
    }
  }
});

test.each([
  ['predecessor', 'RETURNING id, replaced_by_intent_id', 0, '9007199254741100', '9007199254741101'],
  ['gate', 'RETURNING id, replacement_event_id, replacement_intent_id', 2, '9007199254741200', '9007199254741201'],
])('rolls back when the %s write saves a neighboring intent', async (stage, acknowledgement, parameterIndex, intentId, neighbor) => {
  const item = await prepareReplacement(`mismatched-${stage}`, stage === 'predecessor' ? 4 : 5, intentId);
  await insertInactiveNeighbor(item, neighbor);
  let changed = false;
  const dbClient = { withTransaction: work => db.withTransaction(client => work({
    query: (sql, params) => {
      if (!sql.includes(acknowledgement)) return client.query(sql, params);
      const values = [...params];
      values[parameterIndex] = neighbor;
      changed = true;
      return client.query(sql, values);
    },
  })) };
  expect(await applyPolicyLibraryRebuildReplacement({ ...item.args, dbClient })).toMatchObject({
    statusId: 'failed_rolled_back', validation: { ok: false },
  });
  expect(changed).toBe(true);
  const { rows: [state] } = await db.query(`SELECT
    original.active, original.replaced_by_intent_id, gate.state, gate.replacement_intent_id, gate.replacement_event_id,
    EXISTS (SELECT 1 FROM policy_intents WHERE id = $2) AS new_intent_exists
    FROM policy_library_rebuild_execution_gates gate JOIN policy_intents original ON original.id = gate.intent_id
    WHERE gate.id = $1`, [item.gateId, intentId]);
  expect(state).toEqual({
    active: true, replaced_by_intent_id: null, state: 'snapshot_persisted',
    replacement_intent_id: null, replacement_event_id: null, new_intent_exists: false,
  });
  expect(await countDependentRows(neighbor)).toEqual({
    purpose_rules: 0, routing_targets: 0, validation_rows: 0, events: 0,
  });
});

test('requires typed event proof for a large completed replacement', async () => {
  const intentId = '9007199254741300';
  const neighbor = '9007199254741301';
  const item = await prepareReplacement('unproven-completed-intent', 6, intentId);
  await insertInactiveNeighbor(item, neighbor);
  const applied = await applyPolicyLibraryRebuildReplacement(item.args);
  expect(applied).toMatchObject({ statusId: 'replacement_applied' });
  const eventId = applied.execution.replacementEventId;
  const expired = await closeRollbackWindow(item);
  for (const reference of [{}, { replacementIntentId: Number(intentId) }, { replacementIntentId: neighbor }]) {
    await db.query(`UPDATE policy_intent_migration_events
      SET metadata = (metadata - 'replacementIntentId') || $2::jsonb WHERE id = $1`,
    [eventId, JSON.stringify(reference)]);
    expect(await applyPolicyLibraryRebuildReplacement(item.args)).toMatchObject({
      statusId: 'blocked_by_current_state', validation: { ok: false },
    });
    expect(await readiness.evaluate(expired)).toMatchObject({
      readyForFinalRemovalAudit: false, risks: expect.arrayContaining([{ riskId: 'replacement_event_mismatch' }]),
    });
    expect((await finalAudit.audit(expired)).readyForGlobalReleaseRetirementGate).toBe(false);
  }
  await db.query(`UPDATE policy_intent_migration_events
    SET metadata = jsonb_set(metadata, '{replacementIntentId}', to_jsonb($2::text)) WHERE id = $1`, [eventId, intentId]);
  await db.query('UPDATE policy_library_rebuild_execution_gates SET replacement_intent_id = $2 WHERE id = $1',
    [item.gateId, neighbor]);
  expect((await applyPolicyLibraryRebuildReplacement(item.args)).statusId).toBe('blocked_by_current_state');
  expect((await readiness.evaluate(expired)).readyForFinalRemovalAudit).toBe(false);
});

test('replays the exact completed result after reversion restores the original authority', async () => {
  const intentId = '9007199254741401';
  const item = await prepareReplacement('reverted-exact-intent', 7, intentId);
  expect(await applyPolicyLibraryRebuildReplacement(item.args)).toMatchObject({
    statusId: 'replacement_applied', execution: { replacementIntentId: intentId },
  });
  expect(await applyPolicyNativeIntentReversion({
    dbClient: db, policyId: item.policyId, snapshotId: item.snapshotId, now: item.args.now,
    action: { actorId: 7, actorSourceId: 'manual_operator', reasonCode: 'operator_reviewed' },
  })).toMatchObject({ statusId: 'applied_to_previous_native_intent' });
  expect(await applyPolicyLibraryRebuildReplacement(item.args)).toMatchObject({
    statusId: 'already_applied', execution: { replacementIntentId: intentId },
    sideEffects: { nativeIntentCreated: false, policyReplaced: false },
  });
  expect((await db.query(`SELECT id, active, replaced_by_intent_id FROM policy_intents
    WHERE policy_id = $1 ORDER BY id`, [item.policyId])).rows).toEqual([
    { id: item.intentId, active: true, replaced_by_intent_id: null },
    { id: intentId, active: false, replaced_by_intent_id: null },
  ]);
  const ready = await readiness.evaluate({ policyId: item.policyId, now: item.args.now });
  expect(ready.readyForFinalRemovalAudit).toBe(false);
});
