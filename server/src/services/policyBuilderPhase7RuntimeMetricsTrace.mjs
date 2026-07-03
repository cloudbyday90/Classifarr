import { createHash } from 'node:crypto';

import {
  PHASE7R_AUTOMATION_DECISION_STATE_IDS,
} from './policyBuilderPhase7AutomationDecisionContract.mjs';
import {
  PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS,
} from './policyBuilderPhase7RuntimeQuestionReduction.mjs';
import {
  PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS,
} from './policyBuilderPhase7RequestTimeLearning.mjs';
import {
  PHASE7R_REBUILD_PROPOSAL_STATUS_IDS,
} from './policyBuilderPhase7LibraryPolicyRebuild.mjs';
import {
  PHASE7R_MIGRATION_VERIFIER_STATUS_IDS,
} from './policyBuilderPhase7MigrationVerifierRollback.mjs';

const PHASE7R_METRIC_COUNTER_IDS = Object.freeze({
  AUTO_ROUTED: 'auto_routed',
  CLASSIFIED_NOT_ROUTED: 'classified_not_routed',
  ASKED_FOR_REVIEW: 'asked_for_review',
  BLOCKED_BY_HARD_LIMIT: 'blocked_by_hard_limit',
  MISSING_ROUTING: 'missing_routing',
  STALE_PROFILE_RETRY: 'stale_profile_retry',
  LEARNING_ALLOWED: 'learning_allowed',
  LEARNING_BLOCKED: 'learning_blocked',
  LEARNING_DOWNGRADED: 'learning_downgraded',
  REBUILD_ACCEPTED: 'rebuild_accepted',
  REBUILD_REJECTED: 'rebuild_rejected',
  REBUILD_ROLLED_BACK: 'rebuild_rolled_back',
});

const PHASE7R_METRIC_COMPONENT_IDS = Object.freeze({
  AUTOMATION_DECISION: 'automation_decision',
  QUESTION_REDUCTION: 'question_reduction',
  REQUEST_LEARNING: 'request_learning',
  REBUILD_PROPOSAL: 'rebuild_proposal',
  MIGRATION_VERIFIER: 'migration_verifier',
  REBUILD_EVENT: 'rebuild_event',
});

const PHASE7R_REBUILD_EVENT_STATUS_IDS = Object.freeze({
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  ROLLED_BACK: 'rolled_back',
});

const PHASE7R_METRIC_REASON_IDS = Object.freeze({
  AUTOMATION_DECISION_COUNTED: 'automation_decision_counted',
  QUESTION_DISPOSITION_COUNTED: 'question_disposition_counted',
  REQUEST_LEARNING_COUNTED: 'request_learning_counted',
  REBUILD_PROPOSAL_COUNTED: 'rebuild_proposal_counted',
  MIGRATION_VERIFIER_COUNTED: 'migration_verifier_counted',
  REBUILD_EVENT_COUNTED: 'rebuild_event_counted',
  RAW_PAYLOAD_SUPPRESSED: 'raw_payload_suppressed',
  OPERATOR_SUMMARY_ACTION_ONLY: 'operator_summary_action_only',
});

const PHASE7R_METRIC_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_COUNTER: 'unknown_counter',
  NEGATIVE_COUNTER: 'negative_counter',
  NON_INTEGER_COUNTER: 'non_integer_counter',
  UNKNOWN_COMPONENT: 'unknown_component',
  TRACE_OVERFLOW: 'trace_overflow',
  RAW_PAYLOAD_EXPOSED: 'raw_payload_exposed',
  PROMPT_EXPOSED: 'prompt_exposed',
  EMBEDDING_EXPOSED: 'embedding_exposed',
  PROVIDER_PAYLOAD_EXPOSED: 'provider_payload_exposed',
  DIAGNOSTIC_INTERNAL_EXPOSED: 'diagnostic_internal_exposed',
  MISSING_TRACE_REASON: 'missing_trace_reason',
  OPERATOR_SUMMARY_NOT_ACTIONABLE: 'operator_summary_not_actionable',
  MALFORMED_SOURCE_FINGERPRINT: 'malformed_source_fingerprint',
  TRACE_SOURCE_FINGERPRINT_MISMATCH: 'trace_source_fingerprint_mismatch',
});

