import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildPolicyAutomationDecisionContractAudit,
} from './policyAutomationDecisionContract.mjs';
import {
  buildPolicyBuilderPhase7LibraryPolicyRebuildAudit,
} from './policyBuilderPhase7LibraryPolicyRebuild.mjs';
import {
  buildPolicyBuilderPhase7MigrationVerifierAudit,
} from './policyBuilderPhase7MigrationVerifierRollback.mjs';
import {
  PHASE7R_REQUEST_EVENT_TYPE_IDS,
  buildPolicyBuilderPhase7RequestTimeLearningAudit,
  buildPolicyBuilderPhase7RequestTimeLearningDecision,
} from './policyBuilderPhase7RequestTimeLearning.mjs';
import {
  buildPolicyRuntimeDecisionInventory,
} from './policyRuntimeDecisionInventory.mjs';
import {
  buildPolicyRuntimeEvidenceProjectionAudit,
} from './policyRuntimeEvidenceProjection.mjs';
import {
  buildPolicyBuilderPhase7RuntimeMetricsTraceAudit,
} from './policyBuilderPhase7RuntimeMetricsTrace.mjs';
import {
  buildPolicyRuntimeQuestionReduction,
  buildPolicyRuntimeQuestionReductionAudit,
} from './policyRuntimeQuestionReduction.mjs';
import {
  buildPolicyBuilderPhase7RuntimeRebuildTestResetAudit,
} from './policyBuilderPhase7RuntimeRebuildTestReset.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const PHASE7R_COMPLETION_COMPONENT_IDS = Object.freeze({
  RUNTIME_DECISION_INVENTORY: '7r_1_runtime_decision_inventory',
  RUNTIME_EVIDENCE_PROJECTION: '7r_2_runtime_evidence_projection',
  AUTOMATION_DECISION_CONTRACT: '7r_3_automation_decision_contract',
  RUNTIME_QUESTION_REDUCTION: '7r_4_runtime_question_reduction',
  REQUEST_TIME_LEARNING: '7r_5_request_time_learning',
  LIBRARY_POLICY_REBUILD: '7r_6_library_policy_rebuild',
  MIGRATION_VERIFIER_ROLLBACK: '7r_7_migration_verifier_rollback',
  RUNTIME_METRICS_TRACE: '7r_8_runtime_metrics_trace',
  RUNTIME_REBUILD_TEST_RESET: '7r_9_runtime_rebuild_test_reset',
});

const PHASE7R_COMPLETION_RISK_IDS = Object.freeze({
  MISSING_COMPONENT: 'missing_component',
  MISSING_RECORD_ID: 'missing_record_id',
  MISSING_LABEL: 'missing_label',
  MISSING_EVIDENCE: 'missing_evidence',
  MISSING_DOC_PATH: 'missing_doc_path',
  MISSING_SERVICE_PATH: 'missing_service_path',
  MISSING_TEST_PATH: 'missing_test_path',
  ARTIFACT_PATH_NOT_FOUND: 'artifact_path_not_found',
  COMPONENT_AUDIT_FAILED: 'component_audit_failed',
  COMPONENT_AUDIT_MISSING: 'component_audit_missing',
  NEXT_PHASE_MISMATCH: 'next_phase_mismatch',
});

const REQUIRED_COMPONENT_IDS = Object.freeze(Object.values(PHASE7R_COMPLETION_COMPONENT_IDS));

const PHASE7R_COMPONENT_NEXT_STEP_PHASE_IDS = Object.freeze({
  [PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY]: Object.freeze({
    runtime_evidence_projection: '7r_2',
  }),
  [PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION]: Object.freeze({
    automation_decision_contract: '7r_3',
  }),
  [PHASE7R_COMPLETION_COMPONENT_IDS.AUTOMATION_DECISION_CONTRACT]: Object.freeze({
    runtime_question_reduction: '7r_4',
  }),
  [PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_QUESTION_REDUCTION]: Object.freeze({
    request_time_learning: '7r_5',
  }),
});

