import {
  PHASE7R_AUTOMATION_DECISION_STATE_IDS,
} from '../../services/policyBuilderPhase7AutomationDecisionContract.mjs';
import {
  PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS,
} from '../../services/policyBuilderPhase7RuntimeQuestionReduction.mjs';
import {
  PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS,
} from '../../services/policyBuilderPhase7RequestTimeLearning.mjs';
import {
  PHASE7R_REBUILD_PROPOSAL_STATUS_IDS,
} from '../../services/policyBuilderPhase7LibraryPolicyRebuild.mjs';
import {
  PHASE7R_MIGRATION_VERIFIER_STATUS_IDS,
} from '../../services/policyBuilderPhase7MigrationVerifierRollback.mjs';
import {
  PHASE7R_METRIC_AUDIT_RISK_IDS,
  PHASE7R_METRIC_COMPONENT_IDS,
  PHASE7R_METRIC_COUNTER_IDS,
  PHASE7R_METRIC_REASON_IDS,
  PHASE7R_REBUILD_EVENT_STATUS_IDS,
  buildPolicyBuilderPhase7RuntimeMetricsTrace,
  buildPolicyBuilderPhase7RuntimeMetricsTraceAudit,
  validatePolicyBuilderPhase7RuntimeMetricsTrace,
} from '../../services/policyBuilderPhase7RuntimeMetricsTrace.mjs';

