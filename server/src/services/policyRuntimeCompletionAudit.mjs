import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildPolicyAutomationDecisionContractAudit,
} from './policyAutomationDecisionContract.mjs';
import {
  buildPolicyEngineCompletionAudit,
} from './policyEngineCompletionAudit.mjs';
import {
  buildPolicyLibraryPolicyRebuildAudit,
} from './policyLibraryPolicyRebuild.mjs';
import {
  buildPolicyLibraryRebuildAcceptanceTransitionAudit,
} from './policyLibraryRebuildAcceptanceTransition.mjs';
import {
  buildPolicyLibraryRebuildReplacementGateAudit,
} from './policyLibraryRebuildReplacementGate.mjs';
import {
  buildPolicyLibraryRebuildSnapshotGateAudit,
} from './policyLibraryRebuildSnapshotGate.mjs';
import {
  buildPolicyMigrationVerifierAudit,
} from './policyMigrationVerifierRollback.mjs';
import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  buildPolicyRequestTimeLearningAudit,
  buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan,
} from './policyRequestTimeLearning.mjs';
import {
  buildPolicyRequestTimeTerminalRouteIntegrationAudit,
} from './policyRequestTimeTerminalRouteIntegrationAudit.mjs';
import {
  buildPolicyRequestTimeEvent,
} from './policyRequestTimeEvent.mjs';
import {
  buildPolicyRuntimeDecisionInventory,
} from './policyRuntimeDecisionInventory.mjs';
import {
  buildPolicyRuntimeEvidenceProjectionAudit,
} from './policyRuntimeEvidenceProjection.mjs';
import {
  buildPolicyRuntimeMetricsTraceAudit,
} from './policyRuntimeMetricsTrace.mjs';
import {
  buildPolicyRuntimeMetricsPersistenceAdmissionAuditFromDefaultMetrics,
} from './policyRuntimeMetricsPersistenceAdmission.mjs';
import {
  buildPolicyRuntimeQuestionReductionFromRuntimeInput,
  buildPolicyRuntimeQuestionReductionAudit,
} from './policyRuntimeQuestionReduction.mjs';
import {
  buildPolicyRuntimeRebuildTestResetAudit,
} from './policyRuntimeRebuildTestReset.mjs';
import {
  buildPolicyStrictConstraintDescriptorAudit,
} from './policyStrictConstraintDescriptor.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const POLICY_RUNTIME_COMPLETION_COMPONENT_IDS = Object.freeze({
  RUNTIME_DECISION_INVENTORY: 'runtime_decision_inventory',
  RUNTIME_EVIDENCE_PROJECTION: 'runtime_evidence_projection',
  AUTOMATION_DECISION_CONTRACT: 'automation_decision_contract',
  RUNTIME_QUESTION_REDUCTION: 'runtime_question_reduction',
  REQUEST_TIME_LEARNING: 'request_time_learning',
  LIBRARY_POLICY_REBUILD: 'library_policy_rebuild',
  LIBRARY_REBUILD_ACCEPTANCE_TRANSITION: 'library_rebuild_acceptance_transition',
  MIGRATION_VERIFIER_ROLLBACK: 'migration_verifier_rollback',
  LIBRARY_REBUILD_SNAPSHOT_GATE: 'library_rebuild_snapshot_gate',
  LIBRARY_REBUILD_REPLACEMENT_GATE: 'library_rebuild_replacement_gate',
  STRICT_CONSTRAINT_DESCRIPTORS: 'strict_constraint_descriptors',
  RUNTIME_METRICS_TRACE: 'runtime_metrics_trace',
  RUNTIME_METRICS_PERSISTENCE_ADMISSION: 'runtime_metrics_persistence_admission',
  RUNTIME_REBUILD_TEST_RESET: 'runtime_rebuild_test_reset',
});

const POLICY_RUNTIME_COMPLETION_SUPPORTING_ARTIFACT_IDS = Object.freeze({
  NATIVE_PENDING_SELECTION: 'native_pending_selection',
  NATIVE_PENDING_ROUTE_OUTCOME: 'native_pending_route_outcome',
  TERMINAL_ROUTE_INTEGRATION_AUDIT: 'terminal_route_integration_audit',
  QUEUE_QUESTION_REDUCTION_PRODUCER: 'queue_question_reduction_producer',
});

