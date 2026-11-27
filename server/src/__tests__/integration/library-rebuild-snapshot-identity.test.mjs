/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash, randomUUID } from 'node:crypto';
import { expect, jest, test } from '@jest/globals';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput } = await import('../../services/policyLibraryPolicyRebuild.mjs');
const { buildPolicyLibraryRebuildAcceptanceTransition } = await import('../../services/policyLibraryRebuildAcceptanceTransition.mjs');
const { buildPolicyRollbackSnapshotWindow } = await import('../../services/policyRollbackSnapshotWindow.mjs');
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
const { buildPolicyLibraryRebuildLegacyRemovalInventory } = await import('../../services/policyLibraryRebuildLegacyRemovalInventory.mjs');

const buildRemovalInventory = () => buildPolicyLibraryRebuildLegacyRemovalInventory({
  artifacts: [{
    path: 'client/src/components/policies/LegacyProfileRefreshPanel.vue',
    owner: 'policy-builder', decisionId: 'delete_after_migration', verifierKindId: 'representative_replay',
    replacement: 'Synthetic native intent readiness proof',
    removalGateIds: ['native_intent_runtime_authority'],
    rollbackPlan: { snapshotRequired: true, restorePathRequired: true, retentionWindowDays: 30, nativeStorageMigrationAllowed: false },
    normalWorkflowAllowed: false,
  }],
});

function buildInputs({ policyId, intentId, libraryId, now }) {
  const action = {
    actorSourceId: 'manual_operator', actorId: 'admin:1', reasonCode: 'library_rebuild',
    reason: 'Operator accepted a library rebuild proposal.',
  };
  const proposal = buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput({
    library: { libraryId, libraryName: 'Animated Movies', mediaType: 'movie' },
    profileHandoff: {
      version: 'policy.library_profile_evidence_loader.v1', ok: true, statusId: 'ready', libraryId,
      profileEvidence: {
        version: 'policy.library_profile_evidence.v1',
        libraryProfile: {
          identityCandidates: [],
          compatibilityCandidates: [{
            key: 'genre:animation', label: 'Animation', value: '80%', count: 8,
            confidence: 0.8, reasonCode: 'observed_library_distribution',
          }],
          outliers: [],
        },
        sideEffects: { liveProviderLookupPerformed: false, providerQuotaRead: false, policyStorageMutated: false },
      },
      profileEvidenceAudit: { ok: true },
      profileFreshness: { stale: false, updatedAt: now.toISOString(), reasonCode: 'current_profile_timestamp' },
      evidenceBoundary: { ok: true },
      evidenceBoundaryAudit: { ok: true },
      sideEffects: {
        libraryProfileRead: true, liveMediaServerLookupPerformed: false, liveProviderLookupPerformed: false,
        providerQuotaRead: false, evidenceProjectionBuilt: true, policyStorageMutated: false,
      },
    },
    operatorIntent: { belongsHere: [{ key: 'studio:disney', label: 'Disney', count: 7 }] },
    routingConfiguration: {
      configured: true, routeReady: true, targetName: 'Animated Movies', arrRootFolderPath: '/synthetic/animation',
    },
  });
  const transition = buildPolicyLibraryRebuildAcceptanceTransition({
    proposal,
    policyContext: { policyId, intentId, libraryId },
    rollbackWindowPlan: buildPolicyRollbackSnapshotWindow({
      policy: { id: policyId, intent_id: intentId, library_id: libraryId, customSignals: { genres: { require_any: ['Animation'] } } },
      action,
      now,
    }),
    operatorDecision: { actorId: action.actorId, actorSourceId: action.actorSourceId, decisionId: 'accept_rebuild' },
    now,
  });
  return { proposal, transition };
}

