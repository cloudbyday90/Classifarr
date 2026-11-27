/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { readyCoordinatorResult } from '../helpers/policyMigrationVerificationRunFixture.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { buildLibraryRebuildRemovalInventoryFixture: buildRemovalInventory, createLibraryRebuildIdentityFixture } =
  await import('../setup/createLibraryRebuildIdentityFixture.mjs');
const { persistPolicyLibraryRebuildRollbackSnapshot, validatePolicyLibraryRebuildSnapshotGate } =
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
const { createPolicyMigrationVerificationRunHandoff } = await import('../../services/policyMigrationVerificationRunHandoff.mjs');
const { validatePolicyMigrationVerificationRunResult } = await import('../../services/policyMigrationVerificationRunContract.mjs');
const { POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS } =
  await import('../../services/policyMigrationVerificationInvocationBoundary.mjs');

const { fixture, closeRollbackWindow } = createLibraryRebuildIdentityFixture(db);
const readiness = createPolicyLibraryRebuildLegacyDeletionReadinessService({ dbClient: db, buildRemovalInventory });
const finalAudit = createPolicyLibraryRebuildLegacyFinalRemovalAuditService({ dbClient: db, buildRemovalInventory });
const lower = '9007199254740992';
const upper = '9007199254740993';
const maximum = '9223372036854775807';

function setNextRunId(id) {
  return db.query("SELECT setval(pg_get_serial_sequence('policy_migration_verification_runs', 'id'), $1::bigint, false)", [id]);
}

function recordVerification({ proposal, transition, now }, maximumClassifications = 25) {
  const coordinatorResult = readyCoordinatorResult();
  const { policyId, libraryId } = transition.policyContext;
  coordinatorResult.policyContext = transition.policyContext;
  coordinatorResult.acceptanceTransition.fingerprint = transition.transitionFingerprint.fingerprint;
  coordinatorResult.source.summary.maximumClassifications = maximumClassifications;
  Object.assign(coordinatorResult.source.provenance, { policyId, libraryId });
  coordinatorResult.evaluatedAt = now.toISOString();
  return createPolicyMigrationVerificationRunHandoff({
    db,
    coordinator: { coordinateMigrationVerification: async () => coordinatorResult },
    invocationScopeId: POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS.LIBRARY_REBUILD_CUTOVER,
  }).recordMigrationVerificationRun({ proposal, acceptanceTransition: transition, now });
}