const POLICY_RUNTIME_COMPLETION_RISK_IDS = Object.freeze({
  MISSING_COMPONENT: 'missing_component',
  MISSING_RECORD_ID: 'missing_record_id',
  MISSING_LABEL: 'missing_label',
  MISSING_EVIDENCE: 'missing_evidence',
  MISSING_DOC_PATH: 'missing_doc_path',
  MISSING_SERVICE_PATH: 'missing_service_path',
  MISSING_TEST_PATH: 'missing_test_path',
  ARTIFACT_PATH_NOT_FOUND: 'artifact_path_not_found',
  MISSING_SUPPORTING_ARTIFACT: 'missing_supporting_artifact',
  DUPLICATE_SUPPORTING_ARTIFACT: 'duplicate_supporting_artifact',
  MISSING_SUPPORTING_ARTIFACT_ID: 'missing_supporting_artifact_id',
  MISSING_SUPPORTING_ARTIFACT_LABEL: 'missing_supporting_artifact_label',
  MISSING_SUPPORTING_ARTIFACT_EVIDENCE: 'missing_supporting_artifact_evidence',
  MISSING_SUPPORTING_ARTIFACT_PATH: 'missing_supporting_artifact_path',
  SUPPORTING_ARTIFACT_PATH_NOT_FOUND: 'supporting_artifact_path_not_found',
  COMPONENT_AUDIT_FAILED: 'component_audit_failed',
  COMPONENT_AUDIT_MISSING: 'component_audit_missing',
  POLICY_ENGINE_COMPLETION_NOT_PASSING: 'policy_engine_completion_not_passing',
  TEST_RESET_CONTRACT_COVERAGE_INCOMPLETE: 'test_reset_contract_coverage_incomplete',
  NEXT_STEP_MISMATCH: 'next_step_mismatch',
});

const REQUIRED_COMPONENT_IDS = Object.freeze(Object.values(POLICY_RUNTIME_COMPLETION_COMPONENT_IDS));

const REQUEST_TIME_LEARNING_SUPPORTING_ARTIFACTS = Object.freeze([
  Object.freeze({
    id: POLICY_RUNTIME_COMPLETION_SUPPORTING_ARTIFACT_IDS.NATIVE_PENDING_SELECTION,
    label: 'Native pending selection provenance',
    evidence: 'Server-validated native selections produce bounded outcome-only provenance before resolution without granting learning or routing authority.',
    docPaths: [
      'docs/architecture/policy-native-pending-resolution-provenance.md',
    ],
    servicePaths: [
      'server/src/services/policyNativePendingResolutionProvenance.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyNativePendingResolutionProvenance.test.mjs',
    ],
  }),
  Object.freeze({
    id: POLICY_RUNTIME_COMPLETION_SUPPORTING_ARTIFACT_IDS.NATIVE_PENDING_ROUTE_OUTCOME,
    label: 'Native pending route outcome',
    evidence: 'Browser and Discord record only admitted terminal native route outcomes after routing returns, without converting route results into learning evidence.',
    docPaths: [
      'docs/architecture/policy-native-pending-route-outcome.md',
    ],
    servicePaths: [
      'server/src/services/policyNativePendingRouteOutcome.mjs',
      'server/src/services/policyNativePendingRouteOutcomePersistence.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyNativePendingRouteOutcome.test.mjs',
      'server/src/__tests__/services/policyNativePendingRouteOutcomePersistence.test.mjs',
    ],
  }),
  Object.freeze({
    id: POLICY_RUNTIME_COMPLETION_SUPPORTING_ARTIFACT_IDS.TERMINAL_ROUTE_INTEGRATION_AUDIT,
    label: 'Terminal request-time route integration audit',
    evidence: 'Every current terminal request-time caller is source-checked for an active guarded proof or explicit outcome-only fallback.',
    docPaths: [
      'docs/architecture/policy-request-time-terminal-route-integration-audit.md',
    ],
    servicePaths: [
      'server/src/services/policyRequestTimeTerminalRouteIntegrationAudit.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyRequestTimeTerminalRouteIntegrationAudit.test.mjs',
    ],
  }),
  Object.freeze({
    id: POLICY_RUNTIME_COMPLETION_SUPPORTING_ARTIFACT_IDS.QUEUE_QUESTION_REDUCTION_PRODUCER,
    label: 'Queue question-reduction producer cutline',
    evidence: 'The live classification queue derives one opaque question-reduction proof from current server-owned evidence and retires direct terminal proof from request/import admission.',
    docPaths: [
      'docs/architecture/policy-runtime-queue-question-reduction-producer.md',
    ],
    servicePaths: [
      'server/src/services/policyRuntimeQueueQuestionReductionProducer.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyRuntimeQueueQuestionReductionProducer.test.mjs',
    ],
  }),
]);

