/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { persistPolicyLibraryRebuildRollbackSnapshot, validatePolicyLibraryRebuildSnapshotGate } =
  await import('../../services/policyLibraryRebuildSnapshotGate.mjs');
const { applyPolicyLibraryRebuildReplacement, validatePolicyLibraryRebuildReplacementGate } =
  await import('../../services/policyLibraryRebuildReplacementGate.mjs');
const { createPolicyLibraryRebuildCutoverOrchestrator } = await import('../../services/policyLibraryRebuildCutoverOrchestrator.mjs');
const { validatePolicyLibraryRebuildCutoverResult } = await import('../../services/policyLibraryRebuildCutoverContract.mjs');
const { createPolicyLibraryRebuildLegacyDeletionReadinessService } =
  await import('../../services/policyLibraryRebuildLegacyDeletionReadinessService.mjs');
const { createPolicyLibraryRebuildLegacyFinalRemovalAuditService } =
  await import('../../services/policyLibraryRebuildLegacyFinalRemovalAuditService.mjs');
const { validatePolicyLibraryRebuildLegacyDeletionReadiness } = await import('../../services/policyLibraryRebuildLegacyDeletionReadiness.mjs');
const { validatePolicyLibraryRebuildLegacyFinalRemovalPlan } = await import('../../services/policyLibraryRebuildLegacyFinalRemovalPlan.mjs');
const { loadPolicyLibraryRebuildLegacyDeletionEvidence } = await import('../../services/policyLibraryRebuildLegacyDeletionReadinessRepository.mjs');

const { buildLibraryRebuildRemovalInventoryFixture: buildRemovalInventory, createLibraryRebuildIdentityFixture } =
  await import('../setup/createLibraryRebuildIdentityFixture.mjs');
const { fixture, setNextMigrationEventId, closeRollbackWindow } = createLibraryRebuildIdentityFixture(db);

async function cutoverEvidence({ policyId, args, snapshotId, gateId }, replacementEventId = null) {
  const captured = await persistPolicyLibraryRebuildRollbackSnapshot(args);
  const captureReplay = await persistPolicyLibraryRebuildRollbackSnapshot(args);
  if (replacementEventId !== null) await setNextMigrationEventId(replacementEventId);
  const cutover = await createPolicyLibraryRebuildCutoverOrchestrator({ dbClient: db }).run(args);
  const replacementReplay = await applyPolicyLibraryRebuildReplacement(args);
  expect(captured).toMatchObject({ statusId: 'rollback_snapshot_persisted', validation: { ok: true } });
  expect(captureReplay).toMatchObject({ statusId: 'already_persisted', validation: { ok: true } });
  expect(cutover).toMatchObject({ statusId: 'cutover_applied', ok: true, checkpoints: { rollbackSnapshot: 'reused' } });
  expect(replacementReplay).toMatchObject({ statusId: 'already_applied', validation: { ok: true } });
  if (replacementEventId !== null) {
    expect(cutover.execution.replacementEventId).toBe(replacementEventId);
    expect(replacementReplay.execution.replacementEventId).toBe(replacementEventId);
  }
  for (const receipt of [captured, captureReplay, cutover, replacementReplay]) {
    expect(receipt.execution).toMatchObject({ rollbackSnapshotId: snapshotId, gateId });
  }
  const { rows } = await db.query(`SELECT gate.id AS gate_id, gate.rollback_snapshot_id,
    capture.metadata ->> 'snapshotId' AS capture_id,
    jsonb_typeof(capture.metadata -> 'snapshotId') AS capture_type,
    replacement.metadata ->> 'rollbackSnapshotId' AS replacement_id,
    jsonb_typeof(replacement.metadata -> 'rollbackSnapshotId') AS replacement_type,
    replacement.metadata ->> 'executionGateId' AS event_gate_id,
    jsonb_typeof(replacement.metadata -> 'executionGateId') AS event_gate_type,
    replacement.id AS event_id
    FROM policy_library_rebuild_execution_gates gate
    JOIN policy_intent_migration_events capture ON capture.id = gate.migration_event_id
    JOIN policy_intent_migration_events replacement ON replacement.id = gate.replacement_event_id
    WHERE gate.policy_id = $1`, [policyId]);
  expect(rows).toEqual([{
    gate_id: gateId,
    rollback_snapshot_id: snapshotId,
    capture_id: String(snapshotId), capture_type: typeof snapshotId,
    replacement_id: String(snapshotId), replacement_type: typeof snapshotId,
    event_gate_id: String(gateId), event_gate_type: typeof gateId,
    event_id: replacementReplay.execution.replacementEventId,
  }]);
  return { captured, cutover, replacementReplay, eventId: rows[0].event_id };
}

