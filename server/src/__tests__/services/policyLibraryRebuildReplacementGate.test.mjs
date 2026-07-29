/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

import {
  buildPolicyLibraryRebuildAcceptanceTransition,
} from '../../services/policyLibraryRebuildAcceptanceTransition.mjs';
import {
  buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput,
} from '../../services/policyLibraryPolicyRebuild.mjs';
import {
  POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS,
  POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS,
  applyPolicyLibraryRebuildReplacement,
  buildPolicyLibraryRebuildReplacementGateAudit,
} from '../../services/policyLibraryRebuildReplacementGate.mjs';
import {
  buildPolicyRollbackSnapshotWindow,
} from '../../services/policyRollbackSnapshotWindow.mjs';

const NOW = '2026-07-12T12:00:00.000Z';

function profileHandoff() {
  return {
    version: 'policy.library_profile_evidence_loader.v1',
    ok: true,
    statusId: 'ready',
    libraryId: 6,
    profileEvidence: {
      version: 'policy.library_profile_evidence.v1',
      libraryProfile: {
        identityCandidates: [],
        compatibilityCandidates: [{
          key: 'genre:animation',
          label: 'Animation',
          value: '80%',
          count: 8,
          confidence: 0.8,
          reasonCode: 'observed_library_distribution',
        }],
        outliers: [],
      },
      sideEffects: {
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
      },
    },
    profileEvidenceAudit: { ok: true },
    profileFreshness: {
      stale: false,
      updatedAt: NOW,
      reasonCode: 'current_profile_timestamp',
    },
    evidenceBoundary: { ok: true },
    evidenceBoundaryAudit: { ok: true },
    sideEffects: {
      libraryProfileRead: true,
      liveMediaServerLookupPerformed: false,
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      evidenceProjectionBuilt: true,
      policyStorageMutated: false,
    },
  };
}

function rebuildProposal(overrides = {}) {
  return buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput({
    library: {
      libraryId: 6,
      libraryName: 'Animated Movies',
      mediaType: 'movie',
    },
    profileHandoff: profileHandoff(),
    operatorIntent: {
      belongsHere: [{
        key: 'studio:disney',
        label: 'Disney',
        count: 7,
      }],
    },
    routingConfiguration: {
      configured: true,
      routeReady: true,
      targetName: 'Animated Movies',
      arrRootFolderPath: '/media/Plexmedia/Animated Movies',
    },
    ...overrides,
  });
}

function buildFixture() {
  const proposal = rebuildProposal();
  const transition = buildPolicyLibraryRebuildAcceptanceTransition({
    proposal,
    policyContext: {
      policyId: 44,
      intentId: 101,
      libraryId: 6,
    },
    rollbackWindowPlan: buildPolicyRollbackSnapshotWindow({
      policy: {
        id: 44,
        intent_id: 101,
        library_id: 6,
        customSignals: {
          genres: { require_any: ['Animation'] },
        },
      },
      action: {
        actorSourceId: 'manual_operator',
        actorId: 'admin:1',
        reasonCode: 'library_rebuild',
        reason: 'Operator accepted a library rebuild proposal.',
      },
      now: NOW,
    }),
    operatorDecision: {
      actorId: 'admin:1',
      actorSourceId: 'manual_operator',
      decisionId: 'accept_rebuild',
    },
    now: NOW,
  });
  return { proposal, transition };
}

function execution(transition, overrides = {}) {
  return {
    id: 801,
    policy_id: 44,
    intent_id: 101,
    library_id: 6,
    state: 'snapshot_persisted',
    idempotency_key: transition.replayProtection.idempotencyKey,
    transition_fingerprint: transition.transitionFingerprint.fingerprint,
    proposal_fingerprint: transition.proposalFingerprint.fingerprint,
    rollback_plan_fingerprint: transition.rollbackPlanFingerprint.fingerprint,
    verification_run_id: 701,
    verification_run_fingerprint: 'b'.repeat(64),
    acceptance_expires_at: '2026-07-12T12:30:00.000Z',
    rollback_snapshot_id: 901,
    migration_event_id: 951,
    replacement_intent_id: null,
    replacement_event_id: null,
    replacement_applied_at: null,
    ...overrides,
  };
}

function verificationReceipt(gate, overrides = {}) {
  return {
    id: 701,
    run_version: 1,
    policy_id: gate.policy_id,
    intent_id: gate.intent_id,
    library_id: gate.library_id,
    acceptance_transition_fingerprint: gate.transition_fingerprint,
    source_id: 'persisted_destination_library_final_outcomes',
    source_media_type: 'movie',
    source_deterministic_order_id: 'created_at_desc_id_desc',
    source_maximum_classifications: 5,
    source_rows_read: 5,
    source_rows_considered: 5,
    source_representative_classification_count: 5,
    source_unusable_source_row_count: 0,
    source_coverage_sufficient: true,
    source_audit_ok: true,
    source_audit_issue_count: 0,
    verifier_status_id: 'no_migration_differences',
    verifier_fingerprint: 'b'.repeat(64),
    verifier_difference_count: 0,
    verifier_emitted_difference_count: 0,
    verifier_differences_truncated: false,
    verifier_audit_ok: true,
    verifier_audit_issue_count: 0,
    coordinator_audit_ok: true,
    coordinator_audit_issue_count: 0,
    evaluated_at: '2026-07-12T12:01:00.000Z',
    created_at: '2026-07-12T12:01:00.000Z',
    ...overrides,
  };
}

