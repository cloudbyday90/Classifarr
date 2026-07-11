import {
  ANSWER_OUTCOME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  buildBoundedPolicyEvidenceProjection,
} from '../../services/policyEvidenceBoundary.mjs';
import {
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
} from '../../services/policyEvidenceQuality.mjs';
import {
  buildPolicyIntentDraftFromBoundedEvidence,
} from '../../services/policyIntentEngine.mjs';
import {
  buildPolicyLearningDecisionFromBoundedIntent,
} from '../../services/policyLearningGuard.mjs';
import {
  POLICY_AUTOMATION_READINESS_STATE_IDS,
  buildPolicyAutomationReadinessFromBoundedContracts,
} from '../../services/policyAutomationReadinessEngine.mjs';
import {
  POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS,
  POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS,
  POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS,
  POLICY_OPERATOR_WORKFLOW_SECTION_IDS,
  POLICY_OPERATOR_WORKFLOW_STATUS_IDS,
  buildPolicyOperatorWorkflow,
  buildPolicyOperatorWorkflowFromBoundedReadiness,
  buildPolicyOperatorWorkflowAudit,
  getPolicyOperatorWorkflowSection,
  listPolicyOperatorWorkflowSections,
  validatePolicyOperatorWorkflow,
} from '../../services/policyOperatorWorkflow.mjs';

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
  const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
    evidenceInput: {
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        helpfulMatches: ['Disney'],
        routingTargets: ['Radarr Animated Movies'],
      },
      ...evidenceInput,
    },
  });
  const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
    boundedEvidenceResult,
  });
  const boundedLearningResult = buildPolicyLearningDecisionFromBoundedIntent({
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
  const boundedReadinessResult = buildPolicyAutomationReadinessFromBoundedContracts({
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

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function withReadinessQuality(result, quality) {
  const nextResult = clonePlain(result);
  nextResult.boundaryContext.evidenceBoundary.quality = clonePlain(quality);
  nextResult.boundaryContext.intentBoundary.quality = clonePlain(quality);
  nextResult.boundaryContext.learningBoundary.quality = clonePlain(quality);
  nextResult.readiness.inputs.boundaryContext = clonePlain(nextResult.boundaryContext);
  return nextResult;
}

describe('policyOperatorWorkflow', () => {
  test('defines the five destination-first sections in roadmap order', () => {
    expect(listPolicyOperatorWorkflowSections().map(section => section.sectionId))
      .toEqual([
        POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_BELONGS_HERE,
        POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
        POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_HELPS,
        POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHEN_TO_ASK,
        POLICY_OPERATOR_WORKFLOW_SECTION_IDS.CAN_THIS_ROUTE,
      ]);

    expect(getPolicyOperatorWorkflowSection(POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_HELPS))
      .toEqual(expect.objectContaining({
        heading: 'What helps but should not decide alone',
        editable: true,
      }));
  });

  test('builds a destination-first workflow from ready intent and readiness state', () => {
    const workflow = buildPolicyOperatorWorkflow(buildReadyWorkflowInput());

    expect(workflow).toEqual(expect.objectContaining({
      version: 'policy.operator_workflow.v1',
      workflowId: 'destination_first_policy_setup',
      sectionOrder: [
        POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_BELONGS_HERE,
        POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
        POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_HELPS,
        POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHEN_TO_ASK,
        POLICY_OPERATOR_WORKFLOW_SECTION_IDS.CAN_THIS_ROUTE,
      ],
    }));
    expect(workflow.sections).toHaveLength(5);
    expect(workflow.readiness).toEqual(expect.objectContaining({
      stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.READY,
      ready: true,
    }));
  });

  test('builds bounded workflow from bounded intent and readiness results', () => {
    const {
      boundedIntentResult,
      boundedReadinessResult,
    } = buildBoundedWorkflowInputs();

    const result = buildPolicyOperatorWorkflowFromBoundedReadiness({
      boundedIntentResult,
      boundedReadinessResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS.READY,
      issueCount: 0,
      nextStep: expect.objectContaining({
        stepId: 'migration_deletion_path',
      }),
    }));
    expect(result.workflow).toEqual(expect.objectContaining({
      version: 'policy.operator_workflow.v1',
      boundaryContext: expect.objectContaining({
        projectionFingerprintMatch: true,
      }),
    }));
    expect(result.workflow.readiness).toEqual(expect.objectContaining({
      stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.READY,
      ready: true,
    }));
    expect(result.workflow.sections).toHaveLength(5);
    expect(result.workflow.decisionModel.serverOwnsBoundedReadiness).toBe(true);
    expect(result.boundaryContext).toEqual(expect.objectContaining({
      qualityMatch: true,
      intentBoundary: expect.objectContaining({
        quality: expect.objectContaining({
          statusId: boundedIntentResult.evidenceBoundary.quality.statusId,
          nextActionId: boundedIntentResult.evidenceBoundary.quality.nextActionId,
        }),
      }),
      readinessBoundary: expect.objectContaining({
        evidenceQuality: expect.objectContaining({
          statusId: boundedReadinessResult.boundaryContext.evidenceBoundary.quality.statusId,
        }),
        intentQuality: expect.objectContaining({
          statusId: boundedReadinessResult.boundaryContext.intentBoundary.quality.statusId,
        }),
        learningQuality: expect.objectContaining({
          statusId: boundedReadinessResult.boundaryContext.learningBoundary.quality.statusId,
        }),
      }),
    }));
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

    const result = buildPolicyOperatorWorkflowFromBoundedReadiness({
      boundedIntentResult,
      boundedReadinessResult: failedReadinessResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      workflow: null,
      workflowAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_BOUNDED_READINESS,
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

    const result = buildPolicyOperatorWorkflowFromBoundedReadiness({
      boundedIntentResult: failedIntentAuditResult,
      boundedReadinessResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
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
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_INTENT_AUDIT_NOT_PASSING,
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

    const result = buildPolicyOperatorWorkflowFromBoundedReadiness({
      boundedIntentResult,
      boundedReadinessResult: failedReadinessAuditResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
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
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_READINESS_AUDIT_NOT_PASSING,
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

    const result = buildPolicyOperatorWorkflowFromBoundedReadiness({
      boundedIntentResult,
      boundedReadinessResult: mismatchedReadinessResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      workflow: null,
      workflowAudit: null,
      boundaryContext: expect.objectContaining({
        projectionFingerprintMatch: false,
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_PROVENANCE_MISMATCH,
      }),
    ]));
  });

  test('blocks bounded workflow when readiness quality context is missing', () => {
    const {
      boundedIntentResult,
      boundedReadinessResult,
    } = buildBoundedWorkflowInputs();
    const missingQualityReadinessResult = clonePlain(boundedReadinessResult);
    missingQualityReadinessResult.readiness.inputs.boundaryContext.intentBoundary.quality = null;

    const result = buildPolicyOperatorWorkflowFromBoundedReadiness({
      boundedIntentResult,
      boundedReadinessResult: missingQualityReadinessResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      workflow: null,
      workflowAudit: null,
      boundaryContext: expect.objectContaining({
        qualityMatch: false,
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
      }),
    ]));
  });

  test('blocks bounded workflow when readiness quality is insufficient', () => {
    const {
      boundedIntentResult,
      boundedReadinessResult,
    } = buildBoundedWorkflowInputs();
    const insufficientQuality = {
      ...boundedIntentResult.evidenceBoundary.quality,
      statusId: POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT,
      nextActionId: 'confirm_destination_identity',
      reasonIds: ['missing_identity'],
    };
    const insufficientIntentResult = {
      ...boundedIntentResult,
      evidenceBoundary: {
        ...boundedIntentResult.evidenceBoundary,
        quality: insufficientQuality,
      },
    };

    const result = buildPolicyOperatorWorkflowFromBoundedReadiness({
      boundedIntentResult: insufficientIntentResult,
      boundedReadinessResult: withReadinessQuality(boundedReadinessResult, insufficientQuality),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      workflow: null,
      workflowAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_QUALITY_INSUFFICIENT,
        nextActionId: 'confirm_destination_identity',
      }),
    ]));
  });

  test('blocks bounded workflow when readiness quality no longer matches intent quality', () => {
    const {
      boundedIntentResult,
      boundedReadinessResult,
    } = buildBoundedWorkflowInputs();
    const mismatchedQuality = {
      ...boundedIntentResult.evidenceBoundary.quality,
      nextActionId: 'review_evidence',
      reasonIds: [
        ...boundedIntentResult.evidenceBoundary.quality.reasonIds,
        'review_evidence_present',
      ].sort(),
    };

    const result = buildPolicyOperatorWorkflowFromBoundedReadiness({
      boundedIntentResult,
      boundedReadinessResult: withReadinessQuality(boundedReadinessResult, mismatchedQuality),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      workflow: null,
      workflowAudit: null,
      boundaryContext: expect.objectContaining({
        qualityMatch: false,
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_QUALITY_MISMATCH,
      }),
    ]));
  });

  test('rejects bounded workflow context that drops sanitized quality snapshots', () => {
    const {
      boundedIntentResult,
      boundedReadinessResult,
    } = buildBoundedWorkflowInputs();
    const result = buildPolicyOperatorWorkflowFromBoundedReadiness({
      boundedIntentResult,
      boundedReadinessResult,
    });

    result.workflow.boundaryContext.readinessBoundary.intentQuality = null;

    expect(validatePolicyOperatorWorkflow(result.workflow).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
        }),
      ]));
  });

  test('surfaces readiness through the route section without making it editable', () => {
    const workflow = buildPolicyOperatorWorkflow({
      operatorIntent: {
        belongsHere: ['Animated Movies'],
      },
      routing: {
        configured: false,
        routeReady: false,
      },
    });
    const routeSection = workflow.sections.find(section =>
      section.sectionId === POLICY_OPERATOR_WORKFLOW_SECTION_IDS.CAN_THIS_ROUTE
    );

    expect(workflow.readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING);
    expect(routeSection).toEqual(expect.objectContaining({
      editable: false,
      statusId: POLICY_OPERATOR_WORKFLOW_STATUS_IDS.NEEDS_ACTION,
    }));
    expect(routeSection.readiness).toEqual(expect.objectContaining({
      stateId: POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING,
      nextAction: expect.objectContaining({
        actionId: 'configure_routing',
      }),
    }));
  });

  test('marks missing destination examples as the first action surface', () => {
    const workflow = buildPolicyOperatorWorkflow({
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'Radarr Animated Movies',
      },
    });
    const belongsHere = workflow.sections.find(section =>
      section.sectionId === POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_BELONGS_HERE
    );

    expect(workflow.readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_MORE_EXAMPLES);
    expect(belongsHere).toEqual(expect.objectContaining({
      statusId: POLICY_OPERATOR_WORKFLOW_STATUS_IDS.NEEDS_ACTION,
      primaryAction: expect.objectContaining({
        actionId: 'accept_examples',
      }),
    }));
  });

  test('keeps old diagnostic surfaces out of the normal workflow', () => {
    const workflow = buildPolicyOperatorWorkflow(buildReadyWorkflowInput({
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

    expect(workflow.readiness.stateId).toBe(POLICY_AUTOMATION_READINESS_STATE_IDS.READY);
    expect(workflow.normalWorkflowExclusions).toEqual([
      POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.IMPACT_PREVIEW,
      POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.REPLAY_PREVIEW,
      POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.REPLAY_PARITY,
      POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.PROVIDER_GATE,
      POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.PROVIDER_READINESS,
      POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.TMDB_COVERAGE,
      POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.RAW_SCORING,
      POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS.DIAGNOSTIC_PANEL,
    ]);
    expect(sectionText.toLowerCase()).not.toContain('replay');
    expect(sectionText.toLowerCase()).not.toContain('tmdb');
    expect(sectionText.toLowerCase()).not.toContain('provider');
    expect(sectionText.toLowerCase()).not.toContain('scoring');
  });

  test('normalizes entries without exposing raw payloads', () => {
    const workflow = buildPolicyOperatorWorkflow(buildReadyWorkflowInput());
    const belongsHere = workflow.sections.find(section =>
      section.sectionId === POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_BELONGS_HERE
    );

    expect(belongsHere.entries).toEqual([
      expect.objectContaining({
        label: 'Animated Movies',
        includesRawPayload: false,
        intentFieldId: 'belongs_here',
      }),
    ]);
  });

  test('removes object-valued entry data before it reaches the normal workflow', () => {
    const workflow = buildPolicyOperatorWorkflow({
      intentDraft: {
        version: 'policy.intent.v1',
        belongs_here: [{
          key: 'destination:animation',
          label: 'Animated Movies',
          value: {
            providerPayload: { apiKey: 'must-not-escape' },
          },
          authoritySourceId: 'media_server_contents',
          evidenceCount: 5,
        }],
        helpful_matches: [],
        hard_limits: [],
        avoid: [],
        ask_when: [],
        routing_target: [{ label: 'Radarr Animated Movies' }],
      },
      readiness: {
        version: 'policy.automation_readiness.v1',
        stateId: 'ready',
        ready: true,
        nextAction: { actionId: 'continue_automation' },
        reasonCodes: ['ready_for_automation'],
        issues: [],
      },
    });
    const belongsHere = workflow.sections.find(section =>
      section.sectionId === POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_BELONGS_HERE
    );

    expect(belongsHere.entries[0]).toEqual(expect.objectContaining({
      label: 'Animated Movies',
      value: null,
      includesRawPayload: false,
    }));
    expect(JSON.stringify(workflow)).not.toContain('must-not-escape');

    belongsHere.entries[0].value = { raw: true };
    expect(validatePolicyOperatorWorkflow(workflow).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      }),
    ]));
  });

  test('passes the default operator workflow audit', () => {
    const audit = buildPolicyOperatorWorkflowAudit(
      buildPolicyOperatorWorkflow(buildReadyWorkflowInput())
    );

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedSectionCount).toBe(5);
    expect(audit.requiredSectionCount).toBe(5);
    expect(audit.prohibitedNormalSurfaceCount).toBe(8);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'migration_deletion_path',
      label: 'Policy Migration Deletion Path',
    }));
  });

  test('rejects workflow copy and decisions that reintroduce diagnostics or direct execution', () => {
    const workflow = buildPolicyOperatorWorkflow(buildReadyWorkflowInput());
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

    expect(validatePolicyOperatorWorkflow(workflow).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.INTERNAL_LANGUAGE,
        }),
        expect.objectContaining({
          riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_PRIMARY_ACTION,
        }),
        expect.objectContaining({
          riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.DIRECT_EXECUTION,
        }),
        expect.objectContaining({
          riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.DIRECT_PERSISTENCE,
        }),
        expect.objectContaining({
          riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.READINESS_SECTION_EDITABLE,
        }),
        expect.objectContaining({
          riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.ROUTE_SECTION_MISSING_READINESS,
        }),
        expect.objectContaining({
          riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
        }),
        expect.objectContaining({
          riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.DIAGNOSTIC_SURFACE_IN_NORMAL_FLOW,
        }),
      ]));
  });
});