const POLICY_RUNTIME_COMPLETION_COMPONENT_RECORDS = Object.freeze([
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY,
    label: 'Runtime decision inventory and cutline',
    docPath: 'docs/architecture/policy-runtime-decision-inventory-module-cutover.md',
    servicePath: 'server/src/services/policyRuntimeDecisionInventory.mjs',
    testPath: 'server/src/__tests__/services/policyRuntimeDecisionInventory.test.mjs',
    expectedNextStepId: 'runtime_evidence_projection',
    evidence: 'Runtime surfaces are inventoried with authority sources, cutline decisions, and required contract surfaces.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION,
    label: 'Runtime evidence projection',
    docPath: 'docs/architecture/policy-runtime-evidence-projection-module-cutover.md',
    servicePath: 'server/src/services/policyRuntimeEvidenceProjection.mjs',
    testPath: 'server/src/__tests__/services/policyRuntimeEvidenceProjection.test.mjs',
    expectedNextStepId: 'automation_decision_contract',
    evidence: 'Runtime evidence is projected into bounded buckets with sanitized fingerprint proof.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.AUTOMATION_DECISION_CONTRACT,
    label: 'Automation decision contract',
    docPath: 'docs/architecture/policy-automation-decision-contract-module-cutover.md',
    servicePath: 'server/src/services/policyAutomationDecisionContract.mjs',
    testPath: 'server/src/__tests__/services/policyAutomationDecisionContract.test.mjs',
    expectedNextStepId: 'runtime_question_reduction',
    evidence: 'Automation decisions separate auto-route, classify-only, review, stale profile, routing gap, and hard-limit outcomes.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_QUESTION_REDUCTION,
    label: 'Runtime question reduction',
    docPath: 'docs/architecture/policy-runtime-question-reduction-module-cutover.md',
    servicePath: 'server/src/services/policyRuntimeQuestionReduction.mjs',
    testPath: 'server/src/__tests__/services/policyRuntimeQuestionReduction.test.mjs',
    expectedNextStepId: 'request_time_learning',
    evidence: 'Questions are bounded, rare, destination-focused, and carry automation validation proof.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.REQUEST_TIME_LEARNING,
    label: 'Request-time learning and destination selection',
    docPath: 'docs/architecture/policy-request-time-learning-module-cutover.md',
    servicePath: 'server/src/services/policyRequestTimeLearning.mjs',
    testPath: 'server/src/__tests__/services/policyRequestTimeLearning.test.mjs',
    expectedNextStepId: 'library_policy_rebuild',
    requiredSupportingArtifactIds: Object.values(
      POLICY_RUNTIME_COMPLETION_SUPPORTING_ARTIFACT_IDS
    ),
    supportingArtifacts: REQUEST_TIME_LEARNING_SUPPORTING_ARTIFACTS,
    evidence: 'Request and manual destination choices pass through the learning guard before any durable learning decision.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.LIBRARY_POLICY_REBUILD,
    label: 'Library-derived policy rebuild',
    docPath: 'docs/architecture/policy-library-policy-rebuild-module-cutover.md',
    servicePath: 'server/src/services/policyLibraryPolicyRebuild.mjs',
    testPath: 'server/src/__tests__/services/policyLibraryPolicyRebuild.test.mjs',
    expectedNextStepId: 'library_rebuild_acceptance_transition',
    evidence: 'Library-derived rebuild proposals are side-effect-free, acceptance-gated, rollback-gated, and preserve explicit constraints.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.LIBRARY_REBUILD_ACCEPTANCE_TRANSITION,
    label: 'Library rebuild acceptance transition',
    docPath: 'docs/architecture/policy-library-rebuild-acceptance-transition.md',
    servicePath: 'server/src/services/policyLibraryRebuildAcceptanceTransition.mjs',
    testPath: 'server/src/__tests__/services/policyLibraryRebuildAcceptanceTransition.test.mjs',
    expectedNextStepId: 'migration_verifier_rollback',
    evidence: 'Manual acceptance is time-bounded and bound to the full rebuild proposal, same-policy rollback plan, and later persistent replay protection requirement.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.MIGRATION_VERIFIER_ROLLBACK,
    label: 'Migration verifier and rollback path',
    docPath: 'docs/architecture/policy-migration-verifier-rollback-module-cutover.md',
    servicePath: 'server/src/services/policyMigrationVerifierRollback.mjs',
    testPath: 'server/src/__tests__/services/policyMigrationVerifierRollback.test.mjs',
    expectedNextStepId: 'library_rebuild_snapshot_gate',
    evidence: 'Migration verifier reports require a verified acceptance transition, bounded sample-set proof, and rollback planning before persisted rollback evidence can be created.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.LIBRARY_REBUILD_SNAPSHOT_GATE,
    label: 'Library rebuild snapshot gate',
    docPath: 'docs/architecture/policy-library-rebuild-snapshot-gate.md',
    servicePath: 'server/src/services/policyLibraryRebuildSnapshotGate.mjs',
    testPath: 'server/src/__tests__/services/policyLibraryRebuildSnapshotGate.test.mjs',
    expectedNextStepId: 'library_rebuild_replacement_gate',
    evidence: 'An accepted rebuild persists one current rollback snapshot and execution record inside a transaction without authorizing replacement.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.LIBRARY_REBUILD_REPLACEMENT_GATE,
    label: 'Library rebuild replacement gate',
    docPath: 'docs/architecture/policy-library-rebuild-replacement-gate.md',
    servicePath: 'server/src/services/policyLibraryRebuildReplacementGate.mjs',
    testPath: 'server/src/__tests__/services/policyLibraryRebuildReplacementGate.test.mjs',
    expectedNextStepId: 'strict_constraint_descriptors',
    evidence: 'A matching accepted transition, persisted rollback snapshot, and no-difference verifier report are revalidated and written once in one transaction.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.STRICT_CONSTRAINT_DESCRIPTORS,
    label: 'Structured rebuild strict constraints',
    docPath: 'docs/architecture/policy-library-rebuild-strict-constraint-descriptors.md',
    servicePath: 'server/src/services/policyStrictConstraintDescriptor.mjs',
    testPath: 'server/src/__tests__/services/policyStrictConstraintDescriptor.test.mjs',
    expectedNextStepId: 'runtime_metrics_trace',
    evidence: 'Strict hard limits preserve their executable operator, values, mode, and semantics; ambiguous label-only rules remain blocked.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE,
    label: 'Runtime metrics and decision trace',
    docPath: 'docs/architecture/policy-runtime-metrics-trace-module-cutover.md',
    servicePath: 'server/src/services/policyRuntimeMetricsTrace.mjs',
    testPath: 'server/src/__tests__/services/policyRuntimeMetricsTrace.test.mjs',
    expectedNextStepId: 'runtime_metrics_persistence_admission',
    evidence: 'Runtime and rebuild outcomes are projected into bounded counters, sanitized trace records, and action-oriented summaries.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_PERSISTENCE_ADMISSION,
    label: 'Runtime metrics persistence admission',
    docPath: 'docs/architecture/policy-runtime-metrics-persistence-admission.md',
    servicePath: 'server/src/services/policyRuntimeMetricsPersistenceAdmission.mjs',
    testPath: 'server/src/__tests__/services/policyRuntimeMetricsPersistenceAdmission.test.mjs',
    expectedNextStepId: 'runtime_rebuild_test_reset',
    evidence: 'Validated runtime metrics become a minimized bounded snapshot with required retention and telemetry export disabled before any future sink integration.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_REBUILD_TEST_RESET,
    label: 'Runtime and rebuild test reset',
    docPath: 'docs/architecture/policy-runtime-rebuild-test-reset-module-cutover.md',
    servicePath: 'server/src/services/policyRuntimeRebuildTestReset.mjs',
    testPath: 'server/src/__tests__/services/policyRuntimeRebuildTestReset.test.mjs',
    expectedNextStepId: 'completion_audit',
    requiresCompleteTestContractCoverage: true,
    evidence: 'Runtime/rebuild tests are classified around server contracts, stale paths fail validation, and old preview UI is not frozen as migration behavior.',
  },
]);