const readiness = createPolicyLibraryRebuildLegacyDeletionReadinessService({ dbClient: db, buildRemovalInventory });
const finalAudit = createPolicyLibraryRebuildLegacyFinalRemovalAuditService({ dbClient: db, buildRemovalInventory });

test.each([
  ['safe', 901, 801],
  ['lower-snapshot', '9007199254740992', 802],
  ['upper-snapshot', '9007199254740993', 803],
  ['maximum-snapshot', '9223372036854775807', 804],
  ['lower-gate', 902, '9007199254740992'],
  ['upper-gate', 903, '9007199254740993'],
  ['maximum-gate', 904, '9223372036854775807'],
])('preserves %s IDs through each persisted and read-only stage', async (tag, snapshotId, gateId) => {
  const item = await fixture(tag, snapshotId, gateId);
  await cutoverEvidence(item);
  const expired = await closeRollbackWindow(item);
  const ready = await readiness.evaluate(expired);
  const plan = await finalAudit.audit(expired);
  expect(ready).toMatchObject({
    readyForFinalRemovalAudit: true, rollback: { rollbackSnapshotId: snapshotId }, cutover: { gateId }, validation: { ok: true },
  });
  expect(plan).toMatchObject({
    readyForGlobalReleaseRetirementGate: true, rollback: { rollbackSnapshotId: snapshotId }, cutover: { gateId }, validation: { ok: true },
  });
});

test.each([
  {
    tag: 'ambiguous-snapshot', snapshotId: '9007199254741016', gateId: 805,
    eventKey: 'rollbackSnapshotId', receiptKey: 'rollbackSnapshotId', planSection: 'rollback',
  },
  {
    tag: 'ambiguous-gate', snapshotId: 905, gateId: '9007199254741016',
    eventKey: 'executionGateId', receiptKey: 'gateId', planSection: 'cutover',
  },
])('blocks adjacent strings and matching unsafe JSON numbers for $tag', async ({
  tag, snapshotId, gateId, eventKey, receiptKey, planSection,
}) => {
  const id = '9007199254741016';
  const item = await fixture(tag, snapshotId, gateId);
  const { captured, cutover, replacementReplay, eventId } = await cutoverEvidence(item);
  const expired = await closeRollbackWindow(item);
  const ready = await readiness.evaluate(expired);
  const plan = await finalAudit.audit(expired);

  for (const [receipt, field, validate] of [
    [captured, 'execution', validatePolicyLibraryRebuildSnapshotGate],
    [cutover, 'execution', validatePolicyLibraryRebuildCutoverResult],
    [replacementReplay, 'execution', validatePolicyLibraryRebuildReplacementGate],
    [ready, planSection, validatePolicyLibraryRebuildLegacyDeletionReadiness],
    [plan, planSection, validatePolicyLibraryRebuildLegacyFinalRemovalPlan],
  ]) {
    expect(validate({
      ...receipt, [field]: { ...receipt[field], [receiptKey]: Number(id) },
    }).ok).toBe(false);
  }

  for (const [reference, numericJson] of [['9007199254741017', false], [id, true]]) {
    await db.query(`UPDATE policy_intent_migration_events
      SET metadata = jsonb_set(metadata, ARRAY[$4::text],
        CASE WHEN $3::boolean THEN to_jsonb($1::text::numeric) ELSE to_jsonb($1::text) END)
      WHERE id = $2`, [reference, eventId, numericJson, eventKey]);
    const blocked = await readiness.evaluate(expired);
    expect(blocked.readyForFinalRemovalAudit).toBe(false);
    expect(blocked.risks).toContainEqual({ riskId: 'replacement_event_mismatch' });
    expect((await finalAudit.audit(expired)).readyForGlobalReleaseRetirementGate).toBe(false);
  }
});

