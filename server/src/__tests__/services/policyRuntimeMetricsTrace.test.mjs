import {
  POLICY_AUTOMATION_DECISION_STATE_IDS,
} from '../../services/policyAutomationDecisionContract.mjs';
import {
  POLICY_RUNTIME_QUESTION_DISPOSITION_IDS,
} from '../../services/policyRuntimeQuestionReduction.mjs';
import {
  POLICY_REQUEST_LEARNING_DISPOSITION_IDS,
} from '../../services/policyRequestTimeLearning.mjs';
import {
  POLICY_REBUILD_PROPOSAL_STATUS_IDS,
} from '../../services/policyLibraryPolicyRebuild.mjs';
import {
  POLICY_MIGRATION_VERIFIER_STATUS_IDS,
} from '../../services/policyMigrationVerifierRollback.mjs';
import {
  POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS,
  POLICY_RUNTIME_METRIC_COMPONENT_IDS,
  POLICY_RUNTIME_METRIC_COUNTER_IDS,
  POLICY_RUNTIME_METRIC_REASON_IDS,
  POLICY_REBUILD_EVENT_STATUS_IDS,
  buildPolicyRuntimeMetricsTrace,
  buildPolicyRuntimeMetricsTraceAudit,
  validatePolicyRuntimeMetricsTrace,
} from '../../services/policyRuntimeMetricsTrace.mjs';

