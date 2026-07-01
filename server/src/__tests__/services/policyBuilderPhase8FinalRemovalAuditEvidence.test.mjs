import {
  PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyBuilderPhase8CompatibilityPathDeletionExecutionPlan.mjs';
import {
  PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyBuilderPhase8CompatibilityRemovalCompletionAudit.mjs';
import {
  buildManifestPathState,
  buildPolicyBuilderPhase8FinalRemovalAuditEvidence,
} from '../../services/policyBuilderPhase8FinalRemovalAuditEvidence.mjs';

const MANIFEST_PATHS = Object.freeze([
  'server/src/services/legacyA.mjs',
  'client/src/components/LegacyB.vue',
]);

function executionPlan(overrides = {}) {
  return {
    statusId:
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    manifest: {
      approved: true,
      entryCount: MANIFEST_PATHS.length,
      entries: MANIFEST_PATHS.map(path => ({
        categoryId: 'old_preview_replay_diagnostics',
        actionId: 'delete_file',
        path,
        replacementEvidence: {
          replacementPath: 'server/src/services/nativeIntent.mjs',
        },
        ready: true,
      })),
    },
    ...overrides,
  };
}

function validationEvidence(overrides = {}) {
  return {
    focused: {
      command: 'focused phase8r checks',
      passed: true,
    },
    full: {
      command: 'npm --prefix server test',
      passed: true,
    },
    ...overrides,
  };
}

describe('policyBuilderPhase8FinalRemovalAuditEvidence', () => {
  test('summarizes manifest path state from the current checkout', () => {
    const state = buildManifestPathState({
      executionPlan: executionPlan(),
      fileExists: path => path.endsWith('legacyA.mjs'),
    });

    expect(state).toEqual({
      totalCount: 2,
      existingCount: 1,
      removedCount: 1,
      manifestPaths: MANIFEST_PATHS,
      existingPaths: [MANIFEST_PATHS[0]],
      removedPaths: [MANIFEST_PATHS[1]],
    });
  });

  test('reports remaining inventory when approved manifest paths still exist', () => {
    const evidence = buildPolicyBuilderPhase8FinalRemovalAuditEvidence({
      executionPlan: executionPlan(),
      validationEvidence: validationEvidence(),
      fileExists: () => true,
      referenceScan: {
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [],
      },
    });

    expect(evidence.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .REMAINING_INVENTORY);
    expect(evidence.complete).toBe(false);
    expect(evidence.pathState).toEqual(expect.objectContaining({
      existingCount: 2,
      removedCount: 0,
    }));
    expect(evidence.audit.manifestInventory.remainingPaths).toEqual(MANIFEST_PATHS);
  });

  test('completes when manifest paths are removed, scanned, and validated', () => {
    const evidence = buildPolicyBuilderPhase8FinalRemovalAuditEvidence({
      executionPlan: executionPlan(),
      validationEvidence: validationEvidence(),
      fileExists: () => false,
      referenceScan: {
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [],
      },
    });

    expect(evidence.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE);
    expect(evidence.complete).toBe(true);
    expect(evidence.pathState).toEqual(expect.objectContaining({
      existingCount: 0,
      removedCount: 2,
    }));
    expect(evidence.audit.validation.ok).toBe(true);
  });

  test('blocks completion when final scan still reports references', () => {
    const evidence = buildPolicyBuilderPhase8FinalRemovalAuditEvidence({
      executionPlan: executionPlan(),
      validationEvidence: validationEvidence(),
      fileExists: () => false,
      referenceScan: {
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [{
          path: MANIFEST_PATHS[0],
          referencedBy: 'server/src/routes/example.mjs',
          line: 12,
        }],
      },
    });

    expect(evidence.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_FINAL_SCAN);
    expect(evidence.audit.finalImportScan.referenceCount).toBe(1);
  });

  test('blocks completion when validation evidence is missing', () => {
    const evidence = buildPolicyBuilderPhase8FinalRemovalAuditEvidence({
      executionPlan: executionPlan(),
      fileExists: () => false,
      referenceScan: {
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [],
      },
    });

    expect(evidence.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_VALIDATION);
    expect(evidence.audit.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      'focused_validation_missing',
      'full_validation_missing',
    ]));
  });
});