function defaultPathExists(relativePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- completion records use repo-owned relative paths.
  return existsSync(resolve(REPO_ROOT, relativePath));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildIssue(riskId, message, details = {}) {
  return {
    riskId,
    message,
    ...details,
  };
}

function buildPassingRequestTimeLearningAudit() {
  const questionReductionPlan = buildPolicyRuntimeQuestionReductionFromRuntimeInput({
    libraryProfile: {
      identityCandidates: [
        { label: 'Animation', count: 2, confidence: 0.8 },
      ],
    },
  });
  const requestEvent = buildPolicyRequestTimeEvent({
    eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
    sourceEventId: 'runtime-completion-audit:request-time-learning',
    item: {
      itemId: 10674,
      title: 'Mulan',
    },
    requestedDestination: {
      libraryId: 6,
      libraryName: 'Animated Movies',
      arrType: 'radarr',
      arrConfigId: 1,
      arrRootFolderPath: '/media/Plexmedia/Animated Movies',
    },
  });
  const decision = buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan({
    questionReductionPlan,
    requestEvent,
  });

  const requestTimeLearningAudit = buildPolicyRequestTimeLearningAudit(decision);
  const terminalRouteIntegrationAudit = buildPolicyRequestTimeTerminalRouteIntegrationAudit();

  return {
    ...requestTimeLearningAudit,
    ok: requestTimeLearningAudit.ok === true && terminalRouteIntegrationAudit.ok === true,
    issueCount: (requestTimeLearningAudit.issueCount || 0) + terminalRouteIntegrationAudit.issues.length,
    issues: [
      ...(requestTimeLearningAudit.issues || []),
      ...terminalRouteIntegrationAudit.issues,
    ],
    terminalRouteIntegrationAudit: {
      version: terminalRouteIntegrationAudit.version,
      ok: terminalRouteIntegrationAudit.ok,
      callerCount: terminalRouteIntegrationAudit.callerCount,
      coveredCallerCount: terminalRouteIntegrationAudit.coveredCallerCount,
      queueQuestionReductionStatusId: terminalRouteIntegrationAudit.queueQuestionReduction.statusId,
    },
  };
}

function buildDefaultComponentAudits() {
  return {
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY]:
      buildPolicyRuntimeDecisionInventory(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION]:
      buildPolicyRuntimeEvidenceProjectionAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.AUTOMATION_DECISION_CONTRACT]:
      buildPolicyAutomationDecisionContractAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_QUESTION_REDUCTION]:
      buildPolicyRuntimeQuestionReductionAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.REQUEST_TIME_LEARNING]:
      buildPassingRequestTimeLearningAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.LIBRARY_POLICY_REBUILD]:
      buildPolicyLibraryPolicyRebuildAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.LIBRARY_REBUILD_ACCEPTANCE_TRANSITION]:
      buildPolicyLibraryRebuildAcceptanceTransitionAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.MIGRATION_VERIFIER_ROLLBACK]:
      buildPolicyMigrationVerifierAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.LIBRARY_REBUILD_SNAPSHOT_GATE]:
      buildPolicyLibraryRebuildSnapshotGateAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.LIBRARY_REBUILD_REPLACEMENT_GATE]:
      buildPolicyLibraryRebuildReplacementGateAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.STRICT_CONSTRAINT_DESCRIPTORS]:
      buildPolicyStrictConstraintDescriptorAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE]:
      buildPolicyRuntimeMetricsTraceAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_PERSISTENCE_ADMISSION]:
      buildPolicyRuntimeMetricsPersistenceAdmissionAuditFromDefaultMetrics(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_REBUILD_TEST_RESET]:
      buildPolicyRuntimeRebuildTestResetAudit(),
  };
}

