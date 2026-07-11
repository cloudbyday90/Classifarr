import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildBoundedPolicyEvidenceProjection,
} from './policyEvidenceBoundary.mjs';
import {
  buildPolicyEvidenceEngineAudit,
} from './policyEvidenceEngine.mjs';
import {
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
} from './policyEvidenceQuality.mjs';
import {
  buildPolicyIntentDraftFromBoundedEvidence,
  buildPolicyIntentEngineAudit,
} from './policyIntentEngine.mjs';
import {
  buildPolicyLearningDecisionFromBoundedIntent,
  buildPolicyLearningGuardAudit,
} from './policyLearningGuard.mjs';
import {
  POLICY_MIGRATION_ARTIFACT_DECISION_IDS,
  buildPolicyMigrationDeletionAudit,
  buildPolicyMigrationDeletionPlanFromBoundedWorkflow,
  listPolicyMigrationDeletionArtifacts,
} from './policyMigrationDeletionPath.mjs';
import {
  buildPolicyOperatorWorkflowFromBoundedReadiness,
  buildPolicyOperatorWorkflowAudit,
} from './policyOperatorWorkflow.mjs';
import {
  buildPolicyAutomationReadinessFromBoundedContracts,
  buildPolicyAutomationReadinessEngineAudit,
} from './policyAutomationReadinessEngine.mjs';
import {
  ANSWER_OUTCOME_IDS,
} from './policyQuestionLearningVocabulary.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const POLICY_ENGINE_COMPLETION_COMPONENT_IDS = Object.freeze({
  ARTIFACT_INVENTORY_CUTLINE: 'artifact_inventory_cutline',
  EVIDENCE_ENGINE: 'evidence_engine',
  INTENT_ENGINE: 'intent_engine',
  LEARNING_GUARD: 'learning_guard',
  READINESS_ENGINE: 'automation_readiness_engine',
  OPERATOR_WORKFLOW: 'operator_workflow',
  MIGRATION_DELETION_PATH: 'migration_deletion_path',
});

const POLICY_ENGINE_COMPLETION_RISK_IDS = Object.freeze({
  MISSING_COMPONENT: 'missing_component',
  MISSING_RECORD_ID: 'missing_record_id',
  MISSING_LABEL: 'missing_label',
  MISSING_EVIDENCE: 'missing_evidence',
  MISSING_DOC_PATH: 'missing_doc_path',
  MISSING_SERVICE_PATH: 'missing_service_path',
  MISSING_TEST_PATH: 'missing_test_path',
  ARTIFACT_PATH_NOT_FOUND: 'artifact_path_not_found',
  COMPONENT_AUDIT_FAILED: 'component_audit_failed',
  NEXT_STEP_MISMATCH: 'next_step_mismatch',
  LEGACY_ARTIFACT_WITHOUT_CUTLINE: 'legacy_artifact_without_cutline',
  LEGACY_ARTIFACT_ALLOWED_IN_NORMAL_WORKFLOW: 'legacy_artifact_allowed_in_normal_workflow',
  NATIVE_STORAGE_NOT_BLOCKED: 'native_storage_not_blocked',
  BOUNDED_CHAIN_FAILED: 'bounded_chain_failed',
  BOUNDED_CHAIN_AUDIT_NOT_PASSING: 'bounded_chain_audit_not_passing',
  BOUNDED_CHAIN_PROVENANCE_MISMATCH: 'bounded_chain_provenance_mismatch',
  BOUNDED_CHAIN_RAW_PROVENANCE: 'bounded_chain_raw_provenance',
  BOUNDED_CHAIN_QUALITY_MISSING: 'bounded_chain_quality_missing',
  BOUNDED_CHAIN_QUALITY_INSUFFICIENT: 'bounded_chain_quality_insufficient',
  BOUNDED_CHAIN_QUALITY_MISMATCH: 'bounded_chain_quality_mismatch',
});

const REQUIRED_COMPONENT_IDS = Object.freeze(Object.values(POLICY_ENGINE_COMPLETION_COMPONENT_IDS));

