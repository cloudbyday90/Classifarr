/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  PolicyPurposeCoverageReviewService,
} = await import('../../services/policyPurposeCoverageReviewService.mjs');

async function createNativePurposeFixture({ libraryName, policyName, purposeRules }) {
  const fixture = await createPolicyEngineIntegrationFixture(db, {
    mediaServerName: 'Policy Purpose Coverage Review Media Server',
    libraryExternalIdPrefix: 'policy-purpose-coverage-review',
    libraryName,
    policyName,
    presetKeyPrefix: 'policy-purpose-coverage-review',
    presetName: 'Policy Purpose Coverage Review Preset',
    presetSignals: {},
  });

  const intentResult = await db.query(`
    WITH native_intent AS (
      INSERT INTO policy_intents (
        policy_id, library_id, schema_version, intent_version,
        active, source, inference_state, review_behavior, validation_status
      )
      VALUES ($1, $2, 1, 1, TRUE, 'native_intent', 'inferred', '{}'::jsonb, 'valid')
      RETURNING id
    ), inserted_rules AS (
    INSERT INTO policy_intent_rules (
      intent_id, intent_role, collection, signal_type, operator,
      values, constraint_mode, semantics, source, inference_state
    )
    SELECT
      native_intent.id,
      'purpose',
      'purpose',
      purpose_rule.signal_type,
      purpose_rule.operator,
      purpose_rule.values,
      'advisory',
      'identity',
      COALESCE(purpose_rule.source, 'native_intent'),
      COALESCE(purpose_rule.inference_state, 'inferred')
    FROM native_intent
    CROSS JOIN jsonb_to_recordset($3::jsonb) AS purpose_rule(
      signal_type TEXT,
      operator TEXT,
      values JSONB,
      source TEXT,
      inference_state TEXT
    )
    RETURNING intent_id
    )
    SELECT id FROM native_intent
  `, [fixture.policyId, fixture.libraryId, JSON.stringify(purposeRules)]);

  return { ...fixture, intentId: intentResult.rows[0].id };
}

async function establishInitialIntent({ policyId, libraryId, intentId }) {
  const snapshot = await db.query(`
    INSERT INTO policy_intent_rollback_snapshots (
      intent_id, policy_id, snapshot_version, snapshot_payload,
      payload_redacted, restore_path, expires_at
    )
    VALUES ($1, $2, 1, '{}'::jsonb, TRUE, 'policy/test/rollback', NOW() + INTERVAL '14 days')
    RETURNING id
  `, [intentId, policyId]);
  const event = await db.query(`
    INSERT INTO policy_intent_migration_events (
      intent_id, policy_id, event_type, actor_type,
      target_version, reason_code, metadata
    )
    VALUES ($1, $2, 'initial_intent_established', 'test_fixture', 1, 'test_fixture', '{}'::jsonb)
    RETURNING id
  `, [intentId, policyId]);
  await db.query(`
    INSERT INTO policy_initial_intent_establishments (
      policy_id, library_id, intent_id, migration_event_id, rollback_snapshot_id,
      idempotency_key, request_fingerprint, authority_source_id, accepted_by,
      state, established_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, 'operator_declared_intent', 1,
      'established', NOW()
    )
  `, [
    policyId,
    libraryId,
    intentId,
    event.rows[0].id,
    snapshot.rows[0].id,
    `policy-purpose-coverage-${policyId}`.padEnd(32, 'x'),
    `${policyId}`.padStart(64, '0'),
  ]);
}

