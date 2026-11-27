/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash, randomUUID } from 'node:crypto';
import { createPolicyEngineIntegrationFixture } from './createPolicyEngineIntegrationFixture.mjs';
import { buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput } from '../../services/policyLibraryPolicyRebuild.mjs';
import { buildPolicyLibraryRebuildAcceptanceTransition } from '../../services/policyLibraryRebuildAcceptanceTransition.mjs';
import { buildPolicyLibraryRebuildLegacyRemovalInventory } from '../../services/policyLibraryRebuildLegacyRemovalInventory.mjs';
import { buildPolicyRollbackSnapshotWindow } from '../../services/policyRollbackSnapshotWindow.mjs';

export function buildLibraryRebuildRemovalInventoryFixture() {
  return buildPolicyLibraryRebuildLegacyRemovalInventory({
    artifacts: [{
      path: 'client/src/components/policies/LegacyProfileRefreshPanel.vue',
      owner: 'policy-builder', decisionId: 'delete_after_migration', verifierKindId: 'representative_replay',
      replacement: 'Synthetic native intent readiness proof',
      removalGateIds: ['native_intent_runtime_authority'],
      rollbackPlan: { snapshotRequired: true, restorePathRequired: true, retentionWindowDays: 30, nativeStorageMigrationAllowed: false },
      normalWorkflowAllowed: false,
    }],
  });
}

function buildInputs({ policyId, intentId, libraryId, libraryName, now }) {
  const action = {
    actorSourceId: 'manual_operator', actorId: 'admin:1', reasonCode: 'library_rebuild',
    reason: 'Operator accepted a library rebuild proposal.',
  };
  const proposal = buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput({
    library: { libraryId, libraryName, mediaType: 'movie' },
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

async function seedVerificationReceipt(db, { policyId, intentId, libraryId, transition, now }) {
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

export function createLibraryRebuildIdentityFixture(db) {
  function setNextMigrationEventId(id) {
    return db.query("SELECT setval(pg_get_serial_sequence('policy_intent_migration_events', 'id'), $1::bigint, false)", [id]);
  }

  async function fixture(tag, snapshotId, gateId, {
    captureEventId: requestedCaptureEventId = null,
    seedVerification = true,
  } = {}) {
    const libraryName = `Rebuild ${tag}`;
    const { policyId, libraryId, mediaServerId } = await createPolicyEngineIntegrationFixture(db, {
      libraryName, policyName: libraryName,
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
    const { proposal, transition } = buildInputs({ policyId, intentId, libraryId, libraryName, now });
    if (seedVerification) {
      await seedVerificationReceipt(db, { policyId, intentId, libraryId, transition, now });
    }
    // Each case owns its sequence range in this disposable suite database.
    for (const [table, id] of [
      ['policy_intent_rollback_snapshots', snapshotId],
      ['policy_library_rebuild_execution_gates', gateId],
    ]) {
      await db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, id]);
    }
    const captureEventId = requestedCaptureEventId ?? 1000 + policyId * 2;
    await setNextMigrationEventId(captureEventId);
    return { policyId, intentId, snapshotId, gateId, captureEventId, args: { dbClient: db, proposal, transition, now } };
  }

  async function closeRollbackWindow({ policyId, args, snapshotId }) {
    await db.query("UPDATE policy_intent_rollback_snapshots SET snapshot_payload = '{}'::jsonb, payload_redacted = true WHERE id = $1", [snapshotId]);
    const now = new Date(args.now.getTime() + 60 * 24 * 60 * 60 * 1000);
    return { policyId, now };
  }

  return { fixture, setNextMigrationEventId, closeRollbackWindow, seedVerification: input => seedVerificationReceipt(db, input) };
}