const POLICY_ENGINE_COMPONENT_RECORDS = Object.freeze([
  {
    id: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.ARTIFACT_INVENTORY_CUTLINE,
    label: 'Artifact inventory and cutline',
    docPath: 'docs/architecture/policy-builder-intent-model-roadmap.md',
    servicePath: 'server/src/services/policyMigrationDeletionPath.mjs',
    testPath: 'server/src/__tests__/services/policyMigrationDeletionPath.test.mjs',
    expectedNextStepId: 'evidence_engine',
    evidence: 'Legacy policy-builder diagnostics have explicit verifier, deletion, keep, or native storage blocker decisions.',
  },
  {
    id: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE,
    label: 'Evidence engine',
    docPath: 'docs/architecture/policy-evidence-engine-module-cutover.md',
    servicePath: 'server/src/services/policyEvidenceEngine.mjs',
    testPath: 'server/src/__tests__/services/policyEvidenceEngine.test.mjs',
    expectedNextStepId: 'intent_inference',
    evidence: 'Evidence buckets and sources are server-owned and exclude live provider/UI payload authority.',
  },
  {
    id: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.INTENT_ENGINE,
    label: 'Intent engine',
    docPath: 'docs/architecture/policy-intent-engine-module-cutover.md',
    servicePath: 'server/src/services/policyIntentEngine.mjs',
    testPath: 'server/src/__tests__/services/policyIntentEngine.test.mjs',
    expectedNextStepId: 'learning_eligibility',
    evidence: 'Evidence is converted into destination intent without direct learning or storage side effects.',
  },
  {
    id: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.LEARNING_GUARD,
    label: 'Learning guard',
    docPath: 'docs/architecture/policy-learning-guard-module-cutover.md',
    servicePath: 'server/src/services/policyLearningGuard.mjs',
    testPath: 'server/src/__tests__/services/policyLearningGuard.test.mjs',
    expectedNextStepId: 'automation_readiness',
    evidence: 'Final outcomes are separated from durable learning tiers and blocked learning sources.',
  },
  {
    id: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.READINESS_ENGINE,
    label: 'Automation readiness engine',
    docPath: 'docs/architecture/policy-automation-readiness-engine-module-cutover.md',
    servicePath: 'server/src/services/policyAutomationReadinessEngine.mjs',
    testPath: 'server/src/__tests__/services/policyAutomationReadinessEngine.test.mjs',
    expectedNextStepId: 'operator_workflow',
    evidence: 'Readiness returns one action-oriented state and ignores legacy diagnostic gates.',
  },
  {
    id: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW,
    label: 'Policy operator workflow',
    docPath: 'docs/architecture/policy-operator-workflow-module-cutover.md',
    servicePath: 'server/src/services/policyOperatorWorkflow.mjs',
    testPath: 'server/src/__tests__/services/policyOperatorWorkflow.test.mjs',
    expectedNextStepId: 'migration_deletion_path',
    evidence: 'Normal workflow is destination-first and excludes replay/provider/TMDB/scoring diagnostics.',
  },
  {
    id: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH,
    label: 'Migration and deletion path',
    docPath: 'docs/architecture/policy-migration-deletion-path-module-cutover.md',
    servicePath: 'server/src/services/policyMigrationDeletionPath.mjs',
    testPath: 'server/src/__tests__/services/policyMigrationDeletionPath.test.mjs',
    expectedNextStepId: 'runtime_decision_inventory',
    evidence: 'Legacy diagnostics are migration verifiers or deletion targets with rollback and native storage gates.',
  },
]);