async function replaceCurrentIntentWithoutLifecycleReceipt({ policyId, intentId, purposeRules }) {
  const result = await db.query(`
    WITH deactivated_intent AS (
      UPDATE policy_intents
      SET active = FALSE
      WHERE id = $1
        AND policy_id = $2
      RETURNING policy_id, library_id
    ), native_intent AS (
      INSERT INTO policy_intents (
        policy_id, library_id, schema_version, intent_version,
        active, source, inference_state, review_behavior, validation_status
      )
      SELECT
        policy_id, library_id, 1, 2,
        TRUE, 'native_intent', 'inferred', '{}'::jsonb, 'valid'
      FROM deactivated_intent
      RETURNING id
    )
    INSERT INTO policy_intent_rules (
      intent_id, intent_role, collection, signal_type, operator,
      values, constraint_mode, semantics, source, inference_state
    )
    SELECT
      native_intent.id,
      'purpose',
      'purpose',
      purpose_rule.signal_type,
      purpose_rule.operator,
      purpose_rule.values,
      'advisory',
      'identity',
      'native_intent',
      'inferred'
    FROM native_intent
    CROSS JOIN jsonb_to_recordset($3::jsonb) AS purpose_rule(
      signal_type TEXT,
      operator TEXT,
      values JSONB
    )
    RETURNING intent_id
  `, [intentId, policyId, JSON.stringify(purposeRules)]);

  return result.rows[0].intent_id;
}

async function replaceCurrentIntentThroughVerifiedLibraryRebuild({
  policyId,
  libraryId,
  intentId,
  purposeTerm,
}) {
  const replacement = await db.query(`
    WITH deactivated_intent AS (
      UPDATE policy_intents
      SET active = FALSE
      WHERE id = $1
        AND policy_id = $2
      RETURNING policy_id, library_id
    ), replacement_intent AS (
      INSERT INTO policy_intents (
        policy_id, library_id, schema_version, intent_version,
        active, source, inference_state, review_behavior, validation_status
      )
      SELECT
        policy_id, library_id, 1, 2,
        TRUE, 'native_intent', 'inferred', '{}'::jsonb, 'valid'
      FROM deactivated_intent
      RETURNING id
    ), linked_previous_intent AS (
      UPDATE policy_intents previous_intent
      SET replaced_by_intent_id = replacement_intent.id
      FROM replacement_intent
      WHERE previous_intent.id = $1
      RETURNING previous_intent.id
    )
    INSERT INTO policy_intent_rules (
      intent_id, intent_role, collection, signal_type, operator,
      values, constraint_mode, semantics, source, inference_state
    )
    SELECT
      replacement_intent.id,
      'purpose',
      'purpose',
      'genres',
      'require_any',
      jsonb_build_object('require_any', jsonb_build_array($3::text)),
      'advisory',
      'identity',
      'library_rebuild',
      'inferred'
    FROM replacement_intent
    RETURNING intent_id
  `, [intentId, policyId, purposeTerm]);
  const replacementIntentId = replacement.rows[0].intent_id;
  const transitionFingerprint = 'a'.repeat(64);
  const verifierFingerprint = 'b'.repeat(64);

  const snapshotEvent = await db.query(`
    INSERT INTO policy_intent_migration_events (
      intent_id, policy_id, event_type, actor_type,
      source_version, target_version, reason_code, metadata
    )
    VALUES (
      $1, $2, 'rollback_snapshot_created', 'test_fixture',
      1, 1, 'test_fixture', '{}'::jsonb
    )
    RETURNING id
  `, [intentId, policyId]);
  const rollbackSnapshot = await db.query(`
    INSERT INTO policy_intent_rollback_snapshots (
      intent_id, policy_id, snapshot_version, snapshot_payload,
      payload_redacted, restore_path, expires_at
    )
    VALUES (
      $1, $2, 1, '{}'::jsonb,
      TRUE, 'policy/test/library-rebuild', NOW() + INTERVAL '14 days'
    )
    RETURNING id
  `, [intentId, policyId]);
  const verificationRun = await db.query(`
    INSERT INTO policy_migration_verification_runs (
      policy_id, intent_id, library_id, acceptance_transition_fingerprint,
      source_id, source_media_type, source_deterministic_order_id,
      source_maximum_classifications, source_rows_read, source_rows_considered,
      source_representative_classification_count, source_unusable_source_row_count,
      source_rows_truncated, source_coverage_sufficient, source_audit_ok,
      source_audit_issue_count, verifier_status_id, verifier_fingerprint,
      verifier_difference_count, verifier_emitted_difference_count,
      verifier_differences_truncated, verifier_audit_ok, verifier_audit_issue_count,
      coordinator_audit_ok, coordinator_audit_issue_count, idempotency_key, evaluated_at
    )
    VALUES (
      $1, $2, $3, $4,
      'persisted_destination_library_final_outcomes', 'movie', 'created_at_desc_id_desc',
      1, 1, 1,
      1, 0,
      FALSE, TRUE, TRUE,
      0, 'no_migration_differences', $5,
      0, 0,
      FALSE, TRUE, 0,
      TRUE, 0, $6, NOW()
    )
    RETURNING id
  `, [
    policyId,
    intentId,
    libraryId,
    transitionFingerprint,
    verifierFingerprint,
    `policy:migration_verification:${'c'.repeat(64)}`,
  ]);
  const replacementEvent = await db.query(`
    INSERT INTO policy_intent_migration_events (
      intent_id, policy_id, event_type, actor_type,
      source_version, target_version, reason_code, metadata
    )
    VALUES (
      $1, $2, 'library_rebuild_replacement_applied', 'test_fixture',
      1, 2, 'library_rebuild_replacement_applied', '{}'::jsonb
    )
    RETURNING id
  `, [replacementIntentId, policyId]);
  await db.query(`
    INSERT INTO policy_library_rebuild_execution_gates (
      policy_id, intent_id, library_id, state, idempotency_key,
      transition_fingerprint, proposal_fingerprint, rollback_plan_fingerprint,
      actor_source_id, actor_reference, acceptance_expires_at,
      rollback_snapshot_id, migration_event_id, verification_run_id,
      verification_run_fingerprint, replacement_intent_id, replacement_event_id,
      replacement_applied_at
    )
    VALUES (
      $1, $2, $3, 'replacement_applied', $4,
      $5, $6, $7,
      'test_fixture', $8, NOW() + INTERVAL '15 minutes',
      $9, $10, $11,
      $12, $13, $14,
      NOW()
    )
  `, [
    policyId,
    intentId,
    libraryId,
    `policy:library_rebuild_acceptance:${'d'.repeat(64)}`,
    transitionFingerprint,
    'e'.repeat(64),
    'f'.repeat(64),
    '1'.repeat(64),
    rollbackSnapshot.rows[0].id,
    snapshotEvent.rows[0].id,
    verificationRun.rows[0].id,
    verifierFingerprint,
    replacementIntentId,
    replacementEvent.rows[0].id,
  ]);

  return replacementIntentId;
}

