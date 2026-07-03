import {
  ANSWER_OUTCOME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  buildPolicyBuilderPhase6BoundedEvidenceProjection,
} from '../../services/policyBuilderPhase6EvidenceBoundary.mjs';
import {
  buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence,
} from '../../services/policyBuilderPhase6IntentEngine.mjs';
import {
  buildPolicyBuilderPhase6LearningDecisionFromBoundedIntent,
} from '../../services/policyBuilderPhase6LearningGuard.mjs';
import {
  PHASE6R_READINESS_STATE_IDS,
  buildPolicyBuilderPhase6ReadinessFromBoundedContracts,
} from '../../services/policyBuilderPhase6ReadinessEngine.mjs';
import {
  PHASE6R_WORKFLOW_AUDIT_RISK_IDS,
  PHASE6R_WORKFLOW_BOUNDARY_STATUS_IDS,
  PHASE6R_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS,
  PHASE6R_WORKFLOW_SECTION_IDS,
  PHASE6R_WORKFLOW_STATUS_IDS,
  buildPolicyBuilderPhase6OperatorWorkflow,
  buildPolicyBuilderPhase6OperatorWorkflowFromBoundedReadiness,
  buildPolicyBuilderPhase6OperatorWorkflowAudit,
  getPolicyBuilderPhase6WorkflowSection,
  listPolicyBuilderPhase6WorkflowSections,
  validatePolicyBuilderPhase6OperatorWorkflow,
} from '../../services/policyBuilderPhase6OperatorWorkflow.mjs';

function buildReadyWorkflowInput(overrides = {}) {
  return {
    operatorIntent: {
      belongsHere: ['Animated Movies'],
      helpfulMatches: ['Disney'],
      routingTargets: ['Radarr Animated Movies'],
    },
    routing: {
      configured: true,
      routeReady: true,
      targetName: 'Radarr Animated Movies',
    },
    ...overrides,
  };
}

function buildBoundedWorkflowInputs({
  evidenceInput = {},
  learningInput = {},
  routing = {},
} = {}) {
  const boundedEvidenceResult = buildPolicyBuilderPhase6BoundedEvidenceProjection({
    evidenceInput: {
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        helpfulMatches: ['Disney'],
        routingTargets: ['Radarr Animated Movies'],
      },
      ...evidenceInput,
    },
  });
  const boundedIntentResult = buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence({
    boundedEvidenceResult,
  });
  const boundedLearningResult = buildPolicyBuilderPhase6LearningDecisionFromBoundedIntent({
    boundedIntentResult,
    learningInput: {
      answerOutcomeId: ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM,
      answer: {
        label: 'Animated Movies',
        destinationLibraryId: 6,
        destinationLibraryName: 'Animated Movies',
      },
      finalOutcome: {
        itemId: 10674,
        status: 'resolved',
      },
      ...learningInput,
    },
  });
  const boundedReadinessResult = buildPolicyBuilderPhase6ReadinessFromBoundedContracts({
    boundedEvidenceResult,
    boundedIntentResult,
    boundedLearningResult,
    routing: {
      configured: true,
      routeReady: true,
      targetName: 'Radarr Animated Movies',
      ...routing,
    },
  });

  return {
    boundedEvidenceResult,
    boundedIntentResult,
    boundedLearningResult,
    boundedReadinessResult,
  };
}