function validateSupportingArtifact(record = {}, {
  componentId,
  pathExists,
} = {}) {
  const issues = [];
  const supportingArtifactId = record.id || null;

  if (!supportingArtifactId) {
    issues.push(buildIssue(
      POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_SUPPORTING_ARTIFACT_ID,
      'Runtime supporting artifacts must have a stable id.',
      { componentId }
    ));
  }

  if (!record.label) {
    issues.push(buildIssue(
      POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_SUPPORTING_ARTIFACT_LABEL,
      'Runtime supporting artifacts must have a label.',
      { componentId, supportingArtifactId }
    ));
  }

  if (!record.evidence) {
    issues.push(buildIssue(
      POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_SUPPORTING_ARTIFACT_EVIDENCE,
      'Runtime supporting artifacts must describe their completion evidence.',
      { componentId, supportingArtifactId }
    ));
  }

  [
    ['docPaths', 'documentation'],
    ['servicePaths', 'service'],
    ['testPaths', 'focused test'],
  ].forEach(([fieldName, label]) => {
    const paths = asArray(record[fieldName])
      .filter(path => typeof path === 'string' && path.trim());

    if (paths.length === 0) {
      issues.push(buildIssue(
        POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_SUPPORTING_ARTIFACT_PATH,
        `Runtime supporting artifact "${supportingArtifactId || 'unknown'}" must include at least one ${label} path.`,
        { componentId, supportingArtifactId, fieldName }
      ));
      return;
    }

    paths.forEach(path => {
      if (!pathExists(path)) {
        issues.push(buildIssue(
          POLICY_RUNTIME_COMPLETION_RISK_IDS.SUPPORTING_ARTIFACT_PATH_NOT_FOUND,
          `Runtime supporting artifact does not exist: ${path}.`,
          { componentId, supportingArtifactId, fieldName, path }
        ));
      }
    });
  });

  return {
    ok: issues.length === 0,
    supportingArtifactId,
    issues,
  };
}

