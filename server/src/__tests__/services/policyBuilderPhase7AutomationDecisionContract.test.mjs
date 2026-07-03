import {
  POLICY_EVIDENCE_BUCKET_IDS,
} from '../../services/policyEvidenceEngine.mjs';
import {
  POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS,
  buildPolicyRuntimeEvidenceProjection,
} from '../../services/policyRuntimeEvidenceProjection.mjs';
import {
  PHASE7R_AUTOMATION_DECISION_ACTION_IDS,
  PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS,
  PHASE7R_AUTOMATION_DECISION_REASON_IDS,
  PHASE7R_AUTOMATION_DECISION_STATE_IDS,
  buildPolicyBuilderPhase7AutomationDecision,
  buildPolicyBuilderPhase7AutomationDecisionContractAudit,
  getAutomationDecisionState,
  listPolicyBuilderPhase7AutomationDecisionStates,
  validatePolicyBuilderPhase7AutomationDecision,
} from '../../services/policyBuilderPhase7AutomationDecisionContract.mjs';

function buildStrongRuntimeEvidence(overrides = {}) {
  return buildPolicyRuntimeEvidenceProjection({
    libraryProfile: {
      identityCandidates: [
        { label: 'Animated Movies', count: 12, confidence: 0.92, trusted: true },
      ],
    },
    operatorIntent: {
      routingTargets: ['Radarr Animated Movies'],
    },
    routingOutcomes: [
      { label: 'Radarr route mapped', routed: true },
    ],
    profileFreshness: {
      stale: false,
      updatedAt: '2026-06-30T12:00:00.000Z',
    },
    ...overrides,
  });
}