describe('policyBuilderPhase6OperatorWorkflow', () => {
  test('defines the five destination-first sections in roadmap order', () => {
    expect(listPolicyBuilderPhase6WorkflowSections().map(section => section.sectionId))
      .toEqual([
        PHASE6R_WORKFLOW_SECTION_IDS.WHAT_BELONGS_HERE,
        PHASE6R_WORKFLOW_SECTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
        PHASE6R_WORKFLOW_SECTION_IDS.WHAT_HELPS,
        PHASE6R_WORKFLOW_SECTION_IDS.WHEN_TO_ASK,
        PHASE6R_WORKFLOW_SECTION_IDS.CAN_THIS_ROUTE,
      ]);

    expect(getPolicyBuilderPhase6WorkflowSection(PHASE6R_WORKFLOW_SECTION_IDS.WHAT_HELPS))
      .toEqual(expect.objectContaining({
        heading: 'What helps but should not decide alone',
        editable: true,
      }));
  });

  test('builds a destination-first workflow from ready intent and readiness state', () => {
    const workflow = buildPolicyBuilderPhase6OperatorWorkflow(buildReadyWorkflowInput());

    expect(workflow).toEqual(expect.objectContaining({
      version: 'phase6r.operator_workflow.v1',
      workflowId: 'destination_first_policy_setup',
      sectionOrder: [
        PHASE6R_WORKFLOW_SECTION_IDS.WHAT_BELONGS_HERE,
        PHASE6R_WORKFLOW_SECTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
        PHASE6R_WORKFLOW_SECTION_IDS.WHAT_HELPS,
        PHASE6R_WORKFLOW_SECTION_IDS.WHEN_TO_ASK,
        PHASE6R_WORKFLOW_SECTION_IDS.CAN_THIS_ROUTE,
      ],
    }));
    expect(workflow.sections).toHaveLength(5);
    expect(workflow.readiness).toEqual(expect.objectContaining({
      stateId: PHASE6R_READINESS_STATE_IDS.READY,
      ready: true,
    }));
  });

  test('builds bounded workflow from bounded intent and readiness results', () => {
    const {
      boundedIntentResult,
      boundedReadinessResult,
    } = buildBoundedWorkflowInputs();

    const result = buildPolicyBuilderPhase6OperatorWorkflowFromBoundedReadiness({
      boundedIntentResult,
      boundedReadinessResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: PHASE6R_WORKFLOW_BOUNDARY_STATUS_IDS.READY,
      issueCount: 0,
      nextPhase: expect.objectContaining({
        phaseId: '6r_6',
      }),
    }));
    expect(result.workflow).toEqual(expect.objectContaining({
      version: 'phase6r.operator_workflow.v1',
      boundaryContext: expect.objectContaining({
        projectionFingerprintMatch: true,
      }),
    }));
    expect(result.workflow.readiness).toEqual(expect.objectContaining({
      stateId: PHASE6R_READINESS_STATE_IDS.READY,
      ready: true,
    }));
    expect(result.workflow.sections).toHaveLength(5);
    expect(result.workflow.decisionModel.serverOwnsBoundedReadiness).toBe(true);
    expect(JSON.stringify(result.boundaryContext)).not.toContain('Animated Movies');
  });

  test('blocks bounded workflow when bounded readiness failed', () => {
    const {
      boundedIntentResult,
      boundedReadinessResult,
    } = buildBoundedWorkflowInputs({
      routing: {
        configured: false,
        routeReady: false,
        targetName: '',
      },
    });

    expect(boundedReadinessResult.ok).toBe(true);
    const failedReadinessResult = {
      ...boundedReadinessResult,
      ok: false,
      readiness: null,
    };

    const result = buildPolicyBuilderPhase6OperatorWorkflowFromBoundedReadiness({
      boundedIntentResult,
      boundedReadinessResult: failedReadinessResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      workflow: null,
      workflowAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.MISSING_BOUNDED_READINESS,
      }),
    ]));
  });

  test('blocks bounded workflow when bounded intent audits are not passing', () => {
    const {
      boundedIntentResult,
      boundedReadinessResult,
    } = buildBoundedWorkflowInputs();
    const failedIntentAuditResult = {
      ...boundedIntentResult,
      intentAudit: {
        ...boundedIntentResult.intentAudit,
        ok: false,
      },
    };

    const result = buildPolicyBuilderPhase6OperatorWorkflowFromBoundedReadiness({
      boundedIntentResult: failedIntentAuditResult,
      boundedReadinessResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      workflow: null,
      workflowAudit: null,
      boundaryContext: expect.objectContaining({
        intentBoundary: expect.objectContaining({
          intentAuditOk: false,
        }),
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_INTENT_AUDIT_NOT_PASSING,
      }),
    ]));
  });

  test('blocks bounded workflow when bounded readiness audit is not passing', () => {
    const {
      boundedIntentResult,
      boundedReadinessResult,
    } = buildBoundedWorkflowInputs();
    const failedReadinessAuditResult = {
      ...boundedReadinessResult,
      readinessAudit: {
        ...boundedReadinessResult.readinessAudit,
        ok: false,
      },
    };

    const result = buildPolicyBuilderPhase6OperatorWorkflowFromBoundedReadiness({
      boundedIntentResult,
      boundedReadinessResult: failedReadinessAuditResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      workflow: null,
      workflowAudit: null,
      boundaryContext: expect.objectContaining({
        readinessBoundary: expect.objectContaining({
          readinessAuditOk: false,
        }),
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_READINESS_AUDIT_NOT_PASSING,
      }),
    ]));
  });

  test('blocks bounded workflow when intent and readiness provenance differ', () => {
    const {
      boundedIntentResult,
      boundedReadinessResult,
    } = buildBoundedWorkflowInputs();
    const mismatchedReadinessResult = {
      ...boundedReadinessResult,
      boundaryContext: {
        ...boundedReadinessResult.boundaryContext,
        intentBoundary: {
          ...boundedReadinessResult.boundaryContext.intentBoundary,
          projectionFingerprint: {
            ...boundedReadinessResult.boundaryContext.intentBoundary.projectionFingerprint,
            fingerprint: 'f'.repeat(64),
          },
        },
      },
    };

    const result = buildPolicyBuilderPhase6OperatorWorkflowFromBoundedReadiness({
      boundedIntentResult,
      boundedReadinessResult: mismatchedReadinessResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      workflow: null,
      workflowAudit: null,
      boundaryContext: expect.objectContaining({
        projectionFingerprintMatch: false,
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_PROVENANCE_MISMATCH,
      }),
    ]));
  });

  test('surfaces readiness through the route section without making it editable', () => {
    const workflow = buildPolicyBuilderPhase6OperatorWorkflow({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
      routing: {
        configured: false,
        routeReady: false,
      },
    });
    const routeSection = workflow.sections.find(section =>
      section.sectionId === PHASE6R_WORKFLOW_SECTION_IDS.CAN_THIS_ROUTE
    );

    expect(workflow.readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.NEEDS_ROUTING);
    expect(routeSection).toEqual(expect.objectContaining({
      editable: false,
      statusId: PHASE6R_WORKFLOW_STATUS_IDS.NEEDS_ACTION,
    }));
    expect(routeSection.readiness).toEqual(expect.objectContaining({
      stateId: PHASE6R_READINESS_STATE_IDS.NEEDS_ROUTING,
      nextAction: expect.objectContaining({
        actionId: 'configure_routing',
      }),
    }));
  });

  test('marks missing destination examples as the first action surface', () => {
    const workflow = buildPolicyBuilderPhase6OperatorWorkflow({
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr Animated Movies',
      },
    });
    const belongsHere = workflow.sections.find(section =>
      section.sectionId === PHASE6R_WORKFLOW_SECTION_IDS.WHAT_BELONGS_HERE
    );

    expect(workflow.readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES);
    expect(belongsHere).toEqual(expect.objectContaining({
      statusId: PHASE6R_WORKFLOW_STATUS_IDS.NEEDS_ACTION,
      primaryAction: expect.objectContaining({
        actionId: 'accept_examples',
      }),
    }));
  });

  test('keeps old diagnostic surfaces out of the normal workflow', () => {
    const workflow = buildPolicyBuilderPhase6OperatorWorkflow(buildReadyWorkflowInput({
      providerReadiness: { state: 'limited' },
      replayPreview: { state: 'different' },
      tmdbCoverage: { state: 'partial' },
      rawScoringPanel: { score: 0.7 },
    }));
    const sectionText = workflow.sections
      .map(section => [
        section.heading,
        section.plainQuestion,
        section.helperText,
        section.primaryAction.label,
      ].join(' '))
      .join(' ');

    expect(workflow.readiness.stateId).toBe(PHASE6R_READINESS_STATE_IDS.READY);
    expect(workflow.normalWorkflowExclusions).toEqual([
      PHASE6R_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.IMPACT_PREVIEW,
      PHASE6R_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.REPLAY_PREVIEW,
      PHASE6R_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.REPLAY_PARITY,
      PHASE6R_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.PROVIDER_GATE,
      PHASE6R_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.PROVIDER_READINESS,
      PHASE6R_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.TMDB_COVERAGE,
      PHASE6R_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.RAW_SCORING,
      PHASE6R_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.DIAGNOSTIC_PANEL,
    ]);
    expect(sectionText.toLowerCase()).not.toContain('replay');
    expect(sectionText.toLowerCase()).not.toContain('tmdb');
    expect(sectionText.toLowerCase()).not.toContain('provider');
    expect(sectionText.toLowerCase()).not.toContain('scoring');
  });

  test('normalizes entries without exposing raw payloads', () => {
    const workflow = buildPolicyBuilderPhase6OperatorWorkflow(buildReadyWorkflowInput());
    const belongsHere = workflow.sections.find(section =>
      section.sectionId === PHASE6R_WORKFLOW_SECTION_IDS.WHAT_BELONGS_HERE
    );

    expect(belongsHere.entries).toEqual([
      expect.objectContaining({
        label: 'Animated Movies',
        includesRawPayload: false,
        intentFieldId: 'belongs_here',
      }),
    ]);
  });

  test('passes the default operator workflow audit', () => {
    const audit = buildPolicyBuilderPhase6OperatorWorkflowAudit(
      buildPolicyBuilderPhase6OperatorWorkflow(buildReadyWorkflowInput())
    );

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedSectionCount).toBe(5);
    expect(audit.requiredSectionCount).toBe(5);
    expect(audit.prohibitedNormalSurfaceCount).toBe(8);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '6r_6',
      label: 'Migration And Deletion Path',
    }));
  });

  test('rejects workflow copy and decisions that reintroduce diagnostics or direct execution', () => {
    const workflow = buildPolicyBuilderPhase6OperatorWorkflow(buildReadyWorkflowInput());
    workflow.sections[0].helperText = 'Use replay parity and TMDB coverage to decide this.';
    workflow.sections[1].primaryAction = null;
    workflow.sections[2].executesRouting = true;
    workflow.sections[3].persistsPolicy = true;
    workflow.sections[4].editable = true;
    workflow.sections[4].readiness = {};
    workflow.sections[0].entries.push({
      label: 'Raw provider response',
      includesRawPayload: true,
    });
    workflow.normalWorkflowExclusions = [];
    workflow.decisionModel.diagnosticPanelsAllowedInNormalFlow = true;

    expect(validatePolicyBuilderPhase6OperatorWorkflow(workflow).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.INTERNAL_LANGUAGE,
        }),
        expect.objectContaining({
          riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.MISSING_PRIMARY_ACTION,
        }),
        expect.objectContaining({
          riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.DIRECT_EXECUTION,
        }),
        expect.objectContaining({
          riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.DIRECT_PERSISTENCE,
        }),
        expect.objectContaining({
          riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.READINESS_SECTION_EDITABLE,
        }),
        expect.objectContaining({
          riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.ROUTE_SECTION_MISSING_READINESS,
        }),
        expect.objectContaining({
          riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
        }),
        expect.objectContaining({
          riskId: PHASE6R_WORKFLOW_AUDIT_RISK_IDS.DIAGNOSTIC_SURFACE_IN_NORMAL_FLOW,
        }),
      ]));
  });
});