const REQUIRED_LEGACY_CUTLINE_ARTIFACT_PATHS = Object.freeze([
  'client/src/components/policies/PolicyIntentImpactPreviewCard.vue',
  'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
  'client/src/composables/usePolicyIntentImpactPreview.js',
  'client/src/composables/usePolicyIntentReplayPreview.js',
  'client/src/utils/policyIntentImpactPreview.js',
  'client/src/utils/policyIntentReplayPreview.js',
  'server/src/routes/policiesRouteMigrationVerifier.mjs',
  'server/src/services/policyIntentImpactPreview.mjs',
  'server/src/services/policyIntentReplayEngineComparison.mjs',
  'server/src/services/policyIntentReplayEnrichmentAdapterContract.mjs',
  'server/src/services/policyIntentReplayEnrichmentEligibility.mjs',
  'server/src/services/policyIntentReplayEvidenceCompleteness.mjs',
  'server/src/services/policyIntentReplayExecutionContext.mjs',
  'server/src/services/policyIntentReplayItemAdapter.mjs',
  'server/src/services/policyIntentReplayParityDelta.mjs',
  'server/src/services/policyIntentReplayPreview.mjs',
  'server/src/services/policyIntentReplayProviderReadiness.mjs',
  'server/src/services/policyIntentReplaySampleDiagnostics.mjs',
  'server/src/services/policyIntentReplayScoring.mjs',
  'server/src/services/policyIntentReplayTmdbMetadataAdapter.mjs',
  'server/src/services/policyIntentReplayTmdbMetadataCoverageComparison.mjs',
  'server/src/services/policyIntentReplayTmdbMetadataExecutionSwitch.mjs',
  'server/src/services/policyIntentReplayTmdbProviderClient.mjs',
]);