test('rolls back the capture when its completion reports a neighboring snapshot', async () => {
  const item = await fixture('capture-completion', '9007199254741025', 806);
  const dbClient = { withTransaction: work => db.withTransaction(client => work({
    query: async (sql, params) => {
      const result = await client.query(sql, params);
      if (!sql.includes('RETURNING id, rollback_snapshot_id')) return result;
      return { ...result, rows: [{ ...result.rows[0], rollback_snapshot_id: '9007199254741024' }] };
    },
  })) };
  const result = await persistPolicyLibraryRebuildRollbackSnapshot({ ...item.args, dbClient });
  expect(result).toMatchObject({ statusId: 'failed_rolled_back', validation: { ok: false } });
  const { rows } = await db.query(`SELECT
    (SELECT COUNT(*)::int FROM policy_library_rebuild_execution_gates WHERE policy_id = $1) AS gates,
    (SELECT COUNT(*)::int FROM policy_intent_rollback_snapshots WHERE policy_id = $1) AS snapshots,
    (SELECT COUNT(*)::int FROM policy_intent_migration_events WHERE policy_id = $1) AS events`, [item.policyId]);
  expect(rows).toEqual([{ gates: 0, snapshots: 0, events: 0 }]);
});

test('rolls back replacement when completion reports a neighboring execution gate', async () => {
  const item = await fixture('replacement-completion', 906, '9007199254741025');
  const capture = await persistPolicyLibraryRebuildRollbackSnapshot(item.args);
  expect(capture).toMatchObject({ statusId: 'rollback_snapshot_persisted', validation: { ok: true } });
  const dbClient = { withTransaction: work => db.withTransaction(client => work({
    query: async (sql, params) => {
      const result = await client.query(sql, params);
      if (!sql.includes('UPDATE policy_library_rebuild_execution_gates') ||
          !sql.includes('replacement_intent_id = $3') || !sql.includes('RETURNING id')) return result;
      return { ...result, rows: [{ ...result.rows[0], id: '9007199254741024' }] };
    },
  })) };
  const result = await applyPolicyLibraryRebuildReplacement({ ...item.args, dbClient });
  expect(result).toMatchObject({ statusId: 'failed_rolled_back', validation: { ok: false } });
  const { rows } = await db.query(`SELECT gate.id, gate.state, gate.rollback_snapshot_id,
    gate.replacement_intent_id, gate.replacement_event_id, original.active AS original_active,
    (SELECT COUNT(*)::int FROM policy_intents WHERE policy_id = $1) AS intents,
    (SELECT COUNT(*)::int FROM policy_intent_rollback_snapshots WHERE policy_id = $1) AS snapshots,
    (SELECT COUNT(*)::int FROM policy_intent_migration_events WHERE policy_id = $1) AS events
    FROM policy_library_rebuild_execution_gates gate
    JOIN policy_intents original ON original.id = gate.intent_id
    WHERE gate.policy_id = $1`, [item.policyId]);
  expect(rows).toEqual([{
    id: item.gateId, state: 'snapshot_persisted', rollback_snapshot_id: item.snapshotId,
    replacement_intent_id: null, replacement_event_id: null, original_active: true,
    intents: 1, snapshots: 1, events: 1,
  }]);
});

test.each([
  ['safe-event', 907, 807, 7011],
  ['lower-event', 908, 808, '9007199254740992'],
  ['upper-event', 909, 809, '9007199254740993'],
  ['maximum-event', 910, 810, '9223372036854775807'],
])('preserves the %s identity from replacement through the final plan', async (tag, snapshotId, gateId, eventId) => {
  const item = await fixture(tag, snapshotId, gateId);
  await cutoverEvidence(item, eventId);
  const evidence = await db.withTransaction(client => loadPolicyLibraryRebuildLegacyDeletionEvidence({
    client, policyId: item.policyId,
  }));
  expect(evidence.executionGate.replacement_event_id).toBe(eventId);
  expect(evidence.replacementEvent.id).toBe(eventId);

  const expired = await closeRollbackWindow(item);
  expect(await readiness.evaluate(expired)).toMatchObject({
    readyForFinalRemovalAudit: true, cutover: { replacementEventId: eventId }, validation: { ok: true },
  });
  expect(await finalAudit.audit(expired)).toMatchObject({
    readyForGlobalReleaseRetirementGate: true, cutover: { replacementEventId: eventId }, validation: { ok: true },
  });
});