function validateCompletionRecord(record = {}, {
  pathExists = defaultPathExists,
} = {}) {
  const issues = [];

  if (!record.id) {
    issues.push(buildIssue(
      POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_RECORD_ID,
      'Runtime completion records must have a stable id.'
    ));
  }

  if (!record.label) {
    issues.push(buildIssue(
      POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_LABEL,
      'Runtime completion records must have a label.',
      { componentId: record.id || null }
    ));
  }

  if (!record.evidence) {
    issues.push(buildIssue(
      POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_EVIDENCE,
      'Runtime completion records must describe completion evidence.',
      { componentId: record.id || null }
    ));
  }

  [
    ['docPath', POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_DOC_PATH],
    ['servicePath', POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_SERVICE_PATH],
    ['testPath', POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_TEST_PATH],
  ].forEach(([fieldName, riskId]) => {
    if (!record[fieldName]) {
      issues.push(buildIssue(
        riskId,
        `Runtime completion record "${record.id || 'unknown'}" must include ${fieldName}.`,
        { componentId: record.id || null }
      ));
      return;
    }

    if (!pathExists(record[fieldName])) {
      issues.push(buildIssue(
        POLICY_RUNTIME_COMPLETION_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
        `Runtime completion artifact does not exist: ${record[fieldName]}.`,
        {
          componentId: record.id || null,
          fieldName,
          path: record[fieldName],
        }
      ));
    }
  });

  const supportingArtifacts = asArray(record.supportingArtifacts);
  const requiredSupportingArtifactIds = asArray(record.requiredSupportingArtifactIds);
  const supportingArtifactIdCounts = supportingArtifacts.reduce((counts, artifact) => {
    const id = artifact?.id || '';
    counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  }, new Map());

  requiredSupportingArtifactIds.forEach(supportingArtifactId => {
    if (!supportingArtifacts.some(artifact => artifact?.id === supportingArtifactId)) {
      issues.push(buildIssue(
        POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_SUPPORTING_ARTIFACT,
        `Runtime completion record "${record.id || 'unknown'}" is missing supporting artifact "${supportingArtifactId}".`,
        { componentId: record.id || null, supportingArtifactId }
      ));
    }
  });

  const supportingArtifactChecks = supportingArtifacts.map(artifact => {
    const artifactValidation = validateSupportingArtifact(artifact, {
      componentId: record.id || null,
      pathExists,
    });
    const supportingArtifactId = artifactValidation.supportingArtifactId;

    if (supportingArtifactId && supportingArtifactIdCounts.get(supportingArtifactId) > 1) {
      artifactValidation.issues.push(buildIssue(
        POLICY_RUNTIME_COMPLETION_RISK_IDS.DUPLICATE_SUPPORTING_ARTIFACT,
        `Runtime completion record "${record.id || 'unknown'}" declares supporting artifact "${supportingArtifactId}" more than once.`,
        { componentId: record.id || null, supportingArtifactId }
      ));
      artifactValidation.ok = false;
    }

    return artifactValidation;
  });

  supportingArtifactChecks.forEach(check => issues.push(...check.issues));

  return {
    ok: issues.length === 0,
    componentId: record.id || null,
    requiredSupportingArtifactCount: requiredSupportingArtifactIds.length,
    supportingArtifactChecks,
    issues,
  };
}