function defaultPathExists(relativePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- completion records use repo-owned relative paths.
  return existsSync(resolve(REPO_ROOT, relativePath));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildIssue(riskId, message, details = {}) {
  return {
    riskId,
    message,
    ...details,
  };
}

function validatePolicyEngineCompletionRecord(record = {}, {
  pathExists = defaultPathExists,
} = {}) {
  const issues = [];

  if (!record.id) {
    issues.push(buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.MISSING_RECORD_ID,
      'Policy engine completion records must have a stable id.'
    ));
  }

  if (!record.label) {
    issues.push(buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.MISSING_LABEL,
      'Policy engine completion records must have a label.',
      { componentId: record.id || null }
    ));
  }

  if (!record.evidence) {
    issues.push(buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.MISSING_EVIDENCE,
      'Policy engine completion records must describe the completion evidence.',
      { componentId: record.id || null }
    ));
  }

  [
    ['docPath', POLICY_ENGINE_COMPLETION_RISK_IDS.MISSING_DOC_PATH],
    ['servicePath', POLICY_ENGINE_COMPLETION_RISK_IDS.MISSING_SERVICE_PATH],
    ['testPath', POLICY_ENGINE_COMPLETION_RISK_IDS.MISSING_TEST_PATH],
  ].forEach(([fieldName, riskId]) => {
    if (!record[fieldName]) {
      issues.push(buildIssue(
        riskId,
        `Policy engine completion record "${record.id || 'unknown'}" must include ${fieldName}.`,
        { componentId: record.id || null }
      ));
      return;
    }

    if (!pathExists(record[fieldName])) {
      issues.push(buildIssue(
        POLICY_ENGINE_COMPLETION_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
        `Policy engine completion path does not exist: ${record[fieldName]}.`,
        {
          componentId: record.id || null,
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

function buildPolicyEngineArtifactInventoryCutlineAudit({
  artifactPaths = REQUIRED_LEGACY_CUTLINE_ARTIFACT_PATHS,
  artifacts = listPolicyMigrationDeletionArtifacts(),
} = {}) {
  const artifactByPath = new Map(asArray(artifacts).map(artifact => [artifact.path, artifact]));
  const issues = [];

  artifactPaths.forEach(path => {
    if (!artifactByPath.has(path)) {
      issues.push(buildIssue(
        POLICY_ENGINE_COMPLETION_RISK_IDS.LEGACY_ARTIFACT_WITHOUT_CUTLINE,
        `Legacy policy-builder artifact lacks a policy engine cutline decision: ${path}.`,
        { path }
      ));
    }
  });

  asArray(artifacts)
    .filter(artifact =>
      artifact.decisionId !== POLICY_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE &&
      artifact.normalWorkflowAllowed === true
    )
    .forEach(artifact => {
      issues.push(buildIssue(
        POLICY_ENGINE_COMPLETION_RISK_IDS.LEGACY_ARTIFACT_ALLOWED_IN_NORMAL_WORKFLOW,
        `Legacy diagnostic artifact is still allowed in the normal workflow: ${artifact.path}.`,
        { path: artifact.path }
      ));
    });

  const nativeStorageBlocked = asArray(artifacts).some(artifact =>
    artifact.decisionId === POLICY_MIGRATION_ARTIFACT_DECISION_IDS.NATIVE_STORAGE_BLOCKER &&
    artifact.rollbackPlan?.nativeStorageMigrationAllowed !== true
  );

  if (!nativeStorageBlocked) {
    issues.push(buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.NATIVE_STORAGE_NOT_BLOCKED,
      'Policy engine completion requires native storage migration to remain blocked.'
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    checkedArtifactCount: artifactPaths.length,
    classifiedArtifactCount: artifactByPath.size,
    issues,
    nextStep: {
      stepId: 'evidence_engine',
      label: 'Evidence Engine',
      reason: 'Legacy diagnostics have cutline decisions, so the engine can normalize destination evidence without extending the old product model.',
    },
  };
}

function buildComponentAuditMap() {
  return {
    [POLICY_ENGINE_COMPLETION_COMPONENT_IDS.ARTIFACT_INVENTORY_CUTLINE]:
      buildPolicyEngineArtifactInventoryCutlineAudit(),
    [POLICY_ENGINE_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE]:
      buildPolicyEvidenceEngineAudit(),
    [POLICY_ENGINE_COMPLETION_COMPONENT_IDS.INTENT_ENGINE]:
      buildPolicyIntentEngineAudit(),
    [POLICY_ENGINE_COMPLETION_COMPONENT_IDS.LEARNING_GUARD]:
      buildPolicyLearningGuardAudit(),
    [POLICY_ENGINE_COMPLETION_COMPONENT_IDS.READINESS_ENGINE]:
      buildPolicyAutomationReadinessEngineAudit(),
    [POLICY_ENGINE_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW]:
      buildPolicyOperatorWorkflowAudit(),
    [POLICY_ENGINE_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH]:
      buildPolicyMigrationDeletionAudit(),
  };
}

function buildDefaultPolicyEngineCompletionChain() {
  const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
    evidenceInput: {
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        helpfulMatches: ['Disney'],
        routingTargets: ['Radarr Animated Movies'],
      },
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
    },
  });
  const boundedWorkflowResult = buildPolicyOperatorWorkflowFromBoundedReadiness({
    boundedIntentResult,
    boundedReadinessResult,
  });
  const boundedMigrationResult = buildPolicyMigrationDeletionPlanFromBoundedWorkflow({
    boundedWorkflowResult,
  });

  return {
    boundedEvidenceResult,
    boundedIntentResult,
    boundedLearningResult,
    boundedReadinessResult,
    boundedWorkflowResult,
    boundedMigrationResult,
  };
}

function getEvidenceFingerprint(chainStep = {}) {
  return chainStep?.result?.projectionFingerprint?.fingerprint ||
    chainStep?.result?.evidenceBoundary?.projectionFingerprint?.fingerprint ||
    chainStep?.result?.intentBoundary?.evidenceBoundary?.projectionFingerprint?.fingerprint ||
    chainStep?.result?.boundaryContext?.evidenceBoundary?.projectionFingerprint?.fingerprint ||
    chainStep?.result?.boundaryContext?.intentBoundary?.projectionFingerprint?.fingerprint ||
    chainStep?.result?.boundaryContext?.workflowBoundary?.projectionFingerprint?.fingerprint ||
    null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeQualitySnapshot(quality = null) {
  const normalized = asObject(quality);
  const reasonIds = asArray(normalized.reasonIds)
    .map(reasonId => normalizeString(reasonId))
    .filter(Boolean)
    .sort();

  return {
    version: normalized.version || null,
    statusId: normalized.statusId || null,
    score: Number.isFinite(Number(normalized.score)) ? Number(normalized.score) : null,
    nextActionId: normalized.nextActionId || null,
    reasonIds,
    counts: asObject(normalized.counts),
    hasIdentityEvidence: normalized.hasIdentityEvidence === true,
    hasDeclaredIdentityEvidence: normalized.hasDeclaredIdentityEvidence === true,
    hasObservedIdentityEvidence: normalized.hasObservedIdentityEvidence === true,
    hasStaleProfileEvidence: normalized.hasStaleProfileEvidence === true,
  };
}

function hasQualitySnapshot(quality = null) {
  return Boolean(normalizeQualitySnapshot(quality).statusId);
}

function qualitySnapshotsMatch(left = null, right = null) {
  const leftSnapshot = normalizeQualitySnapshot(left);
  const rightSnapshot = normalizeQualitySnapshot(right);

  return Boolean(leftSnapshot.statusId) &&
    leftSnapshot.version === rightSnapshot.version &&
    leftSnapshot.statusId === rightSnapshot.statusId &&
    leftSnapshot.nextActionId === rightSnapshot.nextActionId &&
    leftSnapshot.reasonIds.join('|') === rightSnapshot.reasonIds.join('|');
}

function getQualitySnapshotsForStep(step = {}) {
  const result = asObject(step.result);

  switch (step.stepId) {
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE:
      return [result.projection?.quality];
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.INTENT_ENGINE:
      return [result.evidenceBoundary?.quality];
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.LEARNING_GUARD:
      return [result.intentBoundary?.evidenceBoundary?.quality];
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.READINESS_ENGINE:
      return [
        result.boundaryContext?.evidenceBoundary?.quality,
        result.boundaryContext?.intentBoundary?.quality,
        result.boundaryContext?.learningBoundary?.quality,
      ];
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW:
      return [
        result.boundaryContext?.intentBoundary?.quality,
        result.boundaryContext?.readinessBoundary?.evidenceQuality,
        result.boundaryContext?.readinessBoundary?.intentQuality,
        result.boundaryContext?.readinessBoundary?.learningQuality,
        result.workflow?.boundaryContext?.intentBoundary?.quality,
        result.workflow?.boundaryContext?.readinessBoundary?.evidenceQuality,
        result.workflow?.boundaryContext?.readinessBoundary?.intentQuality,
        result.workflow?.boundaryContext?.readinessBoundary?.learningQuality,
      ];
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH:
      return [result.boundaryContext?.workflowBoundary?.quality];
    default:
      return [];
  }
}

function collectStepQualityIssues(stepSnapshot = {}) {
  const issues = [];
  if (
    stepSnapshot.qualitySnapshotCount === 0 ||
    stepSnapshot.qualitySnapshots.some(quality => !hasQualitySnapshot(quality))
  ) {
    issues.push(buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_MISSING,
      `Policy engine bounded completion chain is missing quality at "${stepSnapshot.stepId}".`,
      { componentId: stepSnapshot.stepId }
    ));
    return issues;
  }

  const insufficientQuality = stepSnapshot.normalizedQualitySnapshots.find(quality =>
    quality.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT
  );
  if (insufficientQuality) {
    issues.push(buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_INSUFFICIENT,
      `Policy engine bounded completion chain carries insufficient quality at "${stepSnapshot.stepId}".`,
      {
        componentId: stepSnapshot.stepId,
        qualityStatusId: insufficientQuality.statusId,
        nextActionId: insufficientQuality.nextActionId,
        reasonIds: insufficientQuality.reasonIds,
      }
    ));
  }

  const referenceQuality = stepSnapshot.qualitySnapshots[0];
  const stepQualityMismatch = stepSnapshot.qualitySnapshots.some(quality =>
    !qualitySnapshotsMatch(referenceQuality, quality)
  );
  if (stepQualityMismatch) {
    issues.push(buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_MISMATCH,
      `Policy engine bounded completion chain has mismatched quality within "${stepSnapshot.stepId}".`,
      { componentId: stepSnapshot.stepId }
    ));
  }

  return issues;
}

function getBoundedStepAuditChecks(step = {}) {
  const result = step.result || {};

  switch (step.stepId) {
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE:
      return [
        {
          auditId: 'projection_audit',
          ok: result.projectionAudit?.ok === true,
        },
        {
          auditId: 'projection_fingerprint_audit',
          ok: result.projectionFingerprintAudit?.ok === true,
        },
      ];
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.INTENT_ENGINE:
      return [
        {
          auditId: 'intent_audit',
          ok: result.intentAudit?.ok === true,
        },
        {
          auditId: 'evidence_fingerprint_audit',
          ok: result.evidenceFingerprintAudit?.ok === true,
        },
      ];
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.LEARNING_GUARD:
      return [
        {
          auditId: 'learning_audit',
          ok: result.learningAudit?.ok === true,
        },
      ];
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.READINESS_ENGINE:
      return [
        {
          auditId: 'readiness_audit',
          ok: result.readinessAudit?.ok === true,
        },
      ];
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW:
      return [
        {
          auditId: 'workflow_audit',
          ok: result.workflowAudit?.ok === true,
        },
      ];
    case POLICY_ENGINE_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH:
      return [
        {
          auditId: 'migration_audit',
          ok: result.migrationAudit?.ok === true,
        },
      ];
    default:
      return [];
  }
}

function getBoundedChainStepSnapshot(step) {
  const fingerprint = getEvidenceFingerprint(step);
  const auditChecks = getBoundedStepAuditChecks(step);
  const qualitySnapshots = getQualitySnapshotsForStep(step);
  const normalizedQualitySnapshots = qualitySnapshots.map(quality =>
    normalizeQualitySnapshot(quality)
  );

  return {
    stepId: step.stepId,
    ok: step.result?.ok === true,
    auditOk: auditChecks.length > 0 && auditChecks.every(check => check.ok === true),
    auditChecks,
    statusId: step.result?.statusId || null,
    issueCount: step.result?.issueCount || 0,
    projectionFingerprint: fingerprint,
    qualityStatusId: normalizedQualitySnapshots[0]?.statusId || null,
    qualitySnapshotCount: qualitySnapshots.length,
    qualityOk:
      qualitySnapshots.length > 0 &&
      qualitySnapshots.every(quality => hasQualitySnapshot(quality)) &&
      normalizedQualitySnapshots.every(quality =>
        quality.statusId !== POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT
      ) &&
      qualitySnapshots.every(quality => qualitySnapshotsMatch(qualitySnapshots[0], quality)),
    qualitySnapshots: normalizedQualitySnapshots.map(quality => ({
      version: quality.version,
      statusId: quality.statusId,
      nextActionId: quality.nextActionId,
      reasonIds: quality.reasonIds,
    })),
    normalizedQualitySnapshots,
  };
}

function containsRawCompletionEvidence(value) {
  const serialized = JSON.stringify(value || {});

  return [
    'Animated Movies',
    'Disney',
    'Radarr Animated Movies',
  ].some(rawValue => serialized.includes(rawValue));
}

function buildPolicyEngineBoundedChainCompletionAudit({
  chain = buildDefaultPolicyEngineCompletionChain(),
} = {}) {
  const steps = [
    {
      stepId: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE,
      result: chain.boundedEvidenceResult,
    },
    {
      stepId: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.INTENT_ENGINE,
      result: chain.boundedIntentResult,
    },
    {
      stepId: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.LEARNING_GUARD,
      result: chain.boundedLearningResult,
    },
    {
      stepId: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.READINESS_ENGINE,
      result: chain.boundedReadinessResult,
    },
    {
      stepId: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW,
      result: chain.boundedWorkflowResult,
    },
    {
      stepId: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH,
      result: chain.boundedMigrationResult,
    },
  ];
  const stepSnapshots = steps.map(getBoundedChainStepSnapshot);
  const fingerprints = stepSnapshots
    .map(step => step.projectionFingerprint)
    .filter(Boolean);
  const uniqueFingerprints = new Set(fingerprints);
  const allQualitySnapshots = stepSnapshots.flatMap(step => step.normalizedQualitySnapshots);
  const issues = [];

  stepSnapshots
    .filter(step => step.ok !== true)
    .forEach(step => {
      issues.push(buildIssue(
        POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_FAILED,
        `Policy engine bounded completion chain failed at "${step.stepId}".`,
        {
          componentId: step.stepId,
          statusId: step.statusId,
          auditIssueCount: step.issueCount,
        }
      ));
    });

  stepSnapshots
    .filter(step => step.ok === true && step.auditOk !== true)
    .forEach(step => {
      issues.push(buildIssue(
        POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_AUDIT_NOT_PASSING,
        `Policy engine bounded completion chain has a non-passing audit at "${step.stepId}".`,
        {
          componentId: step.stepId,
          auditChecks: step.auditChecks,
        }
      ));
    });

  if (fingerprints.length !== steps.length || uniqueFingerprints.size !== 1) {
    issues.push(buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_PROVENANCE_MISMATCH,
      'Policy engine bounded completion chain must carry one shared evidence projection fingerprint.',
      {
        checkedStepCount: steps.length,
        fingerprintCount: fingerprints.length,
        uniqueFingerprintCount: uniqueFingerprints.size,
      }
    ));
  }

  stepSnapshots.forEach(step => {
    issues.push(...collectStepQualityIssues(step));
  });

  if (
    allQualitySnapshots.length === 0 ||
    allQualitySnapshots.some(quality => !hasQualitySnapshot(quality))
  ) {
    issues.push(buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_MISSING,
      'Policy engine bounded completion chain must carry quality snapshots across every handoff.'
    ));
  } else {
    const referenceQuality = allQualitySnapshots[0];
    const chainHasInsufficientQuality = allQualitySnapshots.some(quality =>
      quality.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT
    );
    if (chainHasInsufficientQuality) {
      issues.push(buildIssue(
        POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_INSUFFICIENT,
        'Policy engine bounded completion chain must not carry insufficient quality.'
      ));
    }

    const chainQualityMismatch = allQualitySnapshots.some(quality =>
      !qualitySnapshotsMatch(referenceQuality, quality)
    );
    if (chainQualityMismatch) {
      issues.push(buildIssue(
        POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_MISMATCH,
        'Policy engine bounded completion chain must carry one shared quality snapshot.'
      ));
    }
  }

  if (containsRawCompletionEvidence([
    chain.boundedIntentResult?.evidenceBoundary,
    chain.boundedLearningResult?.intentBoundary,
    chain.boundedReadinessResult?.boundaryContext,
    chain.boundedWorkflowResult?.boundaryContext,
    chain.boundedMigrationResult?.boundaryContext,
  ])) {
    issues.push(buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_RAW_PROVENANCE,
      'Policy engine bounded completion chain must not carry raw evidence labels in boundary provenance.'
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    checkedStepCount: steps.length,
    fingerprintCount: fingerprints.length,
    qualitySnapshotCount: allQualitySnapshots.length,
    qualityStatuses: [...new Set(allQualitySnapshots
      .map(quality => quality.statusId)
      .filter(Boolean))],
    sharedProjectionFingerprint: fingerprints.length === steps.length && uniqueFingerprints.size === 1
      ? fingerprints[0]
      : null,
    steps: stepSnapshots,
    issues,
    nextStep: {
      stepId: 'runtime_decision_inventory',
      label: 'Policy Runtime Decision Inventory',
      reason: 'The policy engine bounded chain is composable, so runtime decision paths can be inventoried against the new contract surface.',
    },
  };
}

function validatePolicyEngineComponentCompletion(record, {
  componentAuditMap = buildComponentAuditMap(),
  pathExists = defaultPathExists,
} = {}) {
  const recordValidation = validatePolicyEngineCompletionRecord(record, { pathExists });
  const issues = [...recordValidation.issues];
  const componentAudit = componentAuditMap[record.id];

  if (!componentAudit) {
    issues.push(buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.MISSING_COMPONENT,
      `No policy engine audit exists for component "${record.id || 'unknown'}".`,
      { componentId: record.id || null }
    ));
  } else {
    if (componentAudit.ok !== true) {
      issues.push(buildIssue(
        POLICY_ENGINE_COMPLETION_RISK_IDS.COMPONENT_AUDIT_FAILED,
        `Policy engine component audit failed for "${record.id}".`,
        {
          componentId: record.id,
          auditIssueCount: componentAudit.issueCount || 0,
        }
      ));
    }

    const actualNextStepId = componentAudit.nextStep?.stepId || null;

    if (record.expectedNextStepId &&
        actualNextStepId !== record.expectedNextStepId) {
      issues.push(buildIssue(
        POLICY_ENGINE_COMPLETION_RISK_IDS.NEXT_STEP_MISMATCH,
        `Policy engine component "${record.id}" points to an unexpected next step.`,
        {
          componentId: record.id,
          expectedNextStepId: record.expectedNextStepId,
          actualNextStepId,
        }
      ));
    }
  }

  return {
    ok: issues.length === 0,
    componentId: record.id || null,
    audit: componentAudit || null,
    issues,
  };
}

