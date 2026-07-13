import { jest } from '@jest/globals';

import {
  POLICY_CONVERSION_ACTOR_SOURCE_IDS,
} from '../../services/policyConversionActorSources.mjs';
import {
  buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput,
} from '../../services/policyLibraryPolicyRebuild.mjs';
import {
  buildPolicyLibraryRebuildAcceptanceTransition,
} from '../../services/policyLibraryRebuildAcceptanceTransition.mjs';
import {
  POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS,
  POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS,
  buildPolicyLibraryRebuildSnapshotGateAudit,
  persistPolicyLibraryRebuildRollbackSnapshot,
} from '../../services/policyLibraryRebuildSnapshotGate.mjs';
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

function proposal() {
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
  });
}

function policyContext() {
  return {
    policyId: 44,
    intentId: 101,
    libraryId: 6,
  };
}

function rollbackWindowPlan() {
  return buildPolicyRollbackSnapshotWindow({
    policy: {
      id: 44,
      intent_id: 101,
      library_id: 6,
      customSignals: {
        genres: {
          require_any: ['Animation'],
        },
      },
    },
    action: {
      actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
      actorId: 'admin:1',
      reasonCode: 'library_rebuild',
      reason: 'Operator accepted a library rebuild proposal.',
    },
    now: NOW,
  });
}

function acceptedTransition() {
  const rebuildProposal = proposal();
  return {
    rebuildProposal,
    transition: buildPolicyLibraryRebuildAcceptanceTransition({
      proposal: rebuildProposal,
      policyContext: policyContext(),
      rollbackWindowPlan: rollbackWindowPlan(),
      operatorDecision: {
        actorId: 'admin:1',
        actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
        decisionId: 'accept_rebuild',
      },
      now: NOW,
    }),
  };
}

function existingExecution(overrides = {}) {
  return {
    id: '801',
    policy_id: 44,
    intent_id: 101,
    library_id: 6,
    state: 'snapshot_persisted',
    transition_fingerprint: 'a'.repeat(64),
    proposal_fingerprint: 'b'.repeat(64),
    rollback_plan_fingerprint: 'c'.repeat(64),
    acceptance_expires_at: '2026-07-12T12:30:00.000Z',
    rollback_snapshot_id: '901',
    migration_event_id: '951',
    ...overrides,
  };
}

function createClient({
  existing = null,
  active = null,
  intentPresent = true,
  failSnapshotInsert = false,
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
            auto_classify_threshold: 85,
            prompt_threshold: 60,
            require_ai_validation: true,
            trust_patterns: true,
            trust_rag: true,
            trust_history: true,
            preset_weight: 0.25,
            profile_weight: 0.25,
            pattern_weight: 0.25,
            rag_weight: 0.25,
            history_weight: 0,
            combination_mode: 'best_match',
          }],
        };
      }

      if (statement.includes('FROM policy_intents')) {
        return {
          rows: intentPresent
            ? [{ id: 101, policy_id: 44, library_id: 6, intent_version: 1, active: true }]
            : [],
        };
      }

      if (statement.includes('WHERE idempotency_key = $1')) {
        return { rows: existing ? [existing] : [] };
      }

      if (statement.includes('state IN ($2, $3)')) {
        return { rows: active ? [active] : [] };
      }

      if (statement.includes('FROM policy_presets')) {
        return {
          rows: [{
            preset_id: 7,
            preset_key: 'family',
            preset_name: 'Family',
            weight: 1,
            custom_signals: { genres: { require_any: ['Animation'] } },
            sort_order: 0,
          }],
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
        };
      }

      if (statement.includes('INSERT INTO policy_library_rebuild_execution_gates')) {
        return { rows: [{ id: 801 }], rowCount: 1 };
      }

      if (statement.includes('INSERT INTO policy_intent_rollback_snapshots')) {
        if (failSnapshotInsert) {
          throw new Error('snapshot insert failed');
        }
        return { rows: [{ id: 901 }], rowCount: 1 };
      }

      if (statement.includes('INSERT INTO policy_intent_migration_events')) {
        return { rows: [{ id: 951 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 1 };
    }),
  };
}