describe('policyBuilderPhase7AutomationDecisionContract', () => {
  test('defines the Phase 7R runtime automation decision states', () => {
    expect(listPolicyBuilderPhase7AutomationDecisionStates().map(state => state.id)).toEqual([
      PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
      PHASE7R_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED,
      PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
      PHASE7R_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
      PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING,
      PHASE7R_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY,
      PHASE7R_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE,
    ]);

    expect(getAutomationDecisionState(PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY))
      .toEqual(expect.objectContaining({
        actionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR,
        automationAllowed: true,
        routeAllowed: true,
      }));
  });

  test('allows auto-route only when identity, routing, freshness, and risk gates pass', () => {
    const decision = buildPolicyBuilderPhase7AutomationDecision({
      evidenceProjection: buildStrongRuntimeEvidence(),
      routing: {
        mapped: true,
        targetName: 'Radarr Animated Movies',
      },
      classification: {
        status: 'completed',
      },
    });

    expect(decision.stateId).toBe(PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY);
    expect(decision.actionId).toBe(PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR);
    expect(decision.automationAllowed).toBe(true);
    expect(decision.routeAllowed).toBe(true);
    expect(decision.classificationAllowed).toBe(true);
    expect(decision.strongIdentity).toBe(true);
    expect(decision.routeMapped).toBe(true);
    expect(decision.sideEffects).toEqual({
      routeExecuted: false,
      classificationWritten: false,
      questionCreated: false,
      learningWritten: false,
    });
    expect(decision.trace.attributes).toEqual(expect.objectContaining({
      'classifarr.runtime.decision.state': PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
      'classifarr.runtime.decision.strong_identity': true,
      'classifarr.runtime.decision.route_mapped': true,
      'classifarr.runtime.decision.evidence_projection_fingerprint':
        expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(decision.evidence.projectionFingerprint).toEqual(expect.objectContaining({
      algorithm: 'sha256',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      provenance: expect.objectContaining({
        totalEntryCount: 4,
      }),
    }));
    expect(decision.trace.attributes['classifarr.runtime.decision.evidence_projection_fingerprint'])
      .toBe(decision.evidence.projectionFingerprint.fingerprint);
    expect(JSON.stringify(decision.evidence.projectionFingerprint)).not.toContain('Animated Movies');
    expect(JSON.stringify(decision.evidence.projectionFingerprint)).not.toContain('Radarr Animated Movies');
    expect(decision.trace.reasons).toEqual([
      expect.objectContaining({
        reasonId: PHASE7R_AUTOMATION_DECISION_REASON_IDS.AUTOMATION_ROUTE_READY,
      }),
    ]);
    expect(validatePolicyBuilderPhase7AutomationDecision(decision).ok).toBe(true);
  });

  test('records completed classification without Arr mapping as classified_not_routed', () => {
    const evidenceProjection = buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 8, confidence: 0.91, trusted: true },
        ],
      },
      operatorIntent: {
        routingTargets: ['Radarr Animated Movies'],
      },
    });
    const decision = buildPolicyBuilderPhase7AutomationDecision({
      evidenceProjection,
      classification: {
        status: 'completed',
      },
      routing: {
        mapped: false,
        targetName: 'Radarr Animated Movies',
      },
    });

    expect(decision.stateId).toBe(PHASE7R_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED);
    expect(decision.classificationAllowed).toBe(true);
    expect(decision.routeAllowed).toBe(false);
    expect(decision.routeMapped).toBe(false);
    expect(decision.trace.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: PHASE7R_AUTOMATION_DECISION_REASON_IDS.CLASSIFICATION_WITHOUT_ROUTE,
      }),
    ]));
    expect(validatePolicyBuilderPhase7AutomationDecision(decision).ok).toBe(true);
  });

  test('uses needs_routing_mapping when destination identity is strong but no route target is mapped', () => {
    const decision = buildPolicyBuilderPhase7AutomationDecision({
      evidenceProjection: buildPolicyRuntimeEvidenceProjection({
        libraryProfile: {
          identityCandidates: [
            { label: 'Animated Movies', count: 7, confidence: 0.88, trusted: true },
          ],
        },
      }),
      routing: {
        mapped: false,
      },
    });

    expect(decision.stateId).toBe(PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING);
    expect(decision.actionId).toBe(PHASE7R_AUTOMATION_DECISION_ACTION_IDS.CONFIGURE_ROUTING);
    expect(decision.classificationAllowed).toBe(false);
    expect(decision.routeAllowed).toBe(false);
  });

  test('blocks automation when hard-limit evaluation fails', () => {
    const decision = buildPolicyBuilderPhase7AutomationDecision({
      evidenceProjection: buildStrongRuntimeEvidence(),
      routing: {
        mapped: true,
      },
      policyEvaluation: {
        hardLimitSatisfied: false,
      },
    });

    expect(decision.stateId).toBe(PHASE7R_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT);
    expect(decision.actionId).toBe(PHASE7R_AUTOMATION_DECISION_ACTION_IDS.BLOCK_AUTOMATION);
    expect(decision.automationAllowed).toBe(false);
    expect(decision.trace.reasons[0]).toEqual(expect.objectContaining({
      reasonId: PHASE7R_AUTOMATION_DECISION_REASON_IDS.HARD_LIMIT_VIOLATION,
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
    }));
  });

  test('uses stale_profile_retry before route decisions when profile evidence is stale', () => {
    const decision = buildPolicyBuilderPhase7AutomationDecision({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 10, confidence: 0.9, trusted: true },
        ],
      },
      routing: {
        mapped: true,
        targetName: 'Radarr Animated Movies',
      },
      profileFreshness: {
        stale: true,
        updatedAt: '2026-05-01T12:00:00.000Z',
      },
    });

    expect(decision.stateId).toBe(PHASE7R_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY);
    expect(decision.actionId).toBe(PHASE7R_AUTOMATION_DECISION_ACTION_IDS.REFRESH_PROFILE);
    expect(decision.routeAllowed).toBe(false);
    expect(decision.trace.reasons[0]).toEqual(expect.objectContaining({
      reasonId: PHASE7R_AUTOMATION_DECISION_REASON_IDS.STALE_PROFILE,
    }));
  });

  test('requires operator review for avoid rules and high-risk evidence conflicts', () => {
    const avoidDecision = buildPolicyBuilderPhase7AutomationDecision({
      evidenceProjection: buildStrongRuntimeEvidence(),
      routing: {
        mapped: true,
      },
      policyEvaluation: {
        avoidRulesSatisfied: false,
      },
    });
    const ragConflictDecision = buildPolicyBuilderPhase7AutomationDecision({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 9, confidence: 0.9, trusted: true },
        ],
      },
      routing: {
        mapped: true,
        targetName: 'Radarr Animated Movies',
      },
      ragNeighbors: [
        {
          label: 'Unknown neighbor',
          libraryName: 'Unknown library',
          similarity: 0.84,
          trusted: false,
        },
      ],
    });

    expect(avoidDecision.stateId).toBe(PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW);
    expect(avoidDecision.trace.reasons[0].reasonId)
      .toBe(PHASE7R_AUTOMATION_DECISION_REASON_IDS.AVOID_RULE_CONFLICT);
    expect(ragConflictDecision.stateId).toBe(PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW);
    expect(ragConflictDecision.evidence.counts.insufficient).toBe(1);
  });

  test('uses insufficient_evidence when weak runtime evidence is all that exists', () => {
    const decision = buildPolicyBuilderPhase7AutomationDecision({
      libraryProfile: {
        identityCandidates: [
          { label: 'Animation', count: 1, confidence: 0.64 },
        ],
      },
      metadataSignals: [
        { label: 'Comedy', confidence: 0.7 },
      ],
    });

    expect(decision.stateId).toBe(PHASE7R_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE);
    expect(decision.actionId).toBe(PHASE7R_AUTOMATION_DECISION_ACTION_IDS.GATHER_EVIDENCE);
    expect(decision.strongIdentity).toBe(false);
    expect(decision.evidence.counts.identity).toBe(0);
    expect(decision.trace.reasons[0]).toEqual(expect.objectContaining({
      reasonId: PHASE7R_AUTOMATION_DECISION_REASON_IDS.MISSING_STRONG_IDENTITY,
    }));
  });

  test('rejects unsafe auto-route and side-effect claims', () => {
    const validation = validatePolicyBuilderPhase7AutomationDecision({
      version: 'phase7r.automation_decision.v1',
      stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
      actionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR,
      routeAllowed: true,
      routeMapped: false,
      strongIdentity: false,
      evidence: {
        validation: {
          ok: false,
        },
      },
      sideEffects: {
        routeExecuted: true,
      },
      trace: {
        reasons: [
          {
            reasonId: POLICY_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.STALE_PROFILE,
          },
        ],
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITHOUT_STRONG_IDENTITY,
      }),
      expect.objectContaining({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.AUTO_ROUTE_WITHOUT_ROUTING,
      }),
      expect.objectContaining({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.INVALID_RUNTIME_EVIDENCE,
      }),
      expect.objectContaining({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.DECISION_PERFORMED_SIDE_EFFECT,
      }),
      expect.objectContaining({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.MISSING_EVIDENCE_FINGERPRINT,
      }),
    ]));
  });

  test('rejects automation decisions with malformed or unsafe evidence fingerprints', () => {
    const decision = buildPolicyBuilderPhase7AutomationDecision({
      evidenceProjection: buildStrongRuntimeEvidence(),
      routing: {
        mapped: true,
        targetName: 'Radarr Animated Movies',
      },
    });
    const validation = validatePolicyBuilderPhase7AutomationDecision({
      ...decision,
      evidence: {
        ...decision.evidence,
        projectionFingerprint: {
          ...decision.evidence.projectionFingerprint,
          algorithm: 'md5',
          fingerprint: 'not-a-sha256',
          provenance: {
            ...decision.evidence.projectionFingerprint.provenance,
            rawLabel: 'Animated Movies',
          },
        },
      },
      trace: {
        ...decision.trace,
        attributes: {
          ...decision.trace.attributes,
          'classifarr.runtime.decision.evidence_projection_fingerprint':
            decision.evidence.projectionFingerprint.fingerprint,
        },
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.MALFORMED_EVIDENCE_FINGERPRINT,
      }),
      expect.objectContaining({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.RAW_EVIDENCE_PROVENANCE_EXPOSED,
      }),
      expect.objectContaining({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS.TRACE_FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('rejects automation decisions without runtime evidence validation proof', () => {
    const decision = buildPolicyBuilderPhase7AutomationDecision({
      evidenceProjection: buildStrongRuntimeEvidence(),
      routing: {
        mapped: true,
        targetName: 'Radarr Animated Movies',
      },
    });
    const validation = validatePolicyBuilderPhase7AutomationDecision({
      ...decision,
      evidence: {
        ...decision.evidence,
        validation: undefined,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS
          .MISSING_RUNTIME_EVIDENCE_VALIDATION,
      }),
    ]));
  });

  test('rejects automation decisions when trace evidence validity drifts', () => {
    const decision = buildPolicyBuilderPhase7AutomationDecision({
      evidenceProjection: buildStrongRuntimeEvidence(),
      routing: {
        mapped: true,
        targetName: 'Radarr Animated Movies',
      },
    });
    const validation = validatePolicyBuilderPhase7AutomationDecision({
      ...decision,
      trace: {
        ...decision.trace,
        attributes: {
          ...decision.trace.attributes,
          'classifarr.runtime.decision.evidence_valid': false,
        },
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_AUTOMATION_DECISION_AUDIT_RISK_IDS
          .TRACE_EVIDENCE_VALID_MISMATCH,
      }),
    ]));
  });

  test('passes the default automation decision contract audit', () => {
    const decision = buildPolicyBuilderPhase7AutomationDecision({
      evidenceProjection: buildStrongRuntimeEvidence(),
      routing: {
        mapped: true,
        targetName: 'Radarr Animated Movies',
      },
    });
    const audit = buildPolicyBuilderPhase7AutomationDecisionContractAudit(decision);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedStateCount).toBe(7);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '7r_4',
      label: 'Runtime Question Reduction',
    }));
  });
});