describe('policyBuilderPhase7RuntimeMetricsTrace', () => {
  test('counts Phase 7R automation, question, learning, rebuild, and migration outcomes', () => {
    const metrics = buildPolicyBuilderPhase7RuntimeMetricsTrace({
      automationDecisions: [
        { stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY },
        { stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED },
        { stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW },
        { stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT },
        { stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING },
        { stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY },
      ],
      questionReductions: [
        { dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION },
        { dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.CONFIGURE_ROUTING },
        { dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.REFRESH_PROFILE },
      ],
      requestLearningDecisions: [
        { dispositionId: PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.LEARNING_CANDIDATE },
        { dispositionId: PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.BLOCKED },
        { dispositionId: PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.OUTCOME_ONLY },
        { dispositionId: PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.ROUTE_FAILURE_ONLY },
      ],
      rebuildProposals: [
        {
          statusId: PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.READY_FOR_REVIEW,
          acceptanceGate: {
            accepted: true,
          },
        },
        {
          statusId: PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED,
          acceptanceGate: {
            accepted: false,
          },
        },
      ],
      migrationVerifierReports: [
        {
          statusId: PHASE7R_MIGRATION_VERIFIER_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK,
          applicationGate: {
            operatorAccepted: true,
          },
        },
      ],
      rebuildEvents: [
        { statusId: PHASE7R_REBUILD_EVENT_STATUS_IDS.ROLLED_BACK },
      ],
    });

    expect(metrics.counters).toEqual(expect.objectContaining({
      [PHASE7R_METRIC_COUNTER_IDS.AUTO_ROUTED]: 1,
      [PHASE7R_METRIC_COUNTER_IDS.CLASSIFIED_NOT_ROUTED]: 1,
      [PHASE7R_METRIC_COUNTER_IDS.ASKED_FOR_REVIEW]: 2,
      [PHASE7R_METRIC_COUNTER_IDS.BLOCKED_BY_HARD_LIMIT]: 1,
      [PHASE7R_METRIC_COUNTER_IDS.MISSING_ROUTING]: 2,
      [PHASE7R_METRIC_COUNTER_IDS.STALE_PROFILE_RETRY]: 2,
      [PHASE7R_METRIC_COUNTER_IDS.LEARNING_ALLOWED]: 1,
      [PHASE7R_METRIC_COUNTER_IDS.LEARNING_BLOCKED]: 1,
      [PHASE7R_METRIC_COUNTER_IDS.LEARNING_DOWNGRADED]: 2,
      [PHASE7R_METRIC_COUNTER_IDS.REBUILD_ACCEPTED]: 2,
      [PHASE7R_METRIC_COUNTER_IDS.REBUILD_REJECTED]: 2,
      [PHASE7R_METRIC_COUNTER_IDS.REBUILD_ROLLED_BACK]: 1,
    }));
    expect(metrics.operatorSummaries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actionId: 'configure_routing',
      }),
      expect.objectContaining({
        actionId: 'review_pending_items',
      }),
      expect.objectContaining({
        actionId: 'refresh_profile',
      }),
      expect.objectContaining({
        actionId: 'review_rebuild_verifier',
      }),
    ]));
    expect(validatePolicyBuilderPhase7RuntimeMetricsTrace(metrics).ok).toBe(true);
  });

  test('bounds trace records and suppresses raw payload, prompts, embeddings, and diagnostics', () => {
    const metrics = buildPolicyBuilderPhase7RuntimeMetricsTrace({
      maxTraceRecords: 2,
      automationDecisions: [
        {
          stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
          rawPayload: {
            provider: 'suppressed',
          },
          trace: {
            reasons: [
              { reasonId: 'automation_route_ready' },
            ],
          },
        },
        {
          stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
          prompt: 'do not expose',
        },
        {
          stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE,
          embedding: [0.1, 0.2],
        },
      ],
    });

    expect(metrics.traceSummary).toEqual(expect.objectContaining({
      totalTraceCount: 3,
      emittedTraceCount: 2,
      truncated: true,
      maxTraceRecords: 2,
    }));
    expect(metrics.security).toEqual(expect.objectContaining({
      exposesRawPayload: false,
      exposesPrompt: false,
      exposesEmbedding: false,
      rawPayloadSuppressionCount: 3,
    }));
    metrics.traces.forEach(trace => {
      expect(trace.attributes['classifarr.phase7r.trace.sensitive_suppressed']).toBe(true);
      expect(JSON.stringify(trace)).not.toContain('do not expose');
      expect(trace.rawPayload).toBeUndefined();
      expect(trace.prompt).toBeUndefined();
      expect(trace.embedding).toBeUndefined();
    });
    expect(validatePolicyBuilderPhase7RuntimeMetricsTrace(metrics).ok).toBe(true);
  });

  test('emits stable component ids and bounded reason codes', () => {
    const metrics = buildPolicyBuilderPhase7RuntimeMetricsTrace({
      automationDecisions: [
        {
          stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
          trace: {
            reasons: Array.from({ length: 20 }, (_, index) => ({
              reasonId: `reason_${index}`,
            })),
          },
        },
      ],
    });

    expect(metrics.traces[0]).toEqual(expect.objectContaining({
      componentId: PHASE7R_METRIC_COMPONENT_IDS.AUTOMATION_DECISION,
      outcomeId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
      counterIds: [PHASE7R_METRIC_COUNTER_IDS.AUTO_ROUTED],
    }));
    expect(metrics.traces[0].reasons).toHaveLength(12);
    expect(metrics.traces[0].attributes).toEqual(expect.objectContaining({
      'classifarr.phase7r.trace.version': 'phase7r.runtime_metrics_trace.v1',
      'classifarr.phase7r.trace.component': PHASE7R_METRIC_COMPONENT_IDS.AUTOMATION_DECISION,
    }));
    expect(validatePolicyBuilderPhase7RuntimeMetricsTrace(metrics).ok).toBe(true);
  });

  test('carries supported upstream source fingerprints into bounded trace attributes', () => {
    const metrics = buildPolicyBuilderPhase7RuntimeMetricsTrace({
      automationDecisions: [
        {
          stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
          trace: {
            attributes: {
              'classifarr.runtime.decision.evidence_projection_fingerprint': 'a'.repeat(64),
            },
          },
        },
      ],
      questionReductions: [
        {
          dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
          trace: {
            attributes: {
              'classifarr.runtime.question.decision_evidence_projection_fingerprint': 'b'.repeat(64),
            },
          },
        },
      ],
      requestLearningDecisions: [
        {
          dispositionId: PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.LEARNING_CANDIDATE,
          trace: {
            attributes: {
              'classifarr.runtime.request_learning.upstream_evidence_fingerprint': 'c'.repeat(64),
            },
          },
        },
      ],
      migrationVerifierReports: [
        {
          statusId: PHASE7R_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES,
          trace: {
            attributes: {
              'classifarr.policy.migration_verifier.sample_set_fingerprint': 'd'.repeat(64),
            },
          },
        },
      ],
    });

    expect(metrics.traces.map(trace => trace.sourceFingerprint?.fingerprint))
      .toEqual(['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64), 'd'.repeat(64)]);
    expect(metrics.traces[0].attributes).toEqual(expect.objectContaining({
      'classifarr.phase7r.trace.source_fingerprint': 'a'.repeat(64),
      'classifarr.phase7r.trace.source_fingerprint_attribute':
        'classifarr.runtime.decision.evidence_projection_fingerprint',
    }));
    expect(JSON.stringify(metrics.traces)).not.toContain('Mulan');
    expect(validatePolicyBuilderPhase7RuntimeMetricsTrace(metrics).ok).toBe(true);
  });

  test('defaults to an action-oriented no-action summary when no counters require operator work', () => {
    const metrics = buildPolicyBuilderPhase7RuntimeMetricsTrace();

    expect(metrics.operatorSummaries).toEqual([
      {
        actionId: 'no_action_required',
        label: 'No operator action is required from the current Phase 7R metrics.',
        counterId: null,
      },
    ]);
    expect(validatePolicyBuilderPhase7RuntimeMetricsTrace(metrics).ok).toBe(true);
  });

  test('rejects unknown, negative, or non-integer counters', () => {
    const metrics = buildPolicyBuilderPhase7RuntimeMetricsTrace();
    metrics.counters.unknown_counter = 1;
    metrics.counters[PHASE7R_METRIC_COUNTER_IDS.AUTO_ROUTED] = -1;
    metrics.counters[PHASE7R_METRIC_COUNTER_IDS.MISSING_ROUTING] = 1.2;

    expect(validatePolicyBuilderPhase7RuntimeMetricsTrace(metrics).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.UNKNOWN_COUNTER,
        }),
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.NEGATIVE_COUNTER,
        }),
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.NON_INTEGER_COUNTER,
        }),
      ]));
  });

  test('rejects traces that expose raw payloads, prompts, embeddings, providers, or diagnostics', () => {
    const metrics = buildPolicyBuilderPhase7RuntimeMetricsTrace({
      automationDecisions: [
        { stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY },
      ],
    });
    metrics.traces[0].rawPayload = { leak: true };
    metrics.traces[0].prompt = 'leak';
    metrics.traces[0].embedding = [1, 2, 3];
    metrics.traces[0].providerPayload = { leak: true };
    metrics.traces[0].impactPreview = { leak: true };
    metrics.security.exposesPrompt = true;

    expect(validatePolicyBuilderPhase7RuntimeMetricsTrace(metrics).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
        }),
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.PROMPT_EXPOSED,
        }),
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.EMBEDDING_EXPOSED,
        }),
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.PROVIDER_PAYLOAD_EXPOSED,
        }),
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.DIAGNOSTIC_INTERNAL_EXPOSED,
        }),
      ]));
  });

  test('rejects non-actionable operator summaries and trace summary mismatch', () => {
    const metrics = buildPolicyBuilderPhase7RuntimeMetricsTrace({
      automationDecisions: [
        { stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY },
      ],
    });
    metrics.operatorSummaries.push({
      actionId: '',
      label: '',
    });
    metrics.traceSummary.emittedTraceCount = 99;

    expect(validatePolicyBuilderPhase7RuntimeMetricsTrace(metrics).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.OPERATOR_SUMMARY_NOT_ACTIONABLE,
        }),
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.TRACE_OVERFLOW,
        }),
      ]));
  });

  test('rejects malformed or mismatched source fingerprints in traces', () => {
    const malformed = buildPolicyBuilderPhase7RuntimeMetricsTrace({
      automationDecisions: [
        { stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY },
      ],
    });
    malformed.traces[0].sourceFingerprint = {
      attributeId: 'classifarr.runtime.decision.evidence_projection_fingerprint',
      fingerprint: 'not-a-sha256',
    };
    malformed.traces[0].attributes['classifarr.phase7r.trace.source_fingerprint'] = 'not-a-sha256';
    malformed.traces[0].attributes['classifarr.phase7r.trace.source_fingerprint_attribute'] =
      'classifarr.runtime.decision.evidence_projection_fingerprint';

    const mismatched = buildPolicyBuilderPhase7RuntimeMetricsTrace({
      automationDecisions: [
        {
          stateId: PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
          trace: {
            attributes: {
              'classifarr.runtime.decision.evidence_projection_fingerprint': 'a'.repeat(64),
            },
          },
        },
      ],
    });
    mismatched.traces[0].attributes['classifarr.phase7r.trace.source_fingerprint'] = 'b'.repeat(64);

    expect(validatePolicyBuilderPhase7RuntimeMetricsTrace(malformed).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.MALFORMED_SOURCE_FINGERPRINT,
        }),
      ]));
    expect(validatePolicyBuilderPhase7RuntimeMetricsTrace(mismatched).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.TRACE_SOURCE_FINGERPRINT_MISMATCH,
        }),
      ]));
  });

  test('passes component audit and points to runtime and rebuild test reset', () => {
    const metrics = buildPolicyBuilderPhase7RuntimeMetricsTrace({
      requestLearningDecisions: [
        { dispositionId: PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.LEARNING_CANDIDATE },
      ],
    });
    const audit = buildPolicyBuilderPhase7RuntimeMetricsTraceAudit(metrics);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedCounterCount).toBe(Object.keys(PHASE7R_METRIC_COUNTER_IDS).length);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '7r_9',
      label: 'Runtime And Rebuild Test Reset',
    }));
    expect(metrics.traces[0].reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: PHASE7R_METRIC_REASON_IDS.REQUEST_LEARNING_COUNTED,
      }),
    ]));
  });
});