async function clearFixtureVerificationRuns(policyId) {
  await db.withTransaction(async client => {
    await client.query(
      'DELETE FROM policy_library_rebuild_execution_gates WHERE policy_id = $1',
      [policyId],
    );
    await client.query(
      "SELECT set_config('classifarr.policy_migration_verification_run_maintenance', 'replace_restore', true)",
    );
    await client.query(
      'DELETE FROM policy_migration_verification_runs WHERE policy_id = $1',
      [policyId],
    );
  });
}

describe('Policy purpose coverage review integration', () => {
  const fixtures = [];

  afterAll(async () => {
    for (const fixture of fixtures.reverse()) {
      await clearFixtureVerificationRuns(fixture.policyId);
      await fixture.cleanup();
    }
  });

  test('reports missing purpose coverage, shared “any” alternatives, and complete same-media-type overlap without returning configured terms', async () => {
    const maintained = await createNativePurposeFixture({
      libraryName: 'Coverage Maintained Library',
      policyName: 'Coverage Maintained Policy',
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['unique-review-token'] },
      }],
    });
    const broadOne = await createNativePurposeFixture({
      libraryName: 'Coverage Broad One Library',
      policyName: 'Coverage Broad One Policy',
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['shared-review-token'] },
      }],
    });
    const broadTwo = await createNativePurposeFixture({
      libraryName: 'Coverage Broad Two Library',
      policyName: 'Coverage Broad Two Policy',
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['shared-review-token'] },
      }],
    });
    const mixedAny = await createNativePurposeFixture({
      libraryName: 'Coverage Mixed Any Library',
      policyName: 'Coverage Mixed Any Policy',
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['shared-review-token', 'unique-mixed-review-token'] },
      }],
    });
    const missing = await createNativePurposeFixture({
      libraryName: 'Coverage Missing Library',
      policyName: 'Coverage Missing Policy',
      purposeRules: [{
        signal_type: 'media_type',
        operator: 'require_any',
        values: { require_any: ['movie'] },
      }],
    });
    const profileOnly = await createNativePurposeFixture({
      libraryName: 'Coverage Profile Only Library',
      policyName: 'Coverage Profile Only Policy',
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['profile-only-review-token'] },
        source: 'media_server_library_profile',
        inference_state: 'inferred',
      }],
    });
    const staleLifecycle = await createNativePurposeFixture({
      libraryName: 'Coverage Stale Lifecycle Library',
      policyName: 'Coverage Stale Lifecycle Policy',
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['stale-lifecycle-token'] },
      }],
    });
    fixtures.push(maintained, broadOne, broadTwo, mixedAny, missing, profileOnly, staleLifecycle);
    await establishInitialIntent(maintained);
    await establishInitialIntent(staleLifecycle);
    await replaceCurrentIntentWithoutLifecycleReceipt({
      policyId: staleLifecycle.policyId,
      intentId: staleLifecycle.intentId,
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['unreceipted-current-token'] },
      }],
    });

    const review = await new PolicyPurposeCoverageReviewService({
      db,
      now: () => '2026-08-16T12:00:00.000Z',
    }).getReview({ limit: 100 });

    const entryByPolicyId = new Map(review.entries.map((entry) => [entry.policy.id, entry]));
    expect(entryByPolicyId.get(maintained.policyId).coverage).toEqual(expect.objectContaining({
      statusId: 'declared_specialized_coverage',
      requiredTermCount: 1,
      uniqueRequiredTermCount: 1,
      sharedRequiredTermCount: 0,
      sharedRequireAnyTermCount: 0,
    }));
    expect(entryByPolicyId.get(broadOne.policyId).coverage).toEqual(expect.objectContaining({
      statusId: 'broad_overlap_review_required',
      requiredTermCount: 1,
      uniqueRequiredTermCount: 0,
      sharedRequiredTermCount: 1,
      overlappingDestinationCount: 2,
      sharedRequireAnyTermCount: 1,
      sharedRequireAnyDestinationCount: 2,
    }));
    expect(entryByPolicyId.get(broadTwo.policyId).coverage).toEqual(expect.objectContaining({
      statusId: 'broad_overlap_review_required',
      requiredTermCount: 1,
      uniqueRequiredTermCount: 0,
      sharedRequiredTermCount: 1,
      overlappingDestinationCount: 2,
      sharedRequireAnyTermCount: 1,
      sharedRequireAnyDestinationCount: 2,
    }));
    expect(entryByPolicyId.get(mixedAny.policyId).coverage).toEqual(expect.objectContaining({
      statusId: 'broad_overlap_review_required',
      requiredTermCount: 2,
      uniqueRequiredTermCount: 1,
      sharedRequiredTermCount: 1,
      sharedRequireAnyTermCount: 1,
      sharedRequireAnyDestinationCount: 2,
    }));
    expect(entryByPolicyId.get(missing.policyId).coverage).toEqual(expect.objectContaining({
      statusId: 'missing_specialized_coverage',
      requiredTermCount: 0,
      overlappingDestinationCount: 0,
    }));
    expect(entryByPolicyId.get(maintained.policyId).provenance).toEqual({
      statusId: 'declared_specialized_purpose_available',
      specializedPurposeRuleCount: 1,
      inferredProfilePurposeRuleCount: 0,
      retainedPurposeRuleCount: 1,
      declaredNativePurposeRuleCount: 1,
      unverifiedPurposeRuleCount: 0,
    });
    expect(entryByPolicyId.get(profileOnly.policyId).provenance).toEqual({
      statusId: 'profile_only_specialized_purpose',
      specializedPurposeRuleCount: 1,
      inferredProfilePurposeRuleCount: 1,
      retainedPurposeRuleCount: 0,
      declaredNativePurposeRuleCount: 0,
      unverifiedPurposeRuleCount: 0,
    });
    expect(entryByPolicyId.get(missing.policyId).provenance).toEqual({
      statusId: 'no_specialized_purpose',
      specializedPurposeRuleCount: 0,
      inferredProfilePurposeRuleCount: 0,
      retainedPurposeRuleCount: 0,
      declaredNativePurposeRuleCount: 0,
      unverifiedPurposeRuleCount: 0,
    });
    expect(review.studySourceReadiness).toEqual(expect.objectContaining({
      statusId: 'retained_declared_purpose_source_available',
      activePolicyCount: expect.any(Number),
      profileOnlyPurposePolicyCount: expect.any(Number),
      retainedPurposePolicyCount: expect.any(Number),
      currentIntentLifecycleReceiptPolicyCount: 1,
      lifecycleRetainedPurposePolicyCount: 1,
      lifecycleReceiptRequiredPolicyCount: 4,
      lifecycleReceiptReviewRequiredPolicyCount: 0,
      heldOutAuditCandidateSourceAvailable: true,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    }));
    expect(review.studySourceReadiness.activePolicyCount).toBeGreaterThanOrEqual(6);
    expect(review.studySourceReadiness.retainedPurposePolicyCount).toBeGreaterThanOrEqual(4);
    expect(review.version).toBe('policy_purpose_coverage_review.v11');
    expect(review.purposeDeclarationWorklist).toEqual(expect.objectContaining({
      version: 'policy_purpose_declaration_worklist.v2',
      rawPurposeRulesExposed: false,
      policyStorageMutated: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    }));
    const worklistEntries = review.purposeDeclarationWorklist.groups
      .flatMap((group) => group.entries);
    expect(worklistEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        policy: expect.objectContaining({ id: profileOnly.policyId }),
        purposeProvenance: {
          id: 'profile_derived',
          declarationRequired: true,
          rawRuleProvenanceExposed: false,
        },
        action: {
          actionId: 'review_and_declare_purpose',
          available: true,
        },
      }),
    ]));
    expect(review.rawConfigurationExposed).toBe(false);
    expect(review.routingAffected).toBe(false);
    expect(JSON.stringify(review)).not.toContain('unique-review-token');
    expect(JSON.stringify(review)).not.toContain('shared-review-token');
    expect(JSON.stringify(review)).not.toContain('unique-mixed-review-token');
    expect(JSON.stringify(review)).not.toContain('profile-only-review-token');
    expect(JSON.stringify(review)).not.toContain('stale-lifecycle-token');
    expect(JSON.stringify(review)).not.toContain('unreceipted-current-token');
  });

  test('recognizes a verified ordinary library rebuild replacement as a current lifecycle receipt', async () => {
    const rebuilt = await createNativePurposeFixture({
      libraryName: 'Coverage Rebuild Lifecycle Library',
      policyName: 'Coverage Rebuild Lifecycle Policy',
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['rebuild-original-purpose-token'] },
      }],
    });
    fixtures.push(rebuilt);
    await establishInitialIntent(rebuilt);
    await replaceCurrentIntentThroughVerifiedLibraryRebuild({
      policyId: rebuilt.policyId,
      libraryId: rebuilt.libraryId,
      intentId: rebuilt.intentId,
      purposeTerm: 'rebuild-current-purpose-token',
    });

    const review = await new PolicyPurposeCoverageReviewService({
      db,
      now: () => '2026-09-08T13:00:00.000Z',
    }).getReview({ limit: 100 });

    expect(review.evidenceInventory).toEqual(expect.objectContaining({
      currentIntentLifecycleReceiptPolicyCount: expect.any(Number),
      completePolicyEvidenceCount: expect.any(Number),
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    }));
    expect(review.evidenceInventory.currentIntentLifecycleReceiptPolicyCount).toBeGreaterThanOrEqual(2);
    expect(review.evidenceInventory.completePolicyEvidenceCount).toBeGreaterThanOrEqual(1);
    expect(review.lifecycleProvenanceReceipt).toEqual(expect.objectContaining({
      version: 'policy_purpose_lifecycle_provenance_receipt.v3',
      summary: expect.objectContaining({
        libraryRebuildReplacementCount: expect.any(Number),
      }),
      rawConfigurationExposed: false,
      semanticCohortReady: false,
      routingAffected: false,
    }));
    expect(review.lifecycleProvenanceReceipt.summary.libraryRebuildReplacementCount)
      .toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(review)).not.toContain('rebuild-original-purpose-token');
    expect(JSON.stringify(review)).not.toContain('rebuild-current-purpose-token');
  });
});