const PHASE7R_COMPONENT_RECORDS = Object.freeze([
  {
    id: PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY,
    label: 'Runtime decision inventory and cutline',
    docPath: 'docs/architecture/policy-builder-phase-7r-runtime-decision-inventory.md',
    servicePath: 'server/src/services/policyRuntimeDecisionInventory.mjs',
    testPath: 'server/src/__tests__/services/policyRuntimeDecisionInventory.test.mjs',
    expectedNextPhaseId: '7r_2',
    evidence: 'Runtime surfaces are inventoried with authority sources, cutline decisions, and required contract surfaces.',
  },
  {
    id: PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION,
    label: 'Runtime evidence projection',
    docPath: 'docs/architecture/policy-builder-phase-7r-runtime-evidence-projection.md',
    servicePath: 'server/src/services/policyRuntimeEvidenceProjection.mjs',
    testPath: 'server/src/__tests__/services/policyRuntimeEvidenceProjection.test.mjs',
    expectedNextPhaseId: '7r_3',
    evidence: 'Runtime evidence is projected into bounded buckets with sanitized fingerprint proof.',
  },
  {
    id: PHASE7R_COMPLETION_COMPONENT_IDS.AUTOMATION_DECISION_CONTRACT,
    label: 'Automation decision contract',
    docPath: 'docs/architecture/policy-builder-phase-7r-automation-decision-contract.md',
    servicePath: 'server/src/services/policyAutomationDecisionContract.mjs',
    testPath: 'server/src/__tests__/services/policyAutomationDecisionContract.test.mjs',
    expectedNextPhaseId: '7r_4',
    evidence: 'Automation decisions separate auto-route, classify-only, review, stale profile, routing gap, and hard-limit outcomes.',
  },
  {
    id: PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_QUESTION_REDUCTION,
    label: 'Runtime question reduction',
    docPath: 'docs/architecture/policy-builder-phase-7r-runtime-question-reduction.md',
    servicePath: 'server/src/services/policyRuntimeQuestionReduction.mjs',
    testPath: 'server/src/__tests__/services/policyRuntimeQuestionReduction.test.mjs',
    expectedNextPhaseId: '7r_5',
    evidence: 'Questions are bounded, rare, destination-focused, and carry automation validation proof.',
  },
  {
    id: PHASE7R_COMPLETION_COMPONENT_IDS.REQUEST_TIME_LEARNING,
    label: 'Request-time learning and destination selection',
    docPath: 'docs/architecture/policy-builder-phase-7r-request-time-learning.md',
    servicePath: 'server/src/services/policyBuilderPhase7RequestTimeLearning.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase7RequestTimeLearning.test.mjs',
    expectedNextPhaseId: '7r_6',
    evidence: 'Request and manual destination choices pass through the learning guard before any durable learning decision.',
  },
  {
    id: PHASE7R_COMPLETION_COMPONENT_IDS.LIBRARY_POLICY_REBUILD,
    label: 'Library-derived policy rebuild',
    docPath: 'docs/architecture/policy-builder-phase-7r-library-policy-rebuild.md',
    servicePath: 'server/src/services/policyBuilderPhase7LibraryPolicyRebuild.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase7LibraryPolicyRebuild.test.mjs',
    expectedNextPhaseId: '7r_7',
    evidence: 'Library-derived rebuild proposals are side-effect-free, acceptance-gated, rollback-gated, and preserve explicit constraints.',
  },
  {
    id: PHASE7R_COMPLETION_COMPONENT_IDS.MIGRATION_VERIFIER_ROLLBACK,
    label: 'Migration verifier and rollback path',
    docPath: 'docs/architecture/policy-builder-phase-7r-migration-verifier-rollback.md',
    servicePath: 'server/src/services/policyBuilderPhase7MigrationVerifierRollback.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase7MigrationVerifierRollback.test.mjs',
    expectedNextPhaseId: '7r_8',
    evidence: 'Migration verifier reports require proposal validation, bounded sample-set proof, operator acceptance, and rollback before replacement.',
  },
  {
    id: PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE,
    label: 'Runtime metrics and decision trace',
    docPath: 'docs/architecture/policy-builder-phase-7r-runtime-metrics-trace.md',
    servicePath: 'server/src/services/policyBuilderPhase7RuntimeMetricsTrace.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase7RuntimeMetricsTrace.test.mjs',
    expectedNextPhaseId: '7r_9',
    evidence: 'Runtime and rebuild outcomes are projected into bounded counters, sanitized trace records, and action-oriented summaries.',
  },
  {
    id: PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_REBUILD_TEST_RESET,
    label: 'Runtime and rebuild test reset',
    docPath: 'docs/architecture/policy-builder-phase-7r-runtime-rebuild-test-reset.md',
    servicePath: 'server/src/services/policyBuilderPhase7RuntimeRebuildTestReset.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase7RuntimeRebuildTestReset.test.mjs',
    expectedNextPhaseId: 'phase7r_completion_audit',
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
  const questionReductionPlan = buildPolicyRuntimeQuestionReduction({
    libraryProfile: {
      identityCandidates: [
        { label: 'Animation', count: 2, confidence: 0.8 },
      ],
    },
  });
  const decision = buildPolicyBuilderPhase7RequestTimeLearningDecision({
    questionReductionPlan,
    eventTypeId: PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION,
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

  return buildPolicyBuilderPhase7RequestTimeLearningAudit(decision);
}

function buildDefaultComponentAudits() {
  return {
    [PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_DECISION_INVENTORY]:
      buildPolicyRuntimeDecisionInventory(),
    [PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_EVIDENCE_PROJECTION]:
      buildPolicyRuntimeEvidenceProjectionAudit(),
    [PHASE7R_COMPLETION_COMPONENT_IDS.AUTOMATION_DECISION_CONTRACT]:
      buildPolicyAutomationDecisionContractAudit(),
    [PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_QUESTION_REDUCTION]:
      buildPolicyRuntimeQuestionReductionAudit(),
    [PHASE7R_COMPLETION_COMPONENT_IDS.REQUEST_TIME_LEARNING]:
      buildPassingRequestTimeLearningAudit(),
    [PHASE7R_COMPLETION_COMPONENT_IDS.LIBRARY_POLICY_REBUILD]:
      buildPolicyBuilderPhase7LibraryPolicyRebuildAudit(),
    [PHASE7R_COMPLETION_COMPONENT_IDS.MIGRATION_VERIFIER_ROLLBACK]:
      buildPolicyBuilderPhase7MigrationVerifierAudit(),
    [PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE]:
      buildPolicyBuilderPhase7RuntimeMetricsTraceAudit(),
    [PHASE7R_COMPLETION_COMPONENT_IDS.RUNTIME_REBUILD_TEST_RESET]:
      buildPolicyBuilderPhase7RuntimeRebuildTestResetAudit(),
  };
}

function validateCompletionRecord(record = {}, {
  pathExists = defaultPathExists,
} = {}) {
  const issues = [];

  if (!record.id) {
    issues.push(buildIssue(
      PHASE7R_COMPLETION_RISK_IDS.MISSING_RECORD_ID,
      'Phase 7R completion records must have a stable id.'
    ));
  }

  if (!record.label) {
    issues.push(buildIssue(
      PHASE7R_COMPLETION_RISK_IDS.MISSING_LABEL,
      'Phase 7R completion records must have a label.',
      { componentId: record.id || null }
    ));
  }

  if (!record.evidence) {
    issues.push(buildIssue(
      PHASE7R_COMPLETION_RISK_IDS.MISSING_EVIDENCE,
      'Phase 7R completion records must describe completion evidence.',
      { componentId: record.id || null }
    ));
  }

  [
    ['docPath', PHASE7R_COMPLETION_RISK_IDS.MISSING_DOC_PATH],
    ['servicePath', PHASE7R_COMPLETION_RISK_IDS.MISSING_SERVICE_PATH],
    ['testPath', PHASE7R_COMPLETION_RISK_IDS.MISSING_TEST_PATH],
  ].forEach(([fieldName, riskId]) => {
    if (!record[fieldName]) {
      issues.push(buildIssue(
        riskId,
        `Phase 7R completion record "${record.id || 'unknown'}" must include ${fieldName}.`,
        { componentId: record.id || null }
      ));
      return;
    }

    if (!pathExists(record[fieldName])) {
      issues.push(buildIssue(
        PHASE7R_COMPLETION_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
        `Phase 7R completion artifact does not exist: ${record[fieldName]}.`,
        {
          componentId: record.id || null,
          fieldName,
          path: record[fieldName],
        }
      ));
    }
  });

  return {
    ok: issues.length === 0,
    componentId: record.id || null,
    issues,
  };
}

function listPolicyBuilderPhase7CompletionComponents() {
  return PHASE7R_COMPONENT_RECORDS.map(record => ({ ...record }));
}

function buildPolicyBuilderPhase7CompletionAudit({
  components = listPolicyBuilderPhase7CompletionComponents(),
  componentAudits = buildDefaultComponentAudits(),
  pathExists = defaultPathExists,
} = {}) {
  const records = asArray(components).map(record => ({ ...record }));
  const issues = [];
  const componentChecks = records.map(record => {
    const recordValidation = validateCompletionRecord(record, { pathExists });
    const componentAudit = componentAudits[record.id];
    const auditOk = componentAudit?.ok === true && Number(componentAudit?.issueCount || 0) === 0;
    const nextPhaseId = componentAudit?.nextPhase?.phaseId ||
      PHASE7R_COMPONENT_NEXT_STEP_PHASE_IDS[record.id]?.[componentAudit?.nextStep?.stepId] ||
      null;

    if (!componentAudit) {
      issues.push(buildIssue(
        PHASE7R_COMPLETION_RISK_IDS.COMPONENT_AUDIT_MISSING,
        `Phase 7R completion audit is missing component audit "${record.id}".`,
        { componentId: record.id }
      ));
    } else if (!auditOk) {
      issues.push(buildIssue(
        PHASE7R_COMPLETION_RISK_IDS.COMPONENT_AUDIT_FAILED,
        `Phase 7R component audit failed for "${record.id}".`,
        {
          componentId: record.id,
          issueCount: componentAudit.issueCount || 0,
        }
      ));
    }

    if (record.expectedNextPhaseId && nextPhaseId !== record.expectedNextPhaseId) {
      issues.push(buildIssue(
        PHASE7R_COMPLETION_RISK_IDS.NEXT_PHASE_MISMATCH,
        `Phase 7R component "${record.id}" points to "${nextPhaseId || 'missing'}" instead of "${record.expectedNextPhaseId}".`,
        {
          componentId: record.id,
          expectedNextPhaseId: record.expectedNextPhaseId,
          actualNextPhaseId: nextPhaseId,
        }
      ));
    }

    issues.push(...recordValidation.issues);

    return {
      componentId: record.id,
      label: record.label,
      recordOk: recordValidation.ok,
      auditOk,
      issueCount: componentAudit?.issueCount ?? null,
      expectedNextPhaseId: record.expectedNextPhaseId || null,
      actualNextPhaseId: nextPhaseId,
    };
  });

  REQUIRED_COMPONENT_IDS
    .filter(componentId => !records.some(record => record.id === componentId))
    .forEach(componentId => {
      issues.push(buildIssue(
        PHASE7R_COMPLETION_RISK_IDS.MISSING_COMPONENT,
        `Phase 7R completion audit is missing required component "${componentId}".`,
        { componentId }
      ));
    });

  return {
    version: 'phase7r.completion_audit.v1',
    ok: issues.length === 0,
    issueCount: issues.length,
    checkedComponentCount: componentChecks.length,
    requiredComponentCount: REQUIRED_COMPONENT_IDS.length,
    componentChecks,
    issues,
    nextPhase: {
      phaseId: '8r_1',
      label: 'Native Intent Storage And Legacy Removal',
      reason: 'Phase 7R runtime automation and rebuild contracts are audited; the next boundary is durable native intent storage and legacy removal.',
    },
  };
}

export {
  PHASE7R_COMPLETION_COMPONENT_IDS,
  PHASE7R_COMPLETION_RISK_IDS,
  buildPolicyBuilderPhase7CompletionAudit,
  listPolicyBuilderPhase7CompletionComponents,
  validateCompletionRecord as validatePolicyBuilderPhase7CompletionRecord,
};