test('refuses a neighboring loaded event and unsafe detailed receipt IDs', async () => {
  const eventId = '9007199254741017';
  const item = await fixture('inconsistent-event', 911, 811);
  const { cutover, replacementReplay } = await cutoverEvidence(item, eventId);
  const expired = await closeRollbackWindow(item);
  const ready = await readiness.evaluate(expired);
  const plan = await finalAudit.audit(expired);
  const loadEvidence = async request => {
    const loaded = await loadPolicyLibraryRebuildLegacyDeletionEvidence(request);
    return { ...loaded, replacementEvent: { ...loaded.replacementEvent, id: '9007199254741016' } };
  };
  const inconsistentReadiness = createPolicyLibraryRebuildLegacyDeletionReadinessService({ dbClient: db, buildRemovalInventory, loadEvidence });
  const inconsistentAudit = createPolicyLibraryRebuildLegacyFinalRemovalAuditService({ dbClient: db, buildRemovalInventory, loadEvidence });
  const blocked = await inconsistentReadiness.evaluate(expired);
  expect(blocked.readyForFinalRemovalAudit).toBe(false);
  expect(blocked.risks).toContainEqual({ riskId: 'replacement_event_mismatch' });
  expect((await inconsistentAudit.audit(expired)).readyForGlobalReleaseRetirementGate).toBe(false);

  for (const [receipt, field, validate] of [
    [replacementReplay, 'execution', validatePolicyLibraryRebuildReplacementGate],
    [cutover, 'execution', validatePolicyLibraryRebuildCutoverResult],
    [ready, 'cutover', validatePolicyLibraryRebuildLegacyDeletionReadiness],
    [plan, 'cutover', validatePolicyLibraryRebuildLegacyFinalRemovalPlan],
  ]) {
    expect(validate({
      ...receipt, [field]: { ...receipt[field], replacementEventId: Number(eventId) },
    }).ok).toBe(false);
  }
});

test('rolls back replacement when completion saved a different event link', async () => {
  const item = await fixture('replacement-event-link', 912, 812);
  const capture = await persistPolicyLibraryRebuildRollbackSnapshot(item.args);
  expect(capture).toMatchObject({ statusId: 'rollback_snapshot_persisted', validation: { ok: true } });
  await setNextMigrationEventId('9007199254741025');
  const dbClient = { withTransaction: work => db.withTransaction(client => work({
    query: (sql, params) => {
      if (!sql.includes('UPDATE policy_library_rebuild_execution_gates') ||
          !sql.includes('replacement_event_id = $4') || !sql.includes('RETURNING id')) return client.query(sql, params);
      const changed = [...params];
      changed[3] = item.captureEventId;
      return client.query(sql, changed);
    },
  })) };
  const result = await applyPolicyLibraryRebuildReplacement({ ...item.args, dbClient });
  expect(result).toMatchObject({ statusId: 'failed_rolled_back', validation: { ok: false } });
  const { rows } = await db.query(`SELECT gate.state, gate.rollback_snapshot_id,
    gate.migration_event_id, gate.replacement_intent_id, gate.replacement_event_id,
    original.active AS original_active,
    (SELECT COUNT(*)::int FROM policy_intent_migration_events WHERE policy_id = $1) AS events
    FROM policy_library_rebuild_execution_gates gate
    JOIN policy_intents original ON original.id = gate.intent_id
    WHERE gate.policy_id = $1`, [item.policyId]);
  expect(rows).toEqual([{
    state: 'snapshot_persisted', rollback_snapshot_id: item.snapshotId, migration_event_id: item.captureEventId,
    replacement_intent_id: null, replacement_event_id: null, original_active: true, events: 1,
  }]);
});