test.each([
  ['safe', 931, 831, 731],
  ['adjacent', 932, 832, upper],
  ['maximum', 933, 833, maximum],
])('preserves the %s verification run across claim, replay, and rebuild', async (tag, snapshotId, gateId, runId) => {
  const item = await fixture(tag, snapshotId, gateId, { seedVerification: false });
  if (runId === upper) {
    await setNextRunId(lower);
    expect(await recordVerification(item.args, 24)).toMatchObject({
      statusId: 'persisted', verificationRun: { id: lower, verifierFingerprint: 'b'.repeat(64) },
    });
  }
  await setNextRunId(runId);
  const claimed = await recordVerification(item.args);
  // ON CONFLICT evaluates nextval before detecting replay, including after a maximum-ID insert.
  if (runId === maximum) await setNextRunId(799);
  const replayed = await recordVerification(item.args);
  expect(claimed).toMatchObject({ statusId: 'persisted', verificationRun: { id: runId } });
  expect(replayed).toMatchObject({ statusId: 'replayed', verificationRun: { id: runId } });

  const captured = await persistPolicyLibraryRebuildRollbackSnapshot(item.args);
  if (runId === upper) {
    const newer = await recordVerification(item.args, 26);
    expect(newer).toMatchObject({ statusId: 'persisted', verificationRun: { id: '9007199254740995' } });
  }
  if (typeof runId === 'number') {
    await db.query(`UPDATE policy_intent_migration_events
      SET metadata = metadata - 'verificationRunId' - 'verificationRunFingerprint'
      WHERE id = $1`, [item.captureEventId]);
  }
  const captureReplay = await persistPolicyLibraryRebuildRollbackSnapshot(item.args);
  const cutover = await createPolicyLibraryRebuildCutoverOrchestrator({ dbClient: db }).run(item.args);
  const replacementReplay = await applyPolicyLibraryRebuildReplacement(item.args);
  expect(captured).toMatchObject({ statusId: 'rollback_snapshot_persisted', validation: { ok: true } });
  expect(captureReplay).toMatchObject({ statusId: 'already_persisted', validation: { ok: true } });
  expect(cutover).toMatchObject({ statusId: 'cutover_applied', ok: true });
  expect(replacementReplay).toMatchObject({ statusId: 'already_applied', validation: { ok: true } });
  for (const receipt of [captured, captureReplay, cutover, replacementReplay]) {
    expect(receipt.execution.verificationRunId).toBe(runId);
  }

  const { rows } = await db.query(`SELECT gate.verification_run_id, run.id AS joined_run_id,
      capture.metadata ->> 'verificationRunId' AS capture_reference,
      jsonb_typeof(capture.metadata -> 'verificationRunId') AS capture_type,
      replacement.metadata ->> 'verificationRunId' AS replacement_reference,
      jsonb_typeof(replacement.metadata -> 'verificationRunId') AS replacement_type
    FROM policy_library_rebuild_execution_gates gate
    JOIN policy_migration_verification_runs run ON run.id = gate.verification_run_id
    JOIN policy_intent_migration_events capture ON capture.id = gate.migration_event_id
    JOIN policy_intent_migration_events replacement ON replacement.id = gate.replacement_event_id
    WHERE gate.id = $1`, [gateId]);
  expect(rows).toEqual([{
    verification_run_id: runId, joined_run_id: runId,
    capture_reference: typeof runId === 'string' ? runId : null,
    capture_type: typeof runId === 'string' ? 'string' : null,
    replacement_reference: String(runId), replacement_type: typeof runId,
  }]);

  const expired = await closeRollbackWindow(item);
  const ready = await readiness.evaluate(expired);
  const plan = await finalAudit.audit(expired);
  expect(ready).toMatchObject({
    readyForFinalRemovalAudit: true, verification: { verificationRunId: runId },
  });
  expect(plan).toMatchObject({
    readyForGlobalReleaseRetirementGate: true, verification: { verificationRunId: runId },
  });
  if (typeof runId === 'string') {
    expect(validatePolicyMigrationVerificationRunResult({
      ...replayed, verificationRun: { ...replayed.verificationRun, id: Number(runId) },
    }).ok).toBe(false);
    for (const [receipt, section, validate] of [
      [captured, 'execution', validatePolicyLibraryRebuildSnapshotGate],
      [cutover, 'execution', validatePolicyLibraryRebuildCutoverResult],
      [replacementReplay, 'execution', validatePolicyLibraryRebuildReplacementGate],
      [ready, 'verification', validatePolicyLibraryRebuildLegacyDeletionReadiness],
      [plan, 'verification', validatePolicyLibraryRebuildLegacyFinalRemovalPlan],
    ]) {
      expect(validate({
        ...receipt, [section]: { ...receipt[section], verificationRunId: Number(runId) },
      }).ok).toBe(false);
    }
  }

  if (runId === upper) {
    // This models a historical completed gate. Replay remains read-only and that event cannot support deletion.
    await db.query(`UPDATE policy_intent_migration_events SET metadata = metadata - 'verificationRunId'
      WHERE id = $1`, [item.captureEventId]);
    for (const [storedId, asNumber] of [[lower, false], [upper, true]]) {
      await db.query(`UPDATE policy_intent_migration_events
        SET metadata = jsonb_set(metadata, '{verificationRunId}',
          CASE WHEN $3::boolean THEN to_jsonb($1::text::numeric) ELSE to_jsonb($1::text) END)
        WHERE id = $2`, [storedId, replacementReplay.execution.replacementEventId, asNumber]);
      expect(await readiness.evaluate(expired)).toMatchObject({
        readyForFinalRemovalAudit: false, risks: expect.arrayContaining([{ riskId: 'replacement_event_mismatch' }]),
      });
      expect((await finalAudit.audit(expired)).readyForGlobalReleaseRetirementGate).toBe(false);
    }
    expect(await applyPolicyLibraryRebuildReplacement(item.args)).toMatchObject({
      statusId: 'already_applied', execution: { verificationRunId: upper },
    });
  }
});

