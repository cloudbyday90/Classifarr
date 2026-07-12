import {
  buildBoundedPolicyEvidenceProjection,
} from '../../services/policyEvidenceBoundary.mjs';
import {
  buildPolicyAutomationReadinessFromBoundedContracts,
  POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS,
} from '../../services/policyAutomationReadinessEngine.mjs';
import {
  buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions,
} from '../../services/policyGuardedOutcomeProjection.mjs';
import {
  buildPolicyIntentDraftFromBoundedEvidence,
} from '../../services/policyIntentEngine.mjs';
import {
  POLICY_DECISION_HANDOFF_SOURCE_IDS,
} from '../../services/policyDecisionHandoffSource.mjs';
import {
  buildPolicyLibraryRebuildReadinessHandoff,
  buildPolicyLibraryRebuildReadinessHandoffAudit,
  POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS,
  POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_READINESS_SUMMARY_VERSION,
} from '../../services/policyLibraryRebuildReadinessHandoff.mjs';

function buildReadyInputs() {
  const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
    evidenceInput: {
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        routingTargets: ['Radarr Animated Movies'],
      },
    },
  });
  const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
    boundedEvidenceResult,
  });
  const guardedOutcomeProjection = buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions({
    requestTimeDecisions: [],
  });

  return {
    boundedEvidenceResult,
    boundedIntentResult,
    guardedOutcomeProjection,
  };
}

describe('policyLibraryRebuildReadinessHandoff', () => {
  test('derives a side-effect-free readiness summary from verified intent and guarded outcomes', () => {
    const {
      boundedEvidenceResult,
      boundedIntentResult,
      guardedOutcomeProjection,
    } = buildReadyInputs();

    const handoff = buildPolicyLibraryRebuildReadinessHandoff({
      boundedIntentResult,
      guardedOutcomeProjection,
    });

    expect(handoff).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS.READY,
      decisionSource: expect.objectContaining({
        sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.LIBRARY_REBUILD,
        decisionVersion: POLICY_LIBRARY_REBUILD_READINESS_SUMMARY_VERSION,
      }),
      intentBoundary: expect.objectContaining({
        statusId: 'ready',
        evidenceBoundary: expect.objectContaining({
          projectionFingerprint: expect.objectContaining({
            fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
          }),
        }),
      }),
      decision: expect.objectContaining({
        version: POLICY_LIBRARY_REBUILD_READINESS_SUMMARY_VERSION,
        learning: expect.objectContaining({
          decisionId: 'outcome_only',
          writesPerformed: false,
        }),
      }),
      sideEffects: {
        learningWritten: false,
        routingWritten: false,
        policyStorageMutated: false,
      },
      learningAudit: expect.objectContaining({ ok: true }),
    }));
    expect(handoff.intentBoundary.evidenceBoundary.projectionFingerprint.fingerprint)
      .toBe(handoff.intentBoundary.intentEvidenceBoundary.projectionFingerprint.fingerprint);
    expect(JSON.stringify(handoff)).not.toContain('Animated Movies');
    expect(buildPolicyLibraryRebuildReadinessHandoffAudit(handoff)).toEqual({
      version: expect.any(String),
      ok: true,
      issueCount: 0,
      issues: [],
    });

    const readiness = buildPolicyAutomationReadinessFromBoundedContracts({
      boundedEvidenceResult,
      boundedIntentResult,
      boundedLearningResult: handoff,
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr Animated Movies',
      },
    });

    expect(readiness).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_AUTOMATION_READINESS_BOUNDARY_STATUS_IDS.READY,
      readiness: expect.objectContaining({ stateId: 'ready' }),
    }));
  });

  test('blocks a bounded intent whose emitted intent fingerprint differs from its wrapper', () => {
    const { boundedIntentResult, guardedOutcomeProjection } = buildReadyInputs();
    const mismatchedIntentResult = {
      ...boundedIntentResult,
      intent: {
        ...boundedIntentResult.intent,
        evidenceBoundary: {
          ...boundedIntentResult.intent.evidenceBoundary,
          projectionFingerprint: {
            ...boundedIntentResult.intent.evidenceBoundary.projectionFingerprint,
            fingerprint: 'f'.repeat(64),
          },
        },
      },
    };

    const handoff = buildPolicyLibraryRebuildReadinessHandoff({
      boundedIntentResult: mismatchedIntentResult,
      guardedOutcomeProjection,
    });

    expect(handoff).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY,
      decision: null,
      nextStep: null,
    }));
    expect(handoff.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INTENT_FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('rejects invalid guarded outcome projections and later side-effect mutation', () => {
    const { boundedIntentResult, guardedOutcomeProjection } = buildReadyInputs();
    const invalid = buildPolicyLibraryRebuildReadinessHandoff({
      boundedIntentResult,
      guardedOutcomeProjection: {},
    });

    expect(invalid.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_GUARDED_OUTCOME_PROJECTION,
      }),
    ]));

    const blockedWithDecision = {
      ...invalid,
      decision: {
        version: POLICY_LIBRARY_REBUILD_READINESS_SUMMARY_VERSION,
        learning: {
          decisionId: 'outcome_only',
          writesPerformed: false,
        },
        profileRefresh: {
          queue: false,
        },
      },
      nextStep: {
        stepId: 'automation_readiness',
      },
    };

    expect(buildPolicyLibraryRebuildReadinessHandoffAudit(blockedWithDecision).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
        }),
      ]));

    const blockedWithReadyStatus = {
      ...invalid,
      statusId: POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_STATUS_IDS.READY,
    };

    expect(buildPolicyLibraryRebuildReadinessHandoffAudit(blockedWithReadyStatus).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
        }),
      ]));

    const handoff = buildPolicyLibraryRebuildReadinessHandoff({
      boundedIntentResult,
      guardedOutcomeProjection,
    });
    handoff.sideEffects.learningWritten = true;

    expect(buildPolicyLibraryRebuildReadinessHandoffAudit(handoff).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.UNSAFE_SIDE_EFFECT,
        }),
      ]));

    handoff.sideEffects.routingWritten = undefined;

    expect(buildPolicyLibraryRebuildReadinessHandoffAudit(handoff).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_LIBRARY_REBUILD_READINESS_HANDOFF_RISK_IDS.INVALID_READINESS_SUMMARY,
        }),
      ]));
  });
});