function createClient({
  gate,
  verificationRun = gate ? verificationReceipt(gate) : null,
  failRules = false,
} = {}) {
  return {
    query: jest.fn(async sql => {
      const statement = String(sql);

      if (statement.includes('FROM library_policies')) {
        return {
          rows: [{
            id: 44,
            library_id: 6,
            name: 'Animated Movies Policy',
          }],
          rowCount: 1,
        };
      }

      if (statement.includes('FROM policy_library_rebuild_execution_gates')) {
        return { rows: gate ? [gate] : [], rowCount: gate ? 1 : 0 };
      }

      if (statement.includes('FROM policy_migration_verification_runs')) {
        return { rows: verificationRun ? [verificationRun] : [], rowCount: verificationRun ? 1 : 0 };
      }

      if (statement.includes('FROM policy_intents')) {
        return {
          rows: [{
            id: 101,
            policy_id: 44,
            library_id: 6,
            intent_version: 1,
            active: true,
            review_behavior: { auto_classify_threshold: 85 },
          }],
          rowCount: 1,
        };
      }

      if (statement.includes('FROM policy_intent_rollback_snapshots')) {
        return {
          rows: [{
            id: 901,
            policy_id: 44,
            intent_id: 101,
            snapshot_version: 1,
            expires_at: '2026-07-26T12:00:00.000Z',
            restored_at: null,
          }],
          rowCount: 1,
        };
      }

      if (statement.includes('FROM library_arr_mappings')) {
        return {
          rows: [{
            arr_type: 'radarr',
            arr_config_id: 1,
            arr_root_folder_id: 9,
            arr_root_folder_path: '/media/Plexmedia/Animated Movies',
            quality_profile_id: 3,
          }],
          rowCount: 1,
        };
      }

      if (statement.includes('INSERT INTO policy_intents')) {
        return { rows: [{ id: 202, intent_version: 2 }], rowCount: 1 };
      }

      if (failRules && statement.includes('INSERT INTO policy_intent_rules')) {
        throw new Error('rules insert failed');
      }

      if (statement.includes('INSERT INTO policy_intent_migration_events')) {
        return { rows: [{ id: 303 }], rowCount: 1 };
      }

      if (statement.includes('UPDATE policy_library_rebuild_execution_gates') &&
          statement.includes('RETURNING id')) {
        return { rows: [{ id: 801 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 1 };
    }),
  };
}

describe('policyLibraryRebuildReplacementGate', () => {
  test('audits the replacement-gate contract with replacement authority closed', () => {
    const audit = buildPolicyLibraryRebuildReplacementGateAudit();

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      replacementApplied: true,
      canApplyReplacement: false,
      nextStep: expect.objectContaining({
        stepId: 'strict_constraint_descriptors',
      }),
    }));
  });

  test('replaces a locked native intent from persisted rollback evidence in one transaction', async () => {
    const { proposal, transition } = buildFixture();
    const client = createClient({ gate: execution(transition) });
    const dbClient = { withTransaction: jest.fn(async work => work(client)) };

    const result = await applyPolicyLibraryRebuildReplacement({
      dbClient,
      transition,
      proposal,
      now: NOW,
    });

    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(result.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.REPLACEMENT_APPLIED);
    expect(result.validation.ok).toBe(true);
    expect(result.execution).toEqual(expect.objectContaining({
      gateId: 801,
      originalIntentId: 101,
      replacementIntentId: 202,
      replacementEventId: 303,
      rollbackSnapshotId: 901,
      verificationRunId: 701,
      verificationRunFingerprint: 'b'.repeat(64),
      verificationRunStatusId: 'no_migration_differences',
      idempotent: false,
    }));
    expect(result.sideEffects).toEqual(expect.objectContaining({
      nativeIntentCreated: true,
      nativeRulesWritten: true,
      routingWritten: true,
      validationWritten: true,
      migrationEventWritten: true,
      policyReplaced: true,
      legacyPathsDeleted: false,
    }));
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_rules'),
      expect.arrayContaining([202, 'purpose', 'purpose', 'studios'])
    );

    const eventCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO policy_intent_migration_events')
    );
    expect(eventCall[1][6]).not.toContain('admin:1');
    expect(JSON.parse(eventCall[1][6])).toEqual(expect.objectContaining({
      verificationRunId: 701,
      verificationRunFingerprint: 'b'.repeat(64),
      verificationRunStatusId: 'no_migration_differences',
    }));
    expect(JSON.parse(eventCall[1][6])).not.toHaveProperty('sampleSetFingerprint');
  });

  test('returns an existing terminal replacement without writing a second intent', async () => {
    const { proposal, transition } = buildFixture();
    const client = createClient({
      gate: execution(transition, {
        state: 'replacement_applied',
        replacement_intent_id: 202,
        replacement_event_id: 303,
        replacement_applied_at: NOW,
      }),
    });

    const result = await applyPolicyLibraryRebuildReplacement({
      dbClient: { withTransaction: async work => work(client) },
      transition,
      proposal,
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.ALREADY_APPLIED);
    expect(result.execution.idempotent).toBe(true);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intents'),
      expect.anything()
    );
  });

  test('returns the terminal replacement safely after the original acceptance expires', async () => {
    const { proposal, transition } = buildFixture();
    const client = createClient({
      gate: execution(transition, {
        state: 'replacement_applied',
        replacement_intent_id: 202,
        replacement_event_id: 303,
        replacement_applied_at: NOW,
      }),
    });

    const result = await applyPolicyLibraryRebuildReplacement({
      dbClient: { withTransaction: async work => work(client) },
      transition,
      proposal,
      now: '2026-07-12T12:31:00.000Z',
    });

    expect(result.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.ALREADY_APPLIED);
    expect(result.execution.idempotent).toBe(true);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intents'),
      expect.anything()
    );
  });

  test('requires a transaction before replacement can write state', async () => {
    const { proposal, transition } = buildFixture();

    const result = await applyPolicyLibraryRebuildReplacement({
      transition,
      proposal,
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY);
    expect(result.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.TRANSACTION_BOUNDARY_REQUIRED,
      }),
    ]));
  });

  test('ignores a caller-supplied verifier report and uses the persisted receipt instead', async () => {
    const { proposal, transition } = buildFixture();
    const gate = execution(transition);
    const client = createClient({ gate });
    const dbClient = { withTransaction: jest.fn(async work => work(client)) };

    const result = await applyPolicyLibraryRebuildReplacement({
      dbClient,
      transition,
      proposal,
      verifierReport: {
        statusId: 'blocked_by_migration_risk',
        differences: [{ itemId: 7 }],
      },
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.REPLACEMENT_APPLIED);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM policy_migration_verification_runs'),
      [701],
    );
  });

  test.each([
    [
      'missing receipt reference',
      ({ transition }) => execution(transition, {
        verification_run_id: null,
        verification_run_fingerprint: null,
      }),
      () => null,
      POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.VERIFICATION_RUN_EXECUTION_BINDING_MISSING,
    ],
    [
      'mismatched receipt fingerprint',
      ({ transition }) => execution(transition, {
        verification_run_fingerprint: 'c'.repeat(64),
      }),
      gate => verificationReceipt(gate),
      POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.VERIFICATION_RUN_EXECUTION_BINDING_MISMATCH,
    ],
    [
      'review-required receipt',
      ({ transition }) => execution(transition),
      gate => verificationReceipt(gate, { verifier_status_id: 'review_required' }),
      POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.VERIFICATION_RUN_REVIEW_REQUIRED,
    ],
  ])('blocks %s before native-intent, routing, or migration-event writes', async (
    _name,
    buildGate,
    buildVerificationRun,
    riskId,
  ) => {
    const { proposal, transition } = buildFixture();
    const gate = buildGate({ transition });
    const client = createClient({
      gate,
      verificationRun: buildVerificationRun(gate),
    });

    const result = await applyPolicyLibraryRebuildReplacement({
      dbClient: { withTransaction: async work => work(client) },
      transition,
      proposal,
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_VERIFICATION_RUN);
    expect(result.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId }),
    ]));
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intents'),
      expect.anything(),
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_routing_targets'),
      expect.anything(),
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_migration_events'),
      expect.anything(),
    );
  });

  test('blocks an expired persisted execution without creating native rows', async () => {
    const { proposal, transition } = buildFixture();
    const client = createClient({
      gate: execution(transition, { state: 'acceptance_expired' }),
    });

    const result = await applyPolicyLibraryRebuildReplacement({
      dbClient: { withTransaction: async work => work(client) },
      transition,
      proposal,
      now: '2026-07-12T12:31:00.000Z',
    });

    expect(result.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE);
    expect(result.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.EXECUTION_GATE_NOT_SNAPSHOT_PERSISTED,
      }),
    ]));
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intents'),
      expect.anything()
    );
  });

  test('reports a rollback-safe failure when native rule persistence fails', async () => {
    const { proposal, transition } = buildFixture();
    const client = createClient({ gate: execution(transition), failRules: true });

    const result = await applyPolicyLibraryRebuildReplacement({
      dbClient: { withTransaction: async work => work(client) },
      transition,
      proposal,
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.FAILED_ROLLED_BACK);
    expect(result.sideEffects).toEqual(expect.objectContaining({
      nativeIntentCreated: false,
      policyReplaced: false,
      legacyPathsDeleted: false,
    }));
  });
});