describe('policyLibraryRebuildSnapshotGate', () => {
  test('audits the snapshot-gate contract without opening a transaction', () => {
    const audit = buildPolicyLibraryRebuildSnapshotGateAudit();

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      canApplyReplacement: false,
      persistedRollbackSnapshotPresent: true,
      nextStep: expect.objectContaining({
        stepId: 'library_rebuild_replacement_gate',
      }),
    }));
  });

  test('persists an accepted rebuild rollback snapshot and replay state atomically', async () => {
    const { rebuildProposal, transition } = acceptedTransition();
    const client = createClient();
    const dbClient = {
      withTransaction: jest.fn(async work => work(client)),
    };

    const result = await persistPolicyLibraryRebuildRollbackSnapshot({
      dbClient,
      transition,
      proposal: rebuildProposal,
      now: NOW,
    });

    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(result.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ROLLBACK_SNAPSHOT_PERSISTED);
    expect(result.validation.ok).toBe(true);
    expect(result.execution).toEqual(expect.objectContaining({
      gateId: 801,
      policyId: 44,
      intentId: 101,
      libraryId: 6,
      stateId: 'snapshot_persisted',
      rollbackSnapshotId: 901,
      migrationEventId: 951,
      idempotent: false,
    }));
    expect(result.application).toEqual({
      canEnterMigrationVerification: true,
      canApplyReplacement: false,
      persistedRollbackSnapshotPresent: true,
      replacementBlockedReason: 'migration_verification_required',
    });
    expect(result.sideEffects).toEqual(expect.objectContaining({
      acceptancePersisted: true,
      rollbackSnapshotCreated: true,
      migrationEventWritten: true,
      policyReplaced: false,
    }));

    const gateCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO policy_library_rebuild_execution_gates')
    );
    const snapshotCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO policy_intent_rollback_snapshots')
    );
    const eventCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO policy_intent_migration_events')
    );

    expect(gateCall).toBeDefined();
    expect(snapshotCall).toBeDefined();
    expect(eventCall).toBeDefined();
    expect(client.query.mock.invocationCallOrder[
      client.query.mock.calls.indexOf(gateCall)
    ]).toBeLessThan(client.query.mock.invocationCallOrder[
      client.query.mock.calls.indexOf(snapshotCall)
    ]);
    expect(snapshotCall[1][3]).toContain('custom_signals');
    expect(snapshotCall[1][3]).not.toContain('admin:1');
    expect(eventCall[1][5]).not.toContain('admin:1');
    expect(JSON.stringify(result)).not.toContain('admin:1');
  });

  test('returns the existing persisted execution without creating a second snapshot', async () => {
    const { rebuildProposal, transition } = acceptedTransition();
    const client = createClient({
      existing: existingExecution({
        transition_fingerprint: transition.transitionFingerprint.fingerprint,
        proposal_fingerprint: transition.proposalFingerprint.fingerprint,
        rollback_plan_fingerprint: transition.rollbackPlanFingerprint.fingerprint,
      }),
    });
    const dbClient = {
      withTransaction: jest.fn(async work => work(client)),
    };

    const result = await persistPolicyLibraryRebuildRollbackSnapshot({
      dbClient,
      transition,
      proposal: rebuildProposal,
      now: NOW,
    });

    expect(result.statusId).toBe(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ALREADY_PERSISTED);
    expect(result.execution.idempotent).toBe(true);
    expect(result.sideEffects).toEqual(expect.objectContaining({
      acceptancePersisted: false,
      rollbackSnapshotCreated: false,
      migrationEventWritten: false,
    }));
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_rollback_snapshots'),
      expect.anything()
    );
  });

  test('rejects an expired acceptance before a transaction can persist state', async () => {
    const { rebuildProposal, transition } = acceptedTransition();
    const dbClient = {
      withTransaction: jest.fn(),
    };

    const result = await persistPolicyLibraryRebuildRollbackSnapshot({
      dbClient,
      transition,
      proposal: rebuildProposal,
      now: '2026-07-12T12:31:00.000Z',
    });

    expect(result.statusId).toBe(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_TRANSITION);
    expect(result.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.INVALID_TRANSITION,
      }),
    ]));
    expect(dbClient.withTransaction).not.toHaveBeenCalled();
  });

  test('requires a transaction boundary and a current active native intent', async () => {
    const { rebuildProposal, transition } = acceptedTransition();
    const noTransaction = await persistPolicyLibraryRebuildRollbackSnapshot({
      transition,
      proposal: rebuildProposal,
      now: NOW,
    });

    expect(noTransaction.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY);

    const client = createClient({ intentPresent: false });
    const currentState = await persistPolicyLibraryRebuildRollbackSnapshot({
      dbClient: {
        withTransaction: async work => work(client),
      },
      transition,
      proposal: rebuildProposal,
      now: NOW,
    });

    expect(currentState.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE);
    expect(currentState.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.INTENT_CONTEXT_NOT_CURRENT,
      }),
    ]));
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_library_rebuild_execution_gates'),
      expect.anything()
    );
  });

  test('blocks a second active accepted rebuild for the same policy without writing another snapshot', async () => {
    const { rebuildProposal, transition } = acceptedTransition();
    const client = createClient({ active: existingExecution() });

    const result = await persistPolicyLibraryRebuildRollbackSnapshot({
      dbClient: {
        withTransaction: async work => work(client),
      },
      transition,
      proposal: rebuildProposal,
      now: NOW,
    });

    expect(result.statusId)
      .toBe(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE);
    expect(result.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.ACTIVE_EXECUTION_EXISTS,
      }),
    ]));
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_rollback_snapshots'),
      expect.anything()
    );
  });

  test('reports a rollback-safe failure when an insert fails inside the transaction', async () => {
    const { rebuildProposal, transition } = acceptedTransition();
    const client = createClient({ failSnapshotInsert: true });

    const result = await persistPolicyLibraryRebuildRollbackSnapshot({
      dbClient: {
        withTransaction: async work => work(client),
      },
      transition,
      proposal: rebuildProposal,
      now: NOW,
    });

    expect(result.statusId).toBe(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.FAILED_ROLLED_BACK);
    expect(result.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.TRANSACTION_FAILED,
      }),
    ]));
    expect(result.sideEffects).toEqual(expect.objectContaining({
      rollbackSnapshotCreated: false,
      migrationEventWritten: false,
      policyReplaced: false,
    }));
  });
});
