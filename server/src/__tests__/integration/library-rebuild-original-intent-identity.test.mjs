/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, beforeAll, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { buildLibraryRebuildRemovalInventoryFixture: buildRemovalInventory, createLibraryRebuildIdentityFixture } =
  await import('../setup/createLibraryRebuildIdentityFixture.mjs');
const { createPolicyMigrationVerificationRunHandoff } = await import('../../services/policyMigrationVerificationRunHandoff.mjs');
const { POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS } =
  await import('../../services/policyMigrationVerificationInvocationBoundary.mjs');
const { persistPolicyLibraryRebuildRollbackSnapshot } = await import('../../services/policyLibraryRebuildSnapshotGate.mjs');
const { applyPolicyLibraryRebuildReplacement } = await import('../../services/policyLibraryRebuildReplacementGate.mjs');
const { createPolicyLibraryRebuildCutoverOrchestrator } = await import('../../services/policyLibraryRebuildCutoverOrchestrator.mjs');
const { createPolicyLibraryRebuildLegacyDeletionReadinessService } =
  await import('../../services/policyLibraryRebuildLegacyDeletionReadinessService.mjs');
const { createPolicyLibraryRebuildLegacyFinalRemovalAuditService } =
  await import('../../services/policyLibraryRebuildLegacyFinalRemovalAuditService.mjs');

const { fixture, closeRollbackWindow, seedVerification } = createLibraryRebuildIdentityFixture(db);
const invocationScopeId = POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS.LIBRARY_REBUILD_CUTOVER;
const verification = createPolicyMigrationVerificationRunHandoff({
  db,
  invocationScopeId,
});
const readiness = createPolicyLibraryRebuildLegacyDeletionReadinessService({ dbClient: db, buildRemovalInventory });
const finalAudit = createPolicyLibraryRebuildLegacyFinalRemovalAuditService({ dbClient: db, buildRemovalInventory });
const lower = '9007199254740992';
const upper = '9007199254740993';
const maximum = '9223372036854775807';

const nativeClone = globalThis.structuredClone;
let realmClone;
beforeAll(() => {
  // Jest exposes Node's clone from the host realm. Keep the cloned JSON data and
  // timestamp in the test realm so the production plain-object guards can read them.
  realmClone = jest.spyOn(globalThis, 'structuredClone').mockImplementation(input => {
    const copy = nativeClone(input);
    return { ...JSON.parse(JSON.stringify(copy)), now: new Date(copy.now) };
  });
});
afterAll(() => realmClone?.mockRestore());

function setNextIntentId(id) {
  return db.query("SELECT setval(pg_get_serial_sequence('policy_intents', 'id'), $1::bigint, false)", [id]);
}

async function prepareRebuild(tag, ordinal, intentId) {
  await setNextIntentId(intentId);
  const item = await fixture(tag, 970 + ordinal, 870 + ordinal, { seedVerification: false });
  const { proposal, transition, now } = item.args;
  await setNextIntentId(370 + ordinal);
  await db.query(`INSERT INTO classification_history (title, media_type, library_id, status, confidence)
    VALUES ('Synthetic verification sample', 'movie', $1, $2, $3)`,
  [transition.policyContext.libraryId, proposal.readiness.ready ? 'routed' : 'completed', proposal.confidence.score]);
  return { ...item, verificationArgs: { proposal, acceptanceTransition: transition, now } };
}

function insertInactiveNeighbor(item, id) {
  return db.query(`INSERT INTO policy_intents
    (id, policy_id, library_id, intent_version, active, source, inference_state, validation_status)
    VALUES ($1, $2, $3, 3, false, 'native_intent', 'inferred', 'valid')`,
  [id, item.policyId, item.args.transition.policyContext.libraryId]);
}