const MAX_TRACE_RECORDS_DEFAULT = 50;
const MAX_TRACE_REASONS = 12;
const SOURCE_FINGERPRINT_TRACE_ATTRIBUTE = 'classifarr.phase7r.trace.source_fingerprint';
const SOURCE_FINGERPRINT_ATTRIBUTE_TRACE_ATTRIBUTE =
  'classifarr.phase7r.trace.source_fingerprint_attribute';
const REBUILD_GUARDED_OUTCOME_FINGERPRINT_SET_ATTRIBUTE =
  'classifarr.policy.rebuild.guarded_outcome_fingerprint_set';
const REBUILD_GUARDED_OUTCOME_FINGERPRINT_SET_VERSION =
  'phase7r.rebuild_guarded_outcome_fingerprint_set.v1';
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const COUNTER_IDS = Object.freeze(Object.values(PHASE7R_METRIC_COUNTER_IDS));
const COMPONENT_IDS = Object.freeze(Object.values(PHASE7R_METRIC_COMPONENT_IDS));
const SOURCE_FINGERPRINT_ATTRIBUTE_IDS = Object.freeze([
  'classifarr.runtime.decision.evidence_projection_fingerprint',
  'classifarr.runtime.question.decision_evidence_projection_fingerprint',
  'classifarr.runtime.request_learning.upstream_evidence_fingerprint',
  REBUILD_GUARDED_OUTCOME_FINGERPRINT_SET_ATTRIBUTE,
  'classifarr.policy.migration_verifier.sample_set_fingerprint',
]);
const DIAGNOSTIC_KEYS = Object.freeze([
  'impactPreview',
  'replayPreview',
  'replayParity',
  'providerReadiness',
  'tmdbCoverage',
  'rawScoring',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asSafeCount(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((normalized, key) => {
      const child = stableValue(value[key]);
      if (child !== undefined) {
        normalized[key] = child;
      }
      return normalized;
    }, {});
}

function sha256(value) {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function createEmptyCounters() {
  return Object.fromEntries(COUNTER_IDS.map(counterId => [counterId, 0]));
}

function increment(counters, counterId, amount = 1) {
  if (!COUNTER_IDS.includes(counterId)) return;
  counters[counterId] += amount;
}

function hasOwnKeyDeep(value, keys) {
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(([key, child]) =>
    keys.includes(key) || hasOwnKeyDeep(child, keys)
  );
}

function sensitiveReasonForEvent(event = {}) {
  if (hasOwnKeyDeep(event, ['prompt', 'systemPrompt', 'userPrompt'])) {
    return PHASE7R_METRIC_AUDIT_RISK_IDS.PROMPT_EXPOSED;
  }
  if (hasOwnKeyDeep(event, ['embedding', 'embeddings', 'vector'])) {
    return PHASE7R_METRIC_AUDIT_RISK_IDS.EMBEDDING_EXPOSED;
  }
  if (hasOwnKeyDeep(event, ['providerPayload'])) {
    return PHASE7R_METRIC_AUDIT_RISK_IDS.PROVIDER_PAYLOAD_EXPOSED;
  }
  if (hasOwnKeyDeep(event, ['raw', 'rawPayload', 'payload'])) {
    return PHASE7R_METRIC_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED;
  }
  if (hasOwnKeyDeep(event, DIAGNOSTIC_KEYS)) {
    return PHASE7R_METRIC_AUDIT_RISK_IDS.DIAGNOSTIC_INTERNAL_EXPOSED;
  }
  return null;
}

function getTraceReasons(source = {}, fallbackReasonId) {
  const sourceReasons = asArray(source.trace?.reasons)
    .map(reason => normalizeString(reason?.reasonId))
    .filter(Boolean);
  const reasons = sourceReasons.length > 0 ? sourceReasons : [fallbackReasonId];

  return reasons.slice(0, MAX_TRACE_REASONS).map(reasonId => ({
    reasonId,
    severity: 'info',
  }));
}

function getSourceFingerprint(source = {}) {
  const attributes = asObject(source.trace?.attributes);
  const attributeId = SOURCE_FINGERPRINT_ATTRIBUTE_IDS
    .find(candidate => SHA256_FINGERPRINT_PATTERN.test(
      normalizeString(attributes[candidate]).toLowerCase()
    ));

  if (!attributeId) return null;

  return {
    attributeId,
    fingerprint: normalizeString(attributes[attributeId]).toLowerCase(),
  };
}

function getRebuildSourceFingerprint(source = {}) {
  const guardedOutcomes = asObject(source.evidenceSourceSummary?.guardedOutcomes);
  const fingerprints = asArray(guardedOutcomes.fingerprints)
    .map(fingerprint => normalizeString(fingerprint).toLowerCase())
    .filter(fingerprint => SHA256_FINGERPRINT_PATTERN.test(fingerprint))
    .sort();

  if (fingerprints.length === 0) return null;

  return {
    attributeId: REBUILD_GUARDED_OUTCOME_FINGERPRINT_SET_ATTRIBUTE,
    fingerprint: sha256({
      version: REBUILD_GUARDED_OUTCOME_FINGERPRINT_SET_VERSION,
      fingerprintCount: asSafeCount(guardedOutcomes.fingerprintCount, fingerprints.length),
      missingFingerprintCount: asSafeCount(guardedOutcomes.missingFingerprintCount),
      requestProofCount: asSafeCount(guardedOutcomes.requestProofCount),
      missingRequestProofCount: asSafeCount(guardedOutcomes.missingRequestProofCount),
      invalidRequestProofCount: asSafeCount(guardedOutcomes.invalidRequestProofCount),
      fingerprints,
    }),
  };
}

function buildTraceRecord({
  componentId,
  source = {},
  outcomeId,
  counterIds = [],
  fallbackReasonId,
}) {
  const reasonRecords = getTraceReasons(source, fallbackReasonId);
  const sensitiveRiskId = sensitiveReasonForEvent(source);
  const sourceFingerprint = getSourceFingerprint(source) || getRebuildSourceFingerprint(source);
  const attributes = {
    'classifarr.phase7r.trace.version': 'phase7r.runtime_metrics_trace.v1',
    'classifarr.phase7r.trace.component': componentId,
    'classifarr.phase7r.trace.outcome': normalizeString(outcomeId),
    'classifarr.phase7r.trace.reason_count': reasonRecords.length,
    'classifarr.phase7r.trace.sensitive_suppressed': Boolean(sensitiveRiskId),
  };

  if (sourceFingerprint) {
    attributes[SOURCE_FINGERPRINT_TRACE_ATTRIBUTE] = sourceFingerprint.fingerprint;
    attributes[SOURCE_FINGERPRINT_ATTRIBUTE_TRACE_ATTRIBUTE] = sourceFingerprint.attributeId;
  }

  return {
    componentId,
    outcomeId: normalizeString(outcomeId),
    counterIds: counterIds.filter(counterId => COUNTER_IDS.includes(counterId)),
    attributes,
    reasons: sensitiveRiskId
      ? [
        ...reasonRecords,
        {
          reasonId: PHASE7R_METRIC_REASON_IDS.RAW_PAYLOAD_SUPPRESSED,
          severity: 'warning',
        },
      ].slice(0, MAX_TRACE_REASONS)
      : reasonRecords,
    sourceFingerprint,
    sensitiveRiskId,
    exposesRawPayload: false,
    exposesPrompt: false,
    exposesEmbedding: false,
    exposesProviderPayload: false,
    exposesDiagnosticInternal: false,
  };
}

function processAutomationDecision(counters, traces, decision = {}) {
  const stateId = decision.stateId;
  const counterIds = [];

  switch (stateId) {
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY:
      counterIds.push(PHASE7R_METRIC_COUNTER_IDS.AUTO_ROUTED);
      break;
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED:
      counterIds.push(PHASE7R_METRIC_COUNTER_IDS.CLASSIFIED_NOT_ROUTED);
      break;
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW:
      counterIds.push(PHASE7R_METRIC_COUNTER_IDS.ASKED_FOR_REVIEW);
      break;
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT:
      counterIds.push(PHASE7R_METRIC_COUNTER_IDS.BLOCKED_BY_HARD_LIMIT);
      break;
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING:
      counterIds.push(PHASE7R_METRIC_COUNTER_IDS.MISSING_ROUTING);
      break;
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY:
      counterIds.push(PHASE7R_METRIC_COUNTER_IDS.STALE_PROFILE_RETRY);
      break;
    default:
      break;
  }

  counterIds.forEach(counterId => increment(counters, counterId));
  traces.push(buildTraceRecord({
    componentId: PHASE7R_METRIC_COMPONENT_IDS.AUTOMATION_DECISION,
    source: decision,
    outcomeId: stateId,
    counterIds,
    fallbackReasonId: PHASE7R_METRIC_REASON_IDS.AUTOMATION_DECISION_COUNTED,
  }));
}

function processQuestionReduction(counters, traces, plan = {}) {
  const counterIds = [];

  if (plan.dispositionId === PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION) {
    counterIds.push(PHASE7R_METRIC_COUNTER_IDS.ASKED_FOR_REVIEW);
  }
  if (plan.dispositionId === PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.CONFIGURE_ROUTING) {
    counterIds.push(PHASE7R_METRIC_COUNTER_IDS.MISSING_ROUTING);
  }
  if (plan.dispositionId === PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.REFRESH_PROFILE) {
    counterIds.push(PHASE7R_METRIC_COUNTER_IDS.STALE_PROFILE_RETRY);
  }
  if (plan.dispositionId === PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.BLOCK_AUTOMATION) {
    counterIds.push(PHASE7R_METRIC_COUNTER_IDS.BLOCKED_BY_HARD_LIMIT);
  }

  counterIds.forEach(counterId => increment(counters, counterId));
  traces.push(buildTraceRecord({
    componentId: PHASE7R_METRIC_COMPONENT_IDS.QUESTION_REDUCTION,
    source: plan,
    outcomeId: plan.dispositionId,
    counterIds,
    fallbackReasonId: PHASE7R_METRIC_REASON_IDS.QUESTION_DISPOSITION_COUNTED,
  }));
}

function processRequestLearning(counters, traces, decision = {}) {
  const counterIds = [];

  switch (decision.dispositionId) {
    case PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.LEARNING_CANDIDATE:
      counterIds.push(PHASE7R_METRIC_COUNTER_IDS.LEARNING_ALLOWED);
      break;
    case PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.BLOCKED:
    case PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.POLICY_EDIT_REQUIRED:
      counterIds.push(PHASE7R_METRIC_COUNTER_IDS.LEARNING_BLOCKED);
      break;
    case PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.OUTCOME_ONLY:
    case PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.ROUTE_FAILURE_ONLY:
      counterIds.push(PHASE7R_METRIC_COUNTER_IDS.LEARNING_DOWNGRADED);
      break;
    default:
      break;
  }

  counterIds.forEach(counterId => increment(counters, counterId));
  traces.push(buildTraceRecord({
    componentId: PHASE7R_METRIC_COMPONENT_IDS.REQUEST_LEARNING,
    source: decision,
    outcomeId: decision.dispositionId,
    counterIds,
    fallbackReasonId: PHASE7R_METRIC_REASON_IDS.REQUEST_LEARNING_COUNTED,
  }));
}

function processRebuildProposal(counters, traces, proposal = {}) {
  const accepted = proposal.acceptanceGate?.accepted === true;
  const counterIds = accepted
    ? [PHASE7R_METRIC_COUNTER_IDS.REBUILD_ACCEPTED]
    : proposal.statusId === PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED
      ? [PHASE7R_METRIC_COUNTER_IDS.REBUILD_REJECTED]
      : [];

  counterIds.forEach(counterId => increment(counters, counterId));
  traces.push(buildTraceRecord({
    componentId: PHASE7R_METRIC_COMPONENT_IDS.REBUILD_PROPOSAL,
    source: proposal,
    outcomeId: accepted ? PHASE7R_REBUILD_EVENT_STATUS_IDS.ACCEPTED : proposal.statusId,
    counterIds,
    fallbackReasonId: PHASE7R_METRIC_REASON_IDS.REBUILD_PROPOSAL_COUNTED,
  }));
}

function processMigrationVerifier(counters, traces, report = {}) {
  const counterIds = [];

  if (report.applicationGate?.operatorAccepted === true) {
    counterIds.push(PHASE7R_METRIC_COUNTER_IDS.REBUILD_ACCEPTED);
  }
  if (report.statusId === PHASE7R_MIGRATION_VERIFIER_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK) {
    counterIds.push(PHASE7R_METRIC_COUNTER_IDS.REBUILD_REJECTED);
  }

  counterIds.forEach(counterId => increment(counters, counterId));
  traces.push(buildTraceRecord({
    componentId: PHASE7R_METRIC_COMPONENT_IDS.MIGRATION_VERIFIER,
    source: report,
    outcomeId: report.statusId,
    counterIds,
    fallbackReasonId: PHASE7R_METRIC_REASON_IDS.MIGRATION_VERIFIER_COUNTED,
  }));
}

function processRebuildEvent(counters, traces, event = {}) {
  const statusId = normalizeString(event.statusId ?? event.status);
  const counterIds = [];

  if (statusId === PHASE7R_REBUILD_EVENT_STATUS_IDS.ACCEPTED) {
    counterIds.push(PHASE7R_METRIC_COUNTER_IDS.REBUILD_ACCEPTED);
  }
  if (statusId === PHASE7R_REBUILD_EVENT_STATUS_IDS.REJECTED) {
    counterIds.push(PHASE7R_METRIC_COUNTER_IDS.REBUILD_REJECTED);
  }
  if (statusId === PHASE7R_REBUILD_EVENT_STATUS_IDS.ROLLED_BACK) {
    counterIds.push(PHASE7R_METRIC_COUNTER_IDS.REBUILD_ROLLED_BACK);
  }

  counterIds.forEach(counterId => increment(counters, counterId));
  traces.push(buildTraceRecord({
    componentId: PHASE7R_METRIC_COMPONENT_IDS.REBUILD_EVENT,
    source: event,
    outcomeId: statusId,
    counterIds,
    fallbackReasonId: PHASE7R_METRIC_REASON_IDS.REBUILD_EVENT_COUNTED,
  }));
}

function buildOperatorSummary(counters) {
  const summaries = [];

  if (counters[PHASE7R_METRIC_COUNTER_IDS.MISSING_ROUTING] > 0) {
    summaries.push({
      actionId: 'configure_routing',
      label: 'Configure routing for destinations that cannot route yet.',
      counterId: PHASE7R_METRIC_COUNTER_IDS.MISSING_ROUTING,
    });
  }
  if (counters[PHASE7R_METRIC_COUNTER_IDS.ASKED_FOR_REVIEW] > 0) {
    summaries.push({
      actionId: 'review_pending_items',
      label: 'Review pending items that need operator confirmation.',
      counterId: PHASE7R_METRIC_COUNTER_IDS.ASKED_FOR_REVIEW,
    });
  }
  if (counters[PHASE7R_METRIC_COUNTER_IDS.STALE_PROFILE_RETRY] > 0) {
    summaries.push({
      actionId: 'refresh_profile',
      label: 'Refresh stale library profiles before trusting automation.',
      counterId: PHASE7R_METRIC_COUNTER_IDS.STALE_PROFILE_RETRY,
    });
  }
  if (counters[PHASE7R_METRIC_COUNTER_IDS.REBUILD_REJECTED] > 0) {
    summaries.push({
      actionId: 'review_rebuild_verifier',
      label: 'Review rebuild verifier blockers before replacement.',
      counterId: PHASE7R_METRIC_COUNTER_IDS.REBUILD_REJECTED,
    });
  }

  if (summaries.length === 0) {
    summaries.push({
      actionId: 'no_action_required',
      label: 'No operator action is required from the current Phase 7R metrics.',
      counterId: null,
    });
  }

  return summaries;
}

function buildPolicyBuilderPhase7RuntimeMetricsTrace(input = {}) {
  const counters = createEmptyCounters();
  const traces = [];
  const maxTraceRecords = Number.isFinite(Number(input.maxTraceRecords))
    ? Math.max(1, Math.trunc(Number(input.maxTraceRecords)))
    : MAX_TRACE_RECORDS_DEFAULT;

  asArray(input.automationDecisions).forEach(decision =>
    processAutomationDecision(counters, traces, decision)
  );
  asArray(input.questionReductions).forEach(plan =>
    processQuestionReduction(counters, traces, plan)
  );
  asArray(input.requestLearningDecisions).forEach(decision =>
    processRequestLearning(counters, traces, decision)
  );
  asArray(input.rebuildProposals).forEach(proposal =>
    processRebuildProposal(counters, traces, proposal)
  );
  asArray(input.migrationVerifierReports).forEach(report =>
    processMigrationVerifier(counters, traces, report)
  );
  asArray(input.rebuildEvents).forEach(event =>
    processRebuildEvent(counters, traces, event)
  );

  const boundedTraces = traces.slice(0, maxTraceRecords);

  return {
    version: 'phase7r.runtime_metrics_trace.v1',
    counters,
    traceSummary: {
      totalTraceCount: traces.length,
      emittedTraceCount: boundedTraces.length,
      truncated: traces.length > boundedTraces.length,
      maxTraceRecords,
    },
    traces: boundedTraces,
    operatorSummaries: buildOperatorSummary(counters),
    security: {
      exposesRawPayload: false,
      exposesPrompt: false,
      exposesEmbedding: false,
      exposesProviderPayload: false,
      exposesDiagnosticInternal: false,
      rawPayloadSuppressionCount: traces.filter(trace => trace.sensitiveRiskId).length,
    },
  };
}

function validatePolicyBuilderPhase7RuntimeMetricsTrace(metrics = {}) {
  const issues = [];
  const counters = asObject(metrics.counters);

  Object.entries(counters).forEach(([counterId, value]) => {
    if (!COUNTER_IDS.includes(counterId)) {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.UNKNOWN_COUNTER,
        message: `Unknown Phase 7R metric counter "${counterId}".`,
      });
    }
    if (!Number.isInteger(value)) {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.NON_INTEGER_COUNTER,
        message: `Metric counter "${counterId}" must be an integer.`,
      });
    }
    if (Number(value) < 0) {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.NEGATIVE_COUNTER,
        message: `Metric counter "${counterId}" cannot be negative.`,
      });
    }
  });

  COUNTER_IDS
    .filter(counterId => !Object.prototype.hasOwnProperty.call(counters, counterId))
    .forEach(counterId => {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.UNKNOWN_COUNTER,
        message: `Metric report is missing required counter "${counterId}".`,
      });
    });

  if (asArray(metrics.traces).length !== Number(metrics.traceSummary?.emittedTraceCount)) {
    issues.push({
      riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.TRACE_OVERFLOW,
      message: 'Trace summary must match emitted trace count.',
    });
  }
  if (Number(metrics.traceSummary?.emittedTraceCount) > Number(metrics.traceSummary?.maxTraceRecords)) {
    issues.push({
      riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.TRACE_OVERFLOW,
      message: 'Metric traces must be bounded by maxTraceRecords.',
    });
  }

  asArray(metrics.traces).forEach(trace => {
    if (!COMPONENT_IDS.includes(trace.componentId)) {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.UNKNOWN_COMPONENT,
        message: `Unknown Phase 7R trace component "${trace.componentId}".`,
      });
    }

    if (asArray(trace.reasons).length === 0) {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
        message: 'Each Phase 7R trace must include bounded reason codes.',
      });
    }

    const sourceFingerprint = asObject(trace.sourceFingerprint);
    const sourceFingerprintValue = normalizeString(sourceFingerprint.fingerprint).toLowerCase();
    const sourceFingerprintAttribute = normalizeString(sourceFingerprint.attributeId);
    const traceFingerprintValue = normalizeString(
      trace.attributes?.[SOURCE_FINGERPRINT_TRACE_ATTRIBUTE]
    ).toLowerCase();
    const traceFingerprintAttribute = normalizeString(
      trace.attributes?.[SOURCE_FINGERPRINT_ATTRIBUTE_TRACE_ATTRIBUTE]
    );

    if (sourceFingerprintValue || traceFingerprintValue) {
      if (
        !SHA256_FINGERPRINT_PATTERN.test(sourceFingerprintValue) ||
        !SOURCE_FINGERPRINT_ATTRIBUTE_IDS.includes(sourceFingerprintAttribute)
      ) {
        issues.push({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.MALFORMED_SOURCE_FINGERPRINT,
          message: 'Metric trace source fingerprint must be a supported SHA-256 digest and known source attribute.',
        });
      }

      if (
        traceFingerprintValue !== sourceFingerprintValue ||
        traceFingerprintAttribute !== sourceFingerprintAttribute
      ) {
        issues.push({
          riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.TRACE_SOURCE_FINGERPRINT_MISMATCH,
          message: 'Metric trace source fingerprint attributes must match the trace source fingerprint.',
        });
      }
    }

    if (trace.exposesRawPayload === true || hasOwnKeyDeep(trace, ['raw', 'rawPayload', 'payload'])) {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
        message: 'Metric traces must not expose raw payloads.',
      });
    }
    if (trace.exposesPrompt === true || hasOwnKeyDeep(trace, ['prompt', 'systemPrompt', 'userPrompt'])) {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.PROMPT_EXPOSED,
        message: 'Metric traces must not expose prompts.',
      });
    }
    if (trace.exposesEmbedding === true || hasOwnKeyDeep(trace, ['embedding', 'embeddings', 'vector'])) {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.EMBEDDING_EXPOSED,
        message: 'Metric traces must not expose embeddings.',
      });
    }
    if (trace.exposesProviderPayload === true || hasOwnKeyDeep(trace, ['providerPayload'])) {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.PROVIDER_PAYLOAD_EXPOSED,
        message: 'Metric traces must not expose provider payloads.',
      });
    }
    if (trace.exposesDiagnosticInternal === true || hasOwnKeyDeep(trace, DIAGNOSTIC_KEYS)) {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.DIAGNOSTIC_INTERNAL_EXPOSED,
        message: 'Metric traces must not expose diagnostic internals.',
      });
    }
  });

  asArray(metrics.operatorSummaries).forEach(summary => {
    if (!normalizeString(summary.actionId) || !normalizeString(summary.label)) {
      issues.push({
        riskId: PHASE7R_METRIC_AUDIT_RISK_IDS.OPERATOR_SUMMARY_NOT_ACTIONABLE,
        message: 'Operator summaries must be action-oriented.',
      });
    }
  });

  [
    ['exposesRawPayload', PHASE7R_METRIC_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED],
    ['exposesPrompt', PHASE7R_METRIC_AUDIT_RISK_IDS.PROMPT_EXPOSED],
    ['exposesEmbedding', PHASE7R_METRIC_AUDIT_RISK_IDS.EMBEDDING_EXPOSED],
    ['exposesProviderPayload', PHASE7R_METRIC_AUDIT_RISK_IDS.PROVIDER_PAYLOAD_EXPOSED],
    ['exposesDiagnosticInternal', PHASE7R_METRIC_AUDIT_RISK_IDS.DIAGNOSTIC_INTERNAL_EXPOSED],
  ].forEach(([key, riskId]) => {
    if (metrics.security?.[key] === true) {
      issues.push({
        riskId,
        message: `Metric report security flag "${key}" must remain false.`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyBuilderPhase7RuntimeMetricsTraceAudit(
  metrics = buildPolicyBuilderPhase7RuntimeMetricsTrace()
) {
  const validation = validatePolicyBuilderPhase7RuntimeMetricsTrace(metrics);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedCounterCount: COUNTER_IDS.length,
    checkedTraceCount: asArray(metrics.traces).length,
    validation,
    nextPhase: {
      phaseId: '7r_9',
      label: 'Runtime And Rebuild Test Reset',
      reason: 'Runtime metrics and traces now expose bounded counters and reason codes, so the remaining Phase 7R work is resetting tests around the new runtime/rebuild behavior.',
    },
  };
}

export {
  PHASE7R_METRIC_AUDIT_RISK_IDS,
  PHASE7R_METRIC_COMPONENT_IDS,
  PHASE7R_METRIC_COUNTER_IDS,
  PHASE7R_METRIC_REASON_IDS,
  PHASE7R_REBUILD_EVENT_STATUS_IDS,
  buildPolicyBuilderPhase7RuntimeMetricsTrace,
  buildPolicyBuilderPhase7RuntimeMetricsTraceAudit,
  validatePolicyBuilderPhase7RuntimeMetricsTrace,
};
