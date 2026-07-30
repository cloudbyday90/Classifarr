import {
  POLICY_AUTOMATION_DECISION_ACTION_IDS,
  POLICY_AUTOMATION_DECISION_STATE_IDS,
} from '../../services/policyAutomationDecisionContract.mjs';
import {
  POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS,
  POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS,
  buildPolicyRuntimeQueueAutomationDecision,
  buildPolicyRuntimeQueueAutomationDecisionAudit,
} from '../../services/policyRuntimeQueueAutomationDecision.mjs';
import {
  buildPolicyRuntimeQueueEvidenceAdmission,
} from '../../services/policyRuntimeQueueEvidenceAdmission.mjs';

function buildEvidenceAdmission(overrides = {}) {
  return buildPolicyRuntimeQueueEvidenceAdmission({
    task: {
      id: 'queue-task-automation-42',
      task_type: 'classification',
      attempts: 2,
      payload: {
        title: 'Raw queue title must not reach the decision contract',
        providerPayload: { token: 'must-not-leak' },
      },
    },
    runtimeEvidenceInput: {
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 8, confidence: 0.9, trusted: true },
        ],
      },
      operatorIntent: {
        belongsHere: [{ key: 'genre:animated', label: 'Animated Movies' }],
        routingTargets: ['Radarr Animated Movies'],
      },
      routingOutcomes: [{ label: 'Radarr route mapped', routed: true }],
      profileFreshness: {
        key: 'profile',
        label: 'Profile is current',
        updatedAt: '2026-07-30T00:00:00.000Z',
        stale: false,
      },
      ...overrides,
    },
  });
}

describe('policyRuntimeQueueAutomationDecision', () => {
  test('creates a side-effect-free auto-route decision bound to fresh queue evidence', () => {
    const evidenceAdmission = buildEvidenceAdmission();
    const result = buildPolicyRuntimeQueueAutomationDecision({
      evidenceAdmission,
      routing: { mapped: true, targetName: 'Radarr Animated Movies' },
      classification: { status: 'completed' },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS.READY,
      queueEvidence: expect.objectContaining({
        taskType: 'classification',
        attempt: 2,
        taskFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        evidenceFingerprint: evidenceAdmission.evidence.fingerprint,
        executionFingerprint: evidenceAdmission.evidence.executionFingerprint,
      }),
      decision: expect.objectContaining({
        stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
        actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR,
      }),
    }));
    expect(result.audit.ok).toBe(true);
    expect(result.sideEffects).toEqual({
      providerCalled: false,
      queueMutated: false,
      classificationExecuted: false,
      routingExecuted: false,
      questionCreated: false,
      learningWritten: false,
    });
    expect(JSON.stringify(result)).not.toContain('queue-task-automation-42');
    expect(JSON.stringify(result)).not.toContain('Raw queue title must not reach the decision contract');
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  test('preserves classified-not-routed instead of claiming routing success', () => {
    const result = buildPolicyRuntimeQueueAutomationDecision({
      evidenceAdmission: buildEvidenceAdmission({
        routingOutcomes: [],
      }),
      routing: { mapped: false, targetName: 'Radarr Animated Movies' },
      classification: { status: 'completed' },
    });

    expect(result.decision).toEqual(expect.objectContaining({
      stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED,
      actionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.RECORD_CLASSIFICATION_ONLY,
      routeAllowed: false,
      classificationAllowed: true,
    }));
    expect(result.audit.ok).toBe(true);
  });

  test('fails closed when the evidence admission is blocked or its execution proof is altered', () => {
    const blockedAdmission = buildEvidenceAdmission({
      evidenceProjection: { fingerprint: 'cached' },
    });
    const alteredAdmission = buildEvidenceAdmission();
    alteredAdmission.evidence.executionFingerprint = 'a'.repeat(64);

    const blocked = buildPolicyRuntimeQueueAutomationDecision({
      evidenceAdmission: blockedAdmission,
    });
    const altered = buildPolicyRuntimeQueueAutomationDecision({
      evidenceAdmission: alteredAdmission,
    });

    [blocked, altered].forEach(result => {
      expect(result).toEqual(expect.objectContaining({
        ok: false,
        statusId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS
          .BLOCKED_INVALID_EVIDENCE_ADMISSION,
        reasonCode: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS
          .INVALID_EVIDENCE_ADMISSION,
        queueEvidence: null,
        decision: null,
      }));
      expect(result.audit.ok).toBe(true);
    });
  });

  test('rejects unsupported input instead of admitting raw runtime evidence or side-effect claims', () => {
    const result = buildPolicyRuntimeQueueAutomationDecision({
      evidenceAdmission: buildEvidenceAdmission(),
      libraryProfile: { identityCandidates: [{ label: 'raw evidence' }] },
      sideEffects: { routingExecuted: true },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS.BLOCKED_UNSUPPORTED_INPUT,
      reasonCode: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.UNSUPPORTED_INPUT,
      queueEvidence: null,
      decision: null,
    }));
    expect(result.audit.ok).toBe(true);
  });

  test('rejects a decision whose evidence binding or queue output is altered', () => {
    const result = buildPolicyRuntimeQueueAutomationDecision({
      evidenceAdmission: buildEvidenceAdmission(),
      routing: { mapped: true },
    });
    const audit = buildPolicyRuntimeQueueAutomationDecisionAudit({
      ...result,
      queueEvidence: {
        ...result.queueEvidence,
        taskId: 'raw-queue-id',
        executionFingerprint: 'not-a-fingerprint',
      },
      decision: {
        ...result.decision,
        evidence: {
          ...result.decision.evidence,
          projectionFingerprint: {
            ...result.decision.evidence.projectionFingerprint,
            fingerprint: 'b'.repeat(64),
          },
        },
      },
      audit: {
        ...result.audit,
        queuePayload: { title: 'must not be exposed' },
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.RAW_QUEUE_DATA_EXPOSED,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS
          .EVIDENCE_FINGERPRINT_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS
          .INVALID_QUEUE_EVIDENCE_BINDING,
      }),
    ]));
  });

  test('rejects results that claim queue or routing side effects', () => {
    const result = buildPolicyRuntimeQueueAutomationDecision({
      evidenceAdmission: buildEvidenceAdmission(),
      routing: { mapped: true },
    });
    const audit = buildPolicyRuntimeQueueAutomationDecisionAudit({
      ...result,
      sideEffects: {
        ...result.sideEffects,
        routingExecuted: true,
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.UNSAFE_SIDE_EFFECT,
      }),
    ]));
  });
});