async function seedVerificationReceipt({ policyId, intentId, libraryId, transition, now }) {
  const verificationKey = createHash('sha256').update(randomUUID()).digest('hex');
  await db.query(`INSERT INTO policy_migration_verification_runs (
    policy_id, intent_id, library_id, acceptance_transition_fingerprint,
    source_id, source_media_type, source_deterministic_order_id,
    source_maximum_classifications, source_rows_read, source_rows_considered,
    source_representative_classification_count, source_unusable_source_row_count,
    source_rows_truncated, source_coverage_sufficient, source_audit_ok, source_audit_issue_count,
    verifier_status_id, verifier_fingerprint, verifier_difference_count,
    verifier_emitted_difference_count, verifier_differences_truncated, verifier_audit_ok,
    verifier_audit_issue_count, coordinator_audit_ok, coordinator_audit_issue_count, idempotency_key, evaluated_at
  ) VALUES ($1, $2, $3, $4,
    'persisted_destination_library_final_outcomes', 'movie', 'created_at_desc_id_desc',
    1, 1, 1, 1, 0, FALSE, TRUE, TRUE, 0, 'no_migration_differences',
    $5, 0, 0, FALSE, TRUE, 0, TRUE, 0, $6, $7)`,
  [policyId, intentId, libraryId, transition.transitionFingerprint.fingerprint, 'c'.repeat(64),
    `policy:migration_verification:${verificationKey}`, now.toISOString()]);
}

async function fixture(tag, snapshotId, gateId) {
  const { policyId, libraryId, mediaServerId } = await createPolicyEngineIntegrationFixture(db, {
    libraryName: `Rebuild ${tag}`, policyName: `Rebuild ${tag}`,
  });
  const intent = await db.query(`WITH header AS (
    INSERT INTO policy_intents (policy_id, library_id, source, inference_state, validation_status)
    VALUES ($1, $2, 'native_intent', 'inferred', 'valid') RETURNING id
  )
    INSERT INTO policy_intent_rules (intent_id, collection, intent_role, signal_type, operator,
      values, constraint_mode, semantics, source, inference_state)
    SELECT id, 'purpose', 'purpose', 'genres', 'require_any', '{"require_any":["Animation"]}'::jsonb,
      'advisory', 'identity', 'native_intent', 'inferred' FROM header RETURNING intent_id`, [policyId, libraryId]);
  const intentId = intent.rows[0].intent_id;
  const arr = await db.query(`INSERT INTO radarr_config (name, url, api_key, media_server_id, verify_ssl)
    VALUES ($1, $2, 'synthetic', $3, true) RETURNING id`,
  [`Rebuild ${tag}`, `https://rebuild-${tag}.invalid`, mediaServerId]);
  await db.query(`INSERT INTO library_arr_mappings
    (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path, quality_profile_id)
    VALUES ($1, 'radarr', $2, 67, '/synthetic/animation', 87)`, [libraryId, arr.rows[0].id]);
  const now = new Date();
  const { proposal, transition } = buildInputs({ policyId, intentId, libraryId, now });
  await seedVerificationReceipt({ policyId, intentId, libraryId, transition, now });
  // Each case owns its sequence range in this disposable suite database.
  for (const [table, id] of [
    ['policy_intent_rollback_snapshots', snapshotId],
    ['policy_library_rebuild_execution_gates', gateId],
  ]) {
    await db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, id]);
  }
  return { policyId, intentId, snapshotId, gateId, args: { dbClient: db, proposal, transition, now } };
}

async function cutoverEvidence({ policyId, args, snapshotId, gateId }) {
  const captured = await persistPolicyLibraryRebuildRollbackSnapshot(args);
  const captureReplay = await persistPolicyLibraryRebuildRollbackSnapshot(args);
  const cutover = await createPolicyLibraryRebuildCutoverOrchestrator({ dbClient: db }).run(args);
  const replacementReplay = await applyPolicyLibraryRebuildReplacement(args);
  expect(captured).toMatchObject({ statusId: 'rollback_snapshot_persisted', validation: { ok: true } });
  expect(captureReplay).toMatchObject({ statusId: 'already_persisted', validation: { ok: true } });
  expect(cutover).toMatchObject({ statusId: 'cutover_applied', ok: true, checkpoints: { rollbackSnapshot: 'reused' } });
  expect(replacementReplay).toMatchObject({ statusId: 'already_applied', validation: { ok: true } });
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

async function closeRollbackWindow({ policyId, args, snapshotId }) {
  await db.query("UPDATE policy_intent_rollback_snapshots SET snapshot_payload = '{}'::jsonb, payload_redacted = true WHERE id = $1", [snapshotId]);
  const now = new Date(args.now.getTime() + 60 * 24 * 60 * 60 * 1000);
  return { policyId, now };
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
      return { ...result, rows: [{ id: '9007199254741024' }] };
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