describe('policyRuntimeMetricsTrace', () => {
  test('counts Phase 7R automation, question, learning, rebuild, and migration outcomes', () => {
    const metrics = buildPolicyRuntimeMetricsTrace({
      automationDecisions: [
        { stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY },
        { stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED },
        { stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW },
        { stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT },
        { stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING },
        { stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY },
      ],
      questionReductions: [
        { dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION },
        { dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CONFIGURE_ROUTING },
        { dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.REFRESH_PROFILE },
      ],
      requestLearningDecisions: [
        { dispositionId: POLICY_REQUEST_LEARNING_DISPOSITION_IDS.LEARNING_CANDIDATE },
        { dispositionId: POLICY_REQUEST_LEARNING_DISPOSITION_IDS.BLOCKED },
        { dispositionId: POLICY_REQUEST_LEARNING_DISPOSITION_IDS.OUTCOME_ONLY },
        { dispositionId: POLICY_REQUEST_LEARNING_DISPOSITION_IDS.ROUTE_FAILURE_ONLY },
      ],
      rebuildProposals: [
        {
          statusId: POLICY_REBUILD_PROPOSAL_STATUS_IDS.READY_FOR_REVIEW,
          acceptanceGate: {
            accepted: true,
          },
        },
        {
          statusId: POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED,
          acceptanceGate: {
            accepted: false,
          },
        },
      ],
      migrationVerifierReports: [
        {
          statusId: POLICY_MIGRATION_VERIFIER_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK,
          applicationGate: {
            operatorAccepted: true,
          },
        },
      ],
      rebuildEvents: [
        { statusId: POLICY_REBUILD_EVENT_STATUS_IDS.ROLLED_BACK },
      ],
    });

    expect(metrics.counters).toEqual(expect.objectContaining({
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.AUTO_ROUTED]: 1,
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.CLASSIFIED_NOT_ROUTED]: 1,
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.ASKED_FOR_REVIEW]: 2,
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.BLOCKED_BY_HARD_LIMIT]: 1,
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.MISSING_ROUTING]: 2,
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.STALE_PROFILE_RETRY]: 2,
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.LEARNING_ALLOWED]: 1,
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.LEARNING_BLOCKED]: 1,
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.LEARNING_DOWNGRADED]: 2,
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.REBUILD_ACCEPTED]: 2,
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.REBUILD_REJECTED]: 2,
      [POLICY_RUNTIME_METRIC_COUNTER_IDS.REBUILD_ROLLED_BACK]: 1,
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
    expect(validatePolicyRuntimeMetricsTrace(metrics).ok).toBe(true);
  });

  test('bounds trace records and suppresses raw payload, prompts, embeddings, and diagnostics', () => {
    const metrics = buildPolicyRuntimeMetricsTrace({
      maxTraceRecords: 2,
      automationDecisions: [
        {
          stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
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
          stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
          prompt: 'do not expose',
        },
        {
          stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE,
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
      expect(trace.attributes['classifarr.policy.runtime_metrics_trace.sensitive_suppressed']).toBe(true);
      expect(JSON.stringify(trace)).not.toContain('do not expose');
      expect(trace.rawPayload).toBeUndefined();
      expect(trace.prompt).toBeUndefined();
      expect(trace.embedding).toBeUndefined();
    });
    expect(validatePolicyRuntimeMetricsTrace(metrics).ok).toBe(true);
  });

  test('emits stable component ids and bounded reason codes', () => {
    const metrics = buildPolicyRuntimeMetricsTrace({
      automationDecisions: [
        {
          stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
          trace: {
            reasons: Array.from({ length: 20 }, (_, index) => ({
              reasonId: `reason_${index}`,
            })),
          },
        },
      ],
    });

    expect(metrics.traces[0]).toEqual(expect.objectContaining({
      componentId: POLICY_RUNTIME_METRIC_COMPONENT_IDS.AUTOMATION_DECISION,
      outcomeId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
      counterIds: [POLICY_RUNTIME_METRIC_COUNTER_IDS.AUTO_ROUTED],
    }));
    expect(metrics.traces[0].reasons).toHaveLength(12);
    expect(metrics.traces[0].attributes).toEqual(expect.objectContaining({
      'classifarr.policy.runtime_metrics_trace.version': 'policy.runtime_metrics_trace.v1',
      'classifarr.policy.runtime_metrics_trace.component': POLICY_RUNTIME_METRIC_COMPONENT_IDS.AUTOMATION_DECISION,
    }));
    expect(validatePolicyRuntimeMetricsTrace(metrics).ok).toBe(true);
  });

  test('carries supported upstream source fingerprints into bounded trace attributes', () => {
    const metrics = buildPolicyRuntimeMetricsTrace({
      automationDecisions: [
        {
          stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
          trace: {
            attributes: {
              'classifarr.runtime.decision.evidence_projection_fingerprint': 'a'.repeat(64),
            },
          },
        },
      ],
      questionReductions: [
        {
          dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
          trace: {
            attributes: {
              'classifarr.runtime.question.decision_evidence_projection_fingerprint': 'b'.repeat(64),
            },
          },
        },
      ],
      requestLearningDecisions: [
        {
          dispositionId: POLICY_REQUEST_LEARNING_DISPOSITION_IDS.LEARNING_CANDIDATE,
          trace: {
            attributes: {
              'classifarr.runtime.request_learning.upstream_evidence_fingerprint': 'c'.repeat(64),
            },
          },
        },
      ],
      rebuildProposals: [
        {
          statusId: POLICY_REBUILD_PROPOSAL_STATUS_IDS.READY_FOR_REVIEW,
          evidenceSourceSummary: {
            guardedOutcomes: {
              fingerprintCount: 1,
              missingFingerprintCount: 0,
              requestProofCount: 1,
              missingRequestProofCount: 0,
              invalidRequestProofCount: 0,
              fingerprints: ['e'.repeat(64)],
            },
          },
        },
      ],
      migrationVerifierReports: [
        {
          statusId: POLICY_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES,
          trace: {
            attributes: {
              'classifarr.policy.migration_verifier.sample_set_fingerprint': 'd'.repeat(64),
            },
          },
        },
      ],
    });

    expect(metrics.traces.map(trace => trace.sourceFingerprint?.attributeId))
      .toEqual([
        'classifarr.runtime.decision.evidence_projection_fingerprint',
        'classifarr.runtime.question.decision_evidence_projection_fingerprint',
        'classifarr.runtime.request_learning.upstream_evidence_fingerprint',
        'classifarr.policy.rebuild.guarded_outcome_fingerprint_set',
        'classifarr.policy.migration_verifier.sample_set_fingerprint',
      ]);
    expect(metrics.traces.map(trace => trace.sourceFingerprint?.fingerprint))
      .toEqual([
        'a'.repeat(64),
        'b'.repeat(64),
        'c'.repeat(64),
        expect.stringMatching(/^[a-f0-9]{64}$/u),
        'd'.repeat(64),
      ]);
    expect(metrics.traces[3].sourceFingerprint.fingerprint).not.toBe('e'.repeat(64));
    expect(metrics.traces[0].attributes).toEqual(expect.objectContaining({
      'classifarr.policy.runtime_metrics_trace.source_fingerprint': 'a'.repeat(64),
      'classifarr.policy.runtime_metrics_trace.source_fingerprint_attribute':
        'classifarr.runtime.decision.evidence_projection_fingerprint',
    }));
    expect(metrics.traces[3].attributes).toEqual(expect.objectContaining({
      'classifarr.policy.runtime_metrics_trace.source_fingerprint':
        metrics.traces[3].sourceFingerprint.fingerprint,
      'classifarr.policy.runtime_metrics_trace.source_fingerprint_attribute':
        'classifarr.policy.rebuild.guarded_outcome_fingerprint_set',
    }));
    expect(JSON.stringify(metrics.traces)).not.toContain('Mulan');
    expect(validatePolicyRuntimeMetricsTrace(metrics).ok).toBe(true);
  });

  test('defaults to an action-oriented no-action summary when no counters require operator work', () => {
    const metrics = buildPolicyRuntimeMetricsTrace();

    expect(metrics.operatorSummaries).toEqual([
      {
        actionId: 'no_action_required',
        label: 'No operator action is required from the current Phase 7R metrics.',
        counterId: null,
      },
    ]);
    expect(validatePolicyRuntimeMetricsTrace(metrics).ok).toBe(true);
  });

  test('rejects unknown, negative, or non-integer counters', () => {
    const metrics = buildPolicyRuntimeMetricsTrace();
    metrics.counters.unknown_counter = 1;
    metrics.counters[POLICY_RUNTIME_METRIC_COUNTER_IDS.AUTO_ROUTED] = -1;
    metrics.counters[POLICY_RUNTIME_METRIC_COUNTER_IDS.MISSING_ROUTING] = 1.2;

    expect(validatePolicyRuntimeMetricsTrace(metrics).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.UNKNOWN_COUNTER,
        }),
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.NEGATIVE_COUNTER,
        }),
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.NON_INTEGER_COUNTER,
        }),
      ]));
  });

  test('rejects traces that expose raw payloads, prompts, embeddings, providers, or diagnostics', () => {
    const metrics = buildPolicyRuntimeMetricsTrace({
      automationDecisions: [
        { stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY },
      ],
    });
    metrics.traces[0].rawPayload = { leak: true };
    metrics.traces[0].prompt = 'leak';
    metrics.traces[0].embedding = [1, 2, 3];
    metrics.traces[0].providerPayload = { leak: true };
    metrics.traces[0].impactPreview = { leak: true };
    metrics.security.exposesPrompt = true;

    expect(validatePolicyRuntimeMetricsTrace(metrics).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
        }),
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.PROMPT_EXPOSED,
        }),
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.EMBEDDING_EXPOSED,
        }),
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.PROVIDER_PAYLOAD_EXPOSED,
        }),
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.DIAGNOSTIC_INTERNAL_EXPOSED,
        }),
      ]));
  });

  test('rejects non-actionable operator summaries and trace summary mismatch', () => {
    const metrics = buildPolicyRuntimeMetricsTrace({
      automationDecisions: [
        { stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY },
      ],
    });
    metrics.operatorSummaries.push({
      actionId: '',
      label: '',
    });
    metrics.traceSummary.emittedTraceCount = 99;

    expect(validatePolicyRuntimeMetricsTrace(metrics).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.OPERATOR_SUMMARY_NOT_ACTIONABLE,
        }),
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.TRACE_OVERFLOW,
        }),
      ]));
  });

  test('rejects malformed or mismatched source fingerprints in traces', () => {
    const malformed = buildPolicyRuntimeMetricsTrace({
      automationDecisions: [
        { stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY },
      ],
    });
    malformed.traces[0].sourceFingerprint = {
      attributeId: 'classifarr.runtime.decision.evidence_projection_fingerprint',
      fingerprint: 'not-a-sha256',
    };
    malformed.traces[0].attributes['classifarr.policy.runtime_metrics_trace.source_fingerprint'] = 'not-a-sha256';
    malformed.traces[0].attributes['classifarr.policy.runtime_metrics_trace.source_fingerprint_attribute'] =
      'classifarr.runtime.decision.evidence_projection_fingerprint';

    const mismatched = buildPolicyRuntimeMetricsTrace({
      automationDecisions: [
        {
          stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
          trace: {
            attributes: {
              'classifarr.runtime.decision.evidence_projection_fingerprint': 'a'.repeat(64),
            },
          },
        },
      ],
    });
    mismatched.traces[0].attributes['classifarr.policy.runtime_metrics_trace.source_fingerprint'] = 'b'.repeat(64);

    expect(validatePolicyRuntimeMetricsTrace(malformed).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.MALFORMED_SOURCE_FINGERPRINT,
        }),
      ]));
    expect(validatePolicyRuntimeMetricsTrace(mismatched).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.TRACE_SOURCE_FINGERPRINT_MISMATCH,
        }),
      ]));
  });

  test('rejects drifted rebuild proposal source fingerprint traces', () => {
    const metrics = buildPolicyRuntimeMetricsTrace({
      rebuildProposals: [
        {
          statusId: POLICY_REBUILD_PROPOSAL_STATUS_IDS.READY_FOR_REVIEW,
          evidenceSourceSummary: {
            guardedOutcomes: {
              fingerprintCount: 1,
              missingFingerprintCount: 0,
              requestProofCount: 1,
              missingRequestProofCount: 0,
              invalidRequestProofCount: 0,
              fingerprints: ['e'.repeat(64)],
            },
          },
        },
      ],
    });

    expect(metrics.traces[0].sourceFingerprint).toEqual(expect.objectContaining({
      attributeId: 'classifarr.policy.rebuild.guarded_outcome_fingerprint_set',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }));

    metrics.traces[0].attributes['classifarr.policy.runtime_metrics_trace.source_fingerprint'] = 'f'.repeat(64);

    expect(validatePolicyRuntimeMetricsTrace(metrics).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS.TRACE_SOURCE_FINGERPRINT_MISMATCH,
        }),
      ]));
  });

  test('passes component audit and points to runtime and rebuild test reset', () => {
    const metrics = buildPolicyRuntimeMetricsTrace({
      requestLearningDecisions: [
        { dispositionId: POLICY_REQUEST_LEARNING_DISPOSITION_IDS.LEARNING_CANDIDATE },
      ],
    });
    const audit = buildPolicyRuntimeMetricsTraceAudit(metrics);

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedCounterCount).toBe(Object.keys(POLICY_RUNTIME_METRIC_COUNTER_IDS).length);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'runtime_rebuild_test_reset',
      label: 'Runtime And Rebuild Test Reset',
    }));
    expect(metrics.traces[0].reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_RUNTIME_METRIC_REASON_IDS.REQUEST_LEARNING_COUNTED,
      }),
    ]));
  });
});
