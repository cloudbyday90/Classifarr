import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildPolicyAutomationDecisionContractAudit,
} from './policyAutomationDecisionContract.mjs';
import {
  buildPolicyLibraryPolicyRebuildAudit,
} from './policyLibraryPolicyRebuild.mjs';
import {
  buildPolicyMigrationVerifierAudit,
} from './policyMigrationVerifierRollback.mjs';
import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  buildPolicyRequestTimeLearningAudit,
  buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan,
} from './policyRequestTimeLearning.mjs';
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
  buildPolicyRuntimeQuestionReductionFromRuntimeInput,
  buildPolicyRuntimeQuestionReductionAudit,
} from './policyRuntimeQuestionReduction.mjs';
import {
  buildPolicyRuntimeRebuildTestResetAudit,
} from './policyRuntimeRebuildTestReset.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const POLICY_RUNTIME_COMPLETION_COMPONENT_IDS = Object.freeze({
  RUNTIME_DECISION_INVENTORY: 'runtime_decision_inventory',
  RUNTIME_EVIDENCE_PROJECTION: 'runtime_evidence_projection',
  AUTOMATION_DECISION_CONTRACT: 'automation_decision_contract',
  RUNTIME_QUESTION_REDUCTION: 'runtime_question_reduction',
  REQUEST_TIME_LEARNING: 'request_time_learning',
  LIBRARY_POLICY_REBUILD: 'library_policy_rebuild',
  MIGRATION_VERIFIER_ROLLBACK: 'migration_verifier_rollback',
  RUNTIME_METRICS_TRACE: 'runtime_metrics_trace',
  RUNTIME_REBUILD_TEST_RESET: 'runtime_rebuild_test_reset',
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
  COMPONENT_AUDIT_FAILED: 'component_audit_failed',
  COMPONENT_AUDIT_MISSING: 'component_audit_missing',
  TEST_RESET_CONTRACT_COVERAGE_INCOMPLETE: 'test_reset_contract_coverage_incomplete',
  NEXT_STEP_MISMATCH: 'next_step_mismatch',
});

const REQUIRED_COMPONENT_IDS = Object.freeze(Object.values(POLICY_RUNTIME_COMPLETION_COMPONENT_IDS));

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
    evidence: 'Request and manual destination choices pass through the learning guard before any durable learning decision.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.LIBRARY_POLICY_REBUILD,
    label: 'Library-derived policy rebuild',
    docPath: 'docs/architecture/policy-library-policy-rebuild-module-cutover.md',
    servicePath: 'server/src/services/policyLibraryPolicyRebuild.mjs',
    testPath: 'server/src/__tests__/services/policyLibraryPolicyRebuild.test.mjs',
    expectedNextStepId: 'migration_verifier_rollback',
    evidence: 'Library-derived rebuild proposals are side-effect-free, acceptance-gated, rollback-gated, and preserve explicit constraints.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.MIGRATION_VERIFIER_ROLLBACK,
    label: 'Migration verifier and rollback path',
    docPath: 'docs/architecture/policy-migration-verifier-rollback-module-cutover.md',
    servicePath: 'server/src/services/policyMigrationVerifierRollback.mjs',
    testPath: 'server/src/__tests__/services/policyMigrationVerifierRollback.test.mjs',
    expectedNextStepId: 'runtime_metrics_trace',
    evidence: 'Migration verifier reports require proposal validation, bounded sample-set proof, operator acceptance, and rollback before replacement.',
  },
  {
    id: POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE,
    label: 'Runtime metrics and decision trace',
    docPath: 'docs/architecture/policy-runtime-metrics-trace-module-cutover.md',
    servicePath: 'server/src/services/policyRuntimeMetricsTrace.mjs',
    testPath: 'server/src/__tests__/services/policyRuntimeMetricsTrace.test.mjs',
    expectedNextStepId: 'runtime_rebuild_test_reset',
    evidence: 'Runtime and rebuild outcomes are projected into bounded counters, sanitized trace records, and action-oriented summaries.',
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

  return buildPolicyRequestTimeLearningAudit(decision);
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
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.MIGRATION_VERIFIER_ROLLBACK]:
      buildPolicyMigrationVerifierAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_METRICS_TRACE]:
      buildPolicyRuntimeMetricsTraceAudit(),
    [POLICY_RUNTIME_COMPLETION_COMPONENT_IDS.RUNTIME_REBUILD_TEST_RESET]:
      buildPolicyRuntimeRebuildTestResetAudit(),
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

  return {
    ok: issues.length === 0,
    componentId: record.id || null,
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

function buildPolicyRuntimeCompletionAudit({
  components = listPolicyRuntimeCompletionComponents(),
  componentAudits = buildDefaultComponentAudits(),
  pathExists = defaultPathExists,
} = {}) {
  const records = asArray(components).map(record => ({ ...record }));
  const issues = [];
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
  buildPolicyRuntimeCompletionAudit,
  listPolicyRuntimeCompletionComponents,
  validateCompletionRecord as validatePolicyRuntimeCompletionRecord,
};