function buildPolicyEngineCompletionAudit({
  components = POLICY_ENGINE_COMPONENT_RECORDS,
  componentAuditMap = buildComponentAuditMap(),
  boundedChainAudit = buildPolicyEngineBoundedChainCompletionAudit(),
  pathExists = defaultPathExists,
} = {}) {
  const records = asArray(components);
  const componentResults = records.map(record =>
    validatePolicyEngineComponentCompletion(record, {
      componentAuditMap,
      pathExists,
    })
  );
  const componentIds = new Set(records.map(record => record.id));
  const missingComponentIssues = REQUIRED_COMPONENT_IDS
    .filter(componentId => !componentIds.has(componentId))
    .map(componentId => buildIssue(
      POLICY_ENGINE_COMPLETION_RISK_IDS.MISSING_COMPONENT,
      `Policy engine completion audit is missing required component "${componentId}".`,
      { componentId }
    ));
  const issues = [
    ...componentResults.flatMap(result => result.issues),
    ...missingComponentIssues,
    ...asArray(boundedChainAudit.issues),
  ];

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    checkedComponentCount: componentResults.length,
    requiredComponentCount: REQUIRED_COMPONENT_IDS.length,
    boundedChainOk: boundedChainAudit.ok === true,
    boundedChainAudit,
    componentResults,
    issues,
    nextStep: {
      stepId: 'runtime_decision_inventory',
      label: 'Policy Runtime Decision Inventory',
      reason: 'Policy engine contracts are complete, documented, tested, and migration-gated, so runtime decision paths can be inventoried against them.',
    },
  };
}

function listPolicyEngineCompletionComponents() {
  return POLICY_ENGINE_COMPONENT_RECORDS;
}

function listPolicyEngineRequiredLegacyCutlineArtifacts() {
  return REQUIRED_LEGACY_CUTLINE_ARTIFACT_PATHS;
}

export {
  POLICY_ENGINE_COMPLETION_COMPONENT_IDS,
  POLICY_ENGINE_COMPLETION_RISK_IDS,
  buildPolicyEngineArtifactInventoryCutlineAudit,
  buildPolicyEngineBoundedChainCompletionAudit,
  buildPolicyEngineCompletionAudit,
  listPolicyEngineCompletionComponents,
  listPolicyEngineRequiredLegacyCutlineArtifacts,
  validatePolicyEngineCompletionRecord,
  validatePolicyEngineComponentCompletion,
};