test.each([
  ['safe', 1, 221],
  ['lower adjacent', 2, lower],
  ['upper adjacent', 3, upper],
  ['maximum', 4, maximum],
])('preserves the %s original through verification, capture, cutover, and removal', async (tag, ordinal, intentId) => {
  const item = await prepareRebuild(tag.replace(' ', '-'), ordinal, intentId);
  expect(item.args.transition).toMatchObject({
    statusId: 'ready_for_migration_verification',
    policyContext: { intentId },
    rollbackWindowPlan: { intentId, snapshot: { intentId } },
  });
  const recorded = await verification.recordMigrationVerificationRun(item.verificationArgs);
  expect(recorded).toMatchObject({
    statusId: 'persisted',
    coordinator: { statusId: 'ready', policyContext: { intentId } },
    verificationRun: { intentId, verifierStatusId: 'no_migration_differences' },
  });
  expect(await verification.recordMigrationVerificationRun(item.verificationArgs)).toMatchObject({
    statusId: 'replayed', verificationRun: { id: recorded.verificationRun.id, intentId },
  });
  const captured = await persistPolicyLibraryRebuildRollbackSnapshot(item.args);
  expect(captured).toMatchObject({
    statusId: 'rollback_snapshot_persisted', execution: { intentId, verificationRunId: recorded.verificationRun.id },
  });

  if (typeof intentId === 'number') {
    await db.query(`UPDATE policy_intent_migration_events
      SET metadata = metadata - 'originalIntentId' WHERE id = $1`, [item.captureEventId]);
  }
  expect(await persistPolicyLibraryRebuildRollbackSnapshot(item.args)).toMatchObject({
    statusId: 'already_persisted', execution: { intentId, idempotent: true },
  });
  const applied = await createPolicyLibraryRebuildCutoverOrchestrator({ dbClient: db }).run(item.args);
  expect(applied).toMatchObject({ statusId: 'cutover_applied', execution: { originalIntentId: intentId } });
  expect(await applyPolicyLibraryRebuildReplacement(item.args)).toMatchObject({
    statusId: 'already_applied', execution: { originalIntentId: intentId, idempotent: true },
  });
  const { rows: [links] } = await db.query(`SELECT
    gate.intent_id AS gate, snapshot.intent_id AS snapshot, run.intent_id AS run,
    captured.intent_id AS capture, captured.metadata ->> 'originalIntentId' AS capture_reference,
    jsonb_typeof(captured.metadata -> 'originalIntentId') AS capture_type,
    replaced.metadata ->> 'originalIntentId' AS replacement_reference,
    jsonb_typeof(replaced.metadata -> 'originalIntentId') AS replacement_type
    FROM policy_library_rebuild_execution_gates gate
    JOIN policy_intent_rollback_snapshots snapshot ON snapshot.id = gate.rollback_snapshot_id
    JOIN policy_migration_verification_runs run ON run.id = gate.verification_run_id
    JOIN policy_intent_migration_events captured ON captured.id = gate.migration_event_id
    JOIN policy_intent_migration_events replaced ON replaced.id = gate.replacement_event_id
    WHERE gate.id = $1`, [item.gateId]);
  expect(links).toEqual({
    gate: intentId, snapshot: intentId, run: intentId, capture: intentId,
    capture_reference: typeof intentId === 'number' ? null : intentId,
    capture_type: typeof intentId === 'number' ? null : 'string',
    replacement_reference: String(intentId), replacement_type: typeof intentId,
  });
  const expired = await closeRollbackWindow(item);
  expect(await readiness.evaluate(expired)).toMatchObject({
    readyForFinalRemovalAudit: true, cutover: { originalIntentId: intentId },
  });
  expect(await finalAudit.audit(expired)).toMatchObject({
    readyForGlobalReleaseRetirementGate: true, cutover: { originalIntentId: intentId },
  });
});

test('rejects a neighboring verification receipt and rolls back a mismatched snapshot insert', async () => {
  const intentId = '9007199254741501';
  const neighbor = '9007199254741500';
  const item = await prepareRebuild('wrong-snapshot', 5, intentId);
  await insertInactiveNeighbor(item, neighbor);
  await seedVerification({
    policyId: item.policyId,
    libraryId: item.args.transition.policyContext.libraryId,
    intentId: neighbor,
    transition: item.args.transition,
    now: item.args.now,
  });
  expect(await persistPolicyLibraryRebuildRollbackSnapshot(item.args)).toMatchObject({
    statusId: 'blocked_by_verification_run',
  });
  const recorded = await verification.recordMigrationVerificationRun(item.verificationArgs);
  expect(recorded).toMatchObject({ statusId: 'persisted', verificationRun: { intentId } });

  let insertedForNeighbor = false;
  const dbClient = { withTransaction: work => db.withTransaction(client => work({
    query: async (sql, params) => {
      if (!sql.includes('INSERT INTO policy_intent_rollback_snapshots')) return client.query(sql, params);
      const result = await client.query(sql, [neighbor, ...params.slice(1)]);
      insertedForNeighbor = result.rows[0]?.intent_id === neighbor;
      return result;
    },
  })) };
  expect(await persistPolicyLibraryRebuildRollbackSnapshot({ ...item.args, dbClient })).toMatchObject({
    statusId: 'failed_rolled_back',
  });
  expect(insertedForNeighbor).toBe(true);
  const { rows: [state] } = await db.query(`SELECT intent.active,
    (SELECT count(*)::int FROM policy_library_rebuild_execution_gates WHERE policy_id = $2) AS gates,
    (SELECT count(*)::int FROM policy_intent_rollback_snapshots WHERE policy_id = $2) AS snapshots,
    (SELECT count(*)::int FROM policy_intent_migration_events WHERE policy_id = $2) AS events
    FROM policy_intents intent WHERE intent.id = $1`, [intentId, item.policyId]);
  expect(state).toEqual({ active: true, gates: 0, snapshots: 0, events: 0 });
});