function listPolicyRuntimeCompletionComponents() {
  return POLICY_RUNTIME_COMPLETION_COMPONENT_RECORDS.map(record => ({ ...record }));
}

function hasCompleteTestContractCoverage(componentAudit) {
  const requiredContractCount = Number(componentAudit?.requiredContractCount);
  const coveredRequiredContractCount = Number(componentAudit?.coveredRequiredContractCount);

  return Number.isInteger(requiredContractCount) &&
    requiredContractCount > 0 &&
    Number.isInteger(coveredRequiredContractCount) &&
    coveredRequiredContractCount === requiredContractCount;
}

function buildPolicyEngineCompletionSummary(audit = {}) {
  return {
    ok: audit?.ok === true && Number(audit?.issueCount) === 0,
    issueCount: Number.isInteger(Number(audit?.issueCount))
      ? Number(audit.issueCount)
      : null,
    checkedComponentCount: Number.isInteger(Number(audit?.checkedComponentCount))
      ? Number(audit.checkedComponentCount)
      : null,
  };
}

function buildComponentAuditSummary(audit = {}) {
  const terminalRouteAudit = audit?.terminalRouteIntegrationAudit;

  return {
    version: typeof audit?.version === 'string' ? audit.version : null,
    ok: audit?.ok === true,
    issueCount: Number.isInteger(Number(audit?.issueCount))
      ? Number(audit.issueCount)
      : null,
    terminalRouteIntegrationAudit: terminalRouteAudit
      ? {
        version: terminalRouteAudit.version || null,
        ok: terminalRouteAudit.ok === true,
        callerCount: Number.isInteger(Number(terminalRouteAudit.callerCount))
          ? Number(terminalRouteAudit.callerCount)
          : null,
        coveredCallerCount: Number.isInteger(Number(terminalRouteAudit.coveredCallerCount))
          ? Number(terminalRouteAudit.coveredCallerCount)
          : null,
        queueQuestionReductionStatusId:
          terminalRouteAudit.queueQuestionReductionStatusId || null,
      }
      : null,
  };
}