test('rolls back all capture writes when completion changed the verification link to its neighbor', async () => {
  const item = await fixture('verification-link-rollback', 934, 834, { seedVerification: false });
  const neighbor = '9007199254741100';
  await setNextRunId(neighbor);
  await recordVerification(item.args, 24);
  await recordVerification(item.args);
  const dbClient = { withTransaction: work => db.withTransaction(client => work({
    query: (sql, params) => {
      if (!sql.includes('RETURNING id, rollback_snapshot_id')) return client.query(sql, params);
      const query = sql.replace('SET state = $2,', 'SET state = $2, verification_run_id = $7,');
      return client.query(query, [...params, neighbor]);
    },
  })) };
  expect(await persistPolicyLibraryRebuildRollbackSnapshot({ ...item.args, dbClient })).toMatchObject({
    statusId: 'failed_rolled_back', validation: { ok: false },
  });
  const { rows } = await db.query(`SELECT
    (SELECT COUNT(*)::int FROM policy_library_rebuild_execution_gates WHERE policy_id = $1) AS gates,
    (SELECT COUNT(*)::int FROM policy_intent_rollback_snapshots WHERE policy_id = $1) AS snapshots,
    (SELECT COUNT(*)::int FROM policy_intent_migration_events WHERE policy_id = $1) AS events,
    (SELECT COUNT(*)::int FROM policy_migration_verification_runs WHERE policy_id = $1) AS verification_runs`, [item.policyId]);
  expect(rows).toEqual([{ gates: 0, snapshots: 0, events: 0, verification_runs: 2 }]);
});

test('refuses forward replacement of a historical large pending gate with an unproven neighboring link', async () => {
  const item = await fixture('verification-unproven-gate', 935, 835, { seedVerification: false });
  const neighbor = '9007199254741200';
  await setNextRunId(neighbor);
  await recordVerification(item.args, 24);
  await recordVerification(item.args);
  expect(await persistPolicyLibraryRebuildRollbackSnapshot(item.args)).toMatchObject({
    statusId: 'rollback_snapshot_persisted', execution: { verificationRunId: '9007199254741201' },
  });
  await db.query('UPDATE policy_library_rebuild_execution_gates SET verification_run_id = $1 WHERE id = $2',
    [neighbor, item.gateId]);
  for (const patch of [
    {},
    { verificationRunId: Number(neighbor) },
    { verificationRunId: '9007199254741201' },
    { verificationRunId: neighbor, verificationRunFingerprint: 'd'.repeat(64) },
  ]) {
    await db.query(`UPDATE policy_intent_migration_events
      SET metadata = (metadata - 'verificationRunId') || $2::jsonb WHERE id = $1`,
    [item.captureEventId, JSON.stringify(patch)]);
    expect(await persistPolicyLibraryRebuildRollbackSnapshot(item.args)).toMatchObject({
      statusId: 'blocked_by_current_state', validation: { ok: false },
    });
    expect(await applyPolicyLibraryRebuildReplacement(item.args)).toMatchObject({
      statusId: 'blocked_by_verification_run', validation: { ok: false },
    });
  }
  const { rows } = await db.query(`SELECT gate.state, gate.verification_run_id, gate.replacement_event_id,
    original.active,
    (SELECT COUNT(*)::int FROM policy_intent_migration_events WHERE policy_id = gate.policy_id) AS events
    FROM policy_library_rebuild_execution_gates gate JOIN policy_intents original ON original.id = gate.intent_id
    WHERE gate.id = $1`, [item.gateId]);
  expect(rows).toEqual([{
    state: 'snapshot_persisted', verification_run_id: neighbor, replacement_event_id: null, active: true, events: 1,
  }]);
});