test('rolls back an inserted verification receipt linked to a neighboring original', async () => {
  const intentId = '9007199254741701';
  const neighbor = '9007199254741700';
  const item = await prepareRebuild('wrong-verification-write', 7, intentId);
  await insertInactiveNeighbor(item, neighbor);
  let insertedForNeighbor = false;
  const transactionDb = { withTransaction: work => db.withTransaction(client => work({
    query: async (sql, params) => {
      if (!sql.includes('INSERT INTO policy_migration_verification_runs')) return client.query(sql, params);
      const [version, policyId, , ...remaining] = params;
      const result = await client.query(sql, [version, policyId, neighbor, ...remaining]);
      insertedForNeighbor = result.rows[0]?.intent_id === neighbor;
      return result;
    },
  })) };
  const guardedHandoff = createPolicyMigrationVerificationRunHandoff({ db: transactionDb, invocationScopeId });
  expect(await guardedHandoff.recordMigrationVerificationRun(item.verificationArgs)).toMatchObject({
    statusId: 'persistence_failed', verificationRun: null,
  });
  expect(insertedForNeighbor).toBe(true);
  expect((await db.query('SELECT id FROM policy_migration_verification_runs WHERE policy_id = $1', [item.policyId])).rows)
    .toEqual([]);
  expect(await verification.recordMigrationVerificationRun(item.verificationArgs)).toMatchObject({
    statusId: 'persisted', verificationRun: { intentId },
  });
});

test('requires typed proof of the large original before replay, replacement and removal', async () => {
  const intentId = '9007199254741601';
  const neighbor = '9007199254741600';
  const item = await prepareRebuild('missing-original-proof', 6, intentId);
  expect(await verification.recordMigrationVerificationRun(item.verificationArgs)).toMatchObject({ statusId: 'persisted' });
  expect(await persistPolicyLibraryRebuildRollbackSnapshot(item.args)).toMatchObject({ statusId: 'rollback_snapshot_persisted' });

  function replaceOriginalProof(eventId, reference) {
    return db.query(`UPDATE policy_intent_migration_events
      SET metadata = (metadata - 'originalIntentId') || $2::jsonb WHERE id = $1`,
    [eventId, JSON.stringify(reference)]);
  }

  const badProofs = [{}, { originalIntentId: Number(intentId) }, { originalIntentId: neighbor }];
  for (const proof of badProofs) {
    await replaceOriginalProof(item.captureEventId, proof);
    expect(await persistPolicyLibraryRebuildRollbackSnapshot(item.args)).toMatchObject({ statusId: 'blocked_by_current_state' });
    expect(await applyPolicyLibraryRebuildReplacement(item.args)).toMatchObject({ statusId: 'blocked_by_verification_run' });
  }

  await replaceOriginalProof(item.captureEventId, { originalIntentId: intentId });
  const applied = await applyPolicyLibraryRebuildReplacement(item.args);
  expect(applied).toMatchObject({ statusId: 'replacement_applied', execution: { originalIntentId: intentId } });
  const expired = await closeRollbackWindow(item);
  for (const proof of badProofs) {
    await replaceOriginalProof(applied.execution.replacementEventId, proof);
    expect(await applyPolicyLibraryRebuildReplacement(item.args)).toMatchObject({ statusId: 'blocked_by_current_state' });
    expect(await readiness.evaluate(expired)).toMatchObject({
      readyForFinalRemovalAudit: false, risks: expect.arrayContaining([{ riskId: 'replacement_event_mismatch' }]),
    });
    expect((await finalAudit.audit(expired)).readyForGlobalReleaseRetirementGate).toBe(false);
  }
});