function buildPolicyRuntimeCompletionAudit({
  components = listPolicyRuntimeCompletionComponents(),
  componentAudits = buildDefaultComponentAudits(),
  policyEngineCompletionAudit = buildPolicyEngineCompletionAudit(),
  pathExists = defaultPathExists,
} = {}) {
  const records = asArray(components).map(record => ({ ...record }));
  const issues = [];
  const policyEngineCompletion = buildPolicyEngineCompletionSummary(
    policyEngineCompletionAudit
  );

  if (!policyEngineCompletion.ok) {
    issues.push(buildIssue(
      POLICY_RUNTIME_COMPLETION_RISK_IDS.POLICY_ENGINE_COMPLETION_NOT_PASSING,
      'Runtime completion requires a passing policy-engine completion audit before native storage can begin.',
      {
        policyEngineIssueCount: policyEngineCompletion.issueCount,
      }
    ));
  }

  const componentChecks = records.map(record => {
    const recordValidation = validateCompletionRecord(record, { pathExists });
    const componentAudit = componentAudits[record.id];
    const auditOk = componentAudit?.ok === true && Number(componentAudit?.issueCount || 0) === 0;
    const nextStepId = componentAudit?.nextStep?.stepId || null;
    const testContractCoverageOk = record.requiresCompleteTestContractCoverage !== true ||
      hasCompleteTestContractCoverage(componentAudit);

    if (!componentAudit) {
      issues.push(buildIssue(
        POLICY_RUNTIME_COMPLETION_RISK_IDS.COMPONENT_AUDIT_MISSING,
        `Runtime completion audit is missing component audit "${record.id}".`,
        { componentId: record.id }
      ));
    } else if (!auditOk) {
      issues.push(buildIssue(
        POLICY_RUNTIME_COMPLETION_RISK_IDS.COMPONENT_AUDIT_FAILED,
        `Runtime component audit failed for "${record.id}".`,
        {
          componentId: record.id,
          issueCount: componentAudit.issueCount || 0,
        }
      ));
    }

    if (!testContractCoverageOk) {
      issues.push(buildIssue(
        POLICY_RUNTIME_COMPLETION_RISK_IDS.TEST_RESET_CONTRACT_COVERAGE_INCOMPLETE,
        'Runtime completion requires every reset contract to have focused test coverage.',
        {
          componentId: record.id,
          requiredContractCount: componentAudit?.requiredContractCount ?? null,
          coveredRequiredContractCount: componentAudit?.coveredRequiredContractCount ?? null,
        }
      ));
    }

    if (record.expectedNextStepId && nextStepId !== record.expectedNextStepId) {
      issues.push(buildIssue(
        POLICY_RUNTIME_COMPLETION_RISK_IDS.NEXT_STEP_MISMATCH,
        `Runtime component "${record.id}" points to "${nextStepId || 'missing'}" instead of "${record.expectedNextStepId}".`,
        {
          componentId: record.id,
          expectedNextStepId: record.expectedNextStepId,
          actualNextStepId: nextStepId,
        }
      ));
    }

    issues.push(...recordValidation.issues);

    return {
      componentId: record.id,
      label: record.label,
      recordOk: recordValidation.ok,
      auditOk,
      testContractCoverageOk,
      requiredSupportingArtifactCount: recordValidation.requiredSupportingArtifactCount,
      supportingArtifactChecks: recordValidation.supportingArtifactChecks,
      auditSummary: buildComponentAuditSummary(componentAudit),
      issueCount: componentAudit?.issueCount ?? null,
      expectedNextStepId: record.expectedNextStepId || null,
      actualNextStepId: nextStepId,
    };
  });

  REQUIRED_COMPONENT_IDS
    .filter(componentId => !records.some(record => record.id === componentId))
    .forEach(componentId => {
      issues.push(buildIssue(
        POLICY_RUNTIME_COMPLETION_RISK_IDS.MISSING_COMPONENT,
        `Runtime completion audit is missing required component "${componentId}".`,
        { componentId }
      ));
    });

  return {
    version: 'policy.runtime_completion_audit.v1',
    ok: issues.length === 0,
    issueCount: issues.length,
    checkedComponentCount: componentChecks.length,
    requiredComponentCount: REQUIRED_COMPONENT_IDS.length,
    policyEngineCompletion,
    componentChecks,
    issues,
    nextStep: {
      stepId: 'native_intent_storage',
      label: 'Native Intent Storage And Legacy Removal',
      reason: 'Runtime automation and rebuild contracts are audited; the next boundary is durable native intent storage and legacy removal.',
    },
  };
}

export {
  POLICY_RUNTIME_COMPLETION_COMPONENT_IDS,
  POLICY_RUNTIME_COMPLETION_RISK_IDS,
  POLICY_RUNTIME_COMPLETION_SUPPORTING_ARTIFACT_IDS,
  buildPolicyRuntimeCompletionAudit,
  listPolicyRuntimeCompletionComponents,
  validateCompletionRecord as validatePolicyRuntimeCompletionRecord,
};
