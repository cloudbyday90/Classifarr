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
  PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS,
  buildPolicyBuilderPhase6MigrationDeletionAudit,
  buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow,
  listPolicyBuilderPhase6MigrationArtifacts,
} from './policyBuilderPhase6MigrationDeletionPath.mjs';
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

const PHASE6R_COMPLETION_COMPONENT_IDS = Object.freeze({
  ARTIFACT_INVENTORY_CUTLINE: '6r_0_artifact_inventory_cutline',
  EVIDENCE_ENGINE: '6r_1_evidence_engine',
  INTENT_ENGINE: '6r_2_intent_engine',
  LEARNING_GUARD: '6r_3_learning_guard',
  READINESS_ENGINE: '6r_4_readiness_engine',
  OPERATOR_WORKFLOW: '6r_5_operator_workflow',
  MIGRATION_DELETION_PATH: '6r_6_migration_deletion_path',
});

const PHASE6R_COMPLETION_RISK_IDS = Object.freeze({
  MISSING_COMPONENT: 'missing_component',
  MISSING_RECORD_ID: 'missing_record_id',
  MISSING_LABEL: 'missing_label',
  MISSING_EVIDENCE: 'missing_evidence',
  MISSING_DOC_PATH: 'missing_doc_path',
  MISSING_SERVICE_PATH: 'missing_service_path',
  MISSING_TEST_PATH: 'missing_test_path',
  ARTIFACT_PATH_NOT_FOUND: 'artifact_path_not_found',
  COMPONENT_AUDIT_FAILED: 'component_audit_failed',
  NEXT_PHASE_MISMATCH: 'next_phase_mismatch',
  LEGACY_ARTIFACT_WITHOUT_CUTLINE: 'legacy_artifact_without_cutline',
  LEGACY_ARTIFACT_ALLOWED_IN_NORMAL_WORKFLOW: 'legacy_artifact_allowed_in_normal_workflow',
  PHASE8_STORAGE_NOT_BLOCKED: 'phase8_storage_not_blocked',
  BOUNDED_CHAIN_FAILED: 'bounded_chain_failed',
  BOUNDED_CHAIN_AUDIT_NOT_PASSING: 'bounded_chain_audit_not_passing',
  BOUNDED_CHAIN_PROVENANCE_MISMATCH: 'bounded_chain_provenance_mismatch',
  BOUNDED_CHAIN_RAW_PROVENANCE: 'bounded_chain_raw_provenance',
  BOUNDED_CHAIN_QUALITY_MISSING: 'bounded_chain_quality_missing',
  BOUNDED_CHAIN_QUALITY_INSUFFICIENT: 'bounded_chain_quality_insufficient',
  BOUNDED_CHAIN_QUALITY_MISMATCH: 'bounded_chain_quality_mismatch',
});

const REQUIRED_COMPONENT_IDS = Object.freeze(Object.values(PHASE6R_COMPLETION_COMPONENT_IDS));

const PHASE6R_COMPONENT_RECORDS = Object.freeze([
  {
    id: PHASE6R_COMPLETION_COMPONENT_IDS.ARTIFACT_INVENTORY_CUTLINE,
    label: 'Artifact inventory and cutline',
    docPath: 'docs/architecture/policy-builder-intent-model-roadmap.md',
    servicePath: 'server/src/services/policyBuilderPhase6MigrationDeletionPath.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase6MigrationDeletionPath.test.mjs',
    expectedNextPhaseId: '6r_1',
    evidence: 'Legacy policy-builder diagnostics have explicit verifier, deletion, keep, or Phase 8 blocker decisions.',
  },
  {
    id: PHASE6R_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE,
    label: 'Evidence engine',
    docPath: 'docs/architecture/policy-builder-phase-6r-evidence-engine.md',
    servicePath: 'server/src/services/policyEvidenceEngine.mjs',
    testPath: 'server/src/__tests__/services/policyEvidenceEngine.test.mjs',
    expectedNextPhaseId: '6r_2',
    evidence: 'Evidence buckets and sources are server-owned and exclude live provider/UI payload authority.',
  },
  {
    id: PHASE6R_COMPLETION_COMPONENT_IDS.INTENT_ENGINE,
    label: 'Intent engine',
    docPath: 'docs/architecture/policy-builder-phase-6r-intent-engine.md',
    servicePath: 'server/src/services/policyIntentEngine.mjs',
    testPath: 'server/src/__tests__/services/policyIntentEngine.test.mjs',
    expectedNextPhaseId: '6r_3',
    evidence: 'Evidence is converted into destination intent without direct learning or storage side effects.',
  },
  {
    id: PHASE6R_COMPLETION_COMPONENT_IDS.LEARNING_GUARD,
    label: 'Learning guard',
    docPath: 'docs/architecture/policy-builder-phase-6r-learning-guard.md',
    servicePath: 'server/src/services/policyLearningGuard.mjs',
    testPath: 'server/src/__tests__/services/policyLearningGuard.test.mjs',
    expectedNextPhaseId: '6r_4',
    evidence: 'Final outcomes are separated from durable learning tiers and blocked learning sources.',
  },
  {
    id: PHASE6R_COMPLETION_COMPONENT_IDS.READINESS_ENGINE,
    label: 'Automation readiness engine',
    docPath: 'docs/architecture/policy-builder-phase-6r-readiness-engine.md',
    servicePath: 'server/src/services/policyAutomationReadinessEngine.mjs',
    testPath: 'server/src/__tests__/services/policyAutomationReadinessEngine.test.mjs',
    expectedNextPhaseId: '6r_5',
    evidence: 'Readiness returns one action-oriented state and ignores legacy diagnostic gates.',
  },
  {
    id: PHASE6R_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW,
    label: 'Operator workflow rebuild',
    docPath: 'docs/architecture/policy-builder-phase-6r-operator-workflow.md',
    servicePath: 'server/src/services/policyOperatorWorkflow.mjs',
    testPath: 'server/src/__tests__/services/policyOperatorWorkflow.test.mjs',
    expectedNextPhaseId: '6r_6',
    evidence: 'Normal workflow is destination-first and excludes replay/provider/TMDB/scoring diagnostics.',
  },
  {
    id: PHASE6R_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH,
    label: 'Migration and deletion path',
    docPath: 'docs/architecture/policy-builder-phase-6r-migration-deletion-path.md',
    servicePath: 'server/src/services/policyBuilderPhase6MigrationDeletionPath.mjs',
    testPath: 'server/src/__tests__/services/policyBuilderPhase6MigrationDeletionPath.test.mjs',
    expectedNextPhaseId: '7r_1',
    evidence: 'Legacy diagnostics are migration verifiers or deletion targets with rollback and Phase 8 gates.',
  },
]);

const PHASE6R_COMPONENT_NEXT_STEP_PHASE_IDS = Object.freeze({
  [PHASE6R_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE]: Object.freeze({
    intent_inference: '6r_2',
  }),
  [PHASE6R_COMPLETION_COMPONENT_IDS.INTENT_ENGINE]: Object.freeze({
    learning_eligibility: '6r_3',
  }),
  [PHASE6R_COMPLETION_COMPONENT_IDS.LEARNING_GUARD]: Object.freeze({
    automation_readiness: '6r_4',
  }),
  [PHASE6R_COMPLETION_COMPONENT_IDS.READINESS_ENGINE]: Object.freeze({
    operator_workflow: '6r_5',
  }),
  [PHASE6R_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW]: Object.freeze({
    migration_deletion_path: '6r_6',
  }),
});

const REQUIRED_LEGACY_CUTLINE_ARTIFACT_PATHS = Object.freeze([
  'client/src/components/policies/PolicyIntentImpactPreviewCard.vue',
  'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
  'client/src/composables/usePolicyIntentImpactPreview.js',
  'client/src/composables/usePolicyIntentReplayPreview.js',
  'client/src/utils/policyIntentImpactPreview.js',
  'client/src/utils/policyIntentReplayPreview.js',
  'server/src/routes/policiesRoutePolicyWrite.mjs',
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
  'docs/architecture/policy-builder-phase-6-implementation.md',
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

function validatePhase6CompletionRecord(record = {}, {
  pathExists = defaultPathExists,
} = {}) {
  const issues = [];

  if (!record.id) {
    issues.push(buildIssue(
      PHASE6R_COMPLETION_RISK_IDS.MISSING_RECORD_ID,
      'Phase 6R completion records must have a stable id.'
    ));
  }

  if (!record.label) {
    issues.push(buildIssue(
      PHASE6R_COMPLETION_RISK_IDS.MISSING_LABEL,
      'Phase 6R completion records must have a label.',
      { componentId: record.id || null }
    ));
  }

  if (!record.evidence) {
    issues.push(buildIssue(
      PHASE6R_COMPLETION_RISK_IDS.MISSING_EVIDENCE,
      'Phase 6R completion records must describe the completion evidence.',
      { componentId: record.id || null }
    ));
  }

  [
    ['docPath', PHASE6R_COMPLETION_RISK_IDS.MISSING_DOC_PATH],
    ['servicePath', PHASE6R_COMPLETION_RISK_IDS.MISSING_SERVICE_PATH],
    ['testPath', PHASE6R_COMPLETION_RISK_IDS.MISSING_TEST_PATH],
  ].forEach(([fieldName, riskId]) => {
    if (!record[fieldName]) {
      issues.push(buildIssue(
        riskId,
        `Phase 6R completion record "${record.id || 'unknown'}" must include ${fieldName}.`,
        { componentId: record.id || null }
      ));
      return;
    }

    if (!pathExists(record[fieldName])) {
      issues.push(buildIssue(
        PHASE6R_COMPLETION_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
        `Phase 6R completion path does not exist: ${record[fieldName]}.`,
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

function buildPolicyBuilderPhase6ArtifactInventoryCutlineAudit({
  artifactPaths = REQUIRED_LEGACY_CUTLINE_ARTIFACT_PATHS,
  artifacts = listPolicyBuilderPhase6MigrationArtifacts(),
} = {}) {
  const artifactByPath = new Map(asArray(artifacts).map(artifact => [artifact.path, artifact]));
  const issues = [];

  artifactPaths.forEach(path => {
    if (!artifactByPath.has(path)) {
      issues.push(buildIssue(
        PHASE6R_COMPLETION_RISK_IDS.LEGACY_ARTIFACT_WITHOUT_CUTLINE,
        `Legacy Phase 6 policy-builder artifact lacks a Phase 6R cutline decision: ${path}.`,
        { path }
      ));
    }
  });

  asArray(artifacts)
    .filter(artifact =>
      artifact.decisionId !== PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE &&
      artifact.normalWorkflowAllowed === true
    )
    .forEach(artifact => {
      issues.push(buildIssue(
        PHASE6R_COMPLETION_RISK_IDS.LEGACY_ARTIFACT_ALLOWED_IN_NORMAL_WORKFLOW,
        `Legacy diagnostic artifact is still allowed in the normal workflow: ${artifact.path}.`,
        { path: artifact.path }
      ));
    });

  const phase8Blocked = asArray(artifacts).some(artifact =>
    artifact.decisionId === PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.PHASE8_STORAGE_BLOCKER &&
    artifact.rollbackPlan?.phase8StorageMigrationAllowed !== true
  );

  if (!phase8Blocked) {
    issues.push(buildIssue(
      PHASE6R_COMPLETION_RISK_IDS.PHASE8_STORAGE_NOT_BLOCKED,
      'Phase 6R completion requires Phase 8 native storage migration to remain blocked.'
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    checkedArtifactCount: artifactPaths.length,
    classifiedArtifactCount: artifactByPath.size,
    issues,
    nextPhase: {
      phaseId: '6r_1',
      label: 'Evidence Engine',
      reason: 'Legacy diagnostics have cutline decisions, so the engine can normalize destination evidence without extending the old product model.',
    },
  };
}

function buildComponentAuditMap() {
  return {
    [PHASE6R_COMPLETION_COMPONENT_IDS.ARTIFACT_INVENTORY_CUTLINE]:
      buildPolicyBuilderPhase6ArtifactInventoryCutlineAudit(),
    [PHASE6R_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE]:
      buildPolicyEvidenceEngineAudit(),
    [PHASE6R_COMPLETION_COMPONENT_IDS.INTENT_ENGINE]:
      buildPolicyIntentEngineAudit(),
    [PHASE6R_COMPLETION_COMPONENT_IDS.LEARNING_GUARD]:
      buildPolicyLearningGuardAudit(),
    [PHASE6R_COMPLETION_COMPONENT_IDS.READINESS_ENGINE]:
      buildPolicyAutomationReadinessEngineAudit(),
    [PHASE6R_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW]:
      buildPolicyOperatorWorkflowAudit(),
    [PHASE6R_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH]:
      buildPolicyBuilderPhase6MigrationDeletionAudit(),
  };
}

function buildDefaultPhase6BoundedCompletionChain() {
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
  const boundedMigrationResult = buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow({
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
    case PHASE6R_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE:
      return [result.projection?.quality];
    case PHASE6R_COMPLETION_COMPONENT_IDS.INTENT_ENGINE:
      return [result.evidenceBoundary?.quality];
    case PHASE6R_COMPLETION_COMPONENT_IDS.LEARNING_GUARD:
      return [result.intentBoundary?.evidenceBoundary?.quality];
    case PHASE6R_COMPLETION_COMPONENT_IDS.READINESS_ENGINE:
      return [
        result.boundaryContext?.evidenceBoundary?.quality,
        result.boundaryContext?.intentBoundary?.quality,
        result.boundaryContext?.learningBoundary?.quality,
      ];
    case PHASE6R_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW:
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
    case PHASE6R_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH:
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
      PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_MISSING,
      `Phase 6R bounded completion chain is missing quality at "${stepSnapshot.stepId}".`,
      { componentId: stepSnapshot.stepId }
    ));
    return issues;
  }

  const insufficientQuality = stepSnapshot.normalizedQualitySnapshots.find(quality =>
    quality.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT
  );
  if (insufficientQuality) {
    issues.push(buildIssue(
      PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_INSUFFICIENT,
      `Phase 6R bounded completion chain carries insufficient quality at "${stepSnapshot.stepId}".`,
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
      PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_MISMATCH,
      `Phase 6R bounded completion chain has mismatched quality within "${stepSnapshot.stepId}".`,
      { componentId: stepSnapshot.stepId }
    ));
  }

  return issues;
}

function getBoundedStepAuditChecks(step = {}) {
  const result = step.result || {};

  switch (step.stepId) {
    case PHASE6R_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE:
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
    case PHASE6R_COMPLETION_COMPONENT_IDS.INTENT_ENGINE:
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
    case PHASE6R_COMPLETION_COMPONENT_IDS.LEARNING_GUARD:
      return [
        {
          auditId: 'learning_audit',
          ok: result.learningAudit?.ok === true,
        },
      ];
    case PHASE6R_COMPLETION_COMPONENT_IDS.READINESS_ENGINE:
      return [
        {
          auditId: 'readiness_audit',
          ok: result.readinessAudit?.ok === true,
        },
      ];
    case PHASE6R_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW:
      return [
        {
          auditId: 'workflow_audit',
          ok: result.workflowAudit?.ok === true,
        },
      ];
    case PHASE6R_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH:
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

function buildPolicyBuilderPhase6BoundedChainCompletionAudit({
  chain = buildDefaultPhase6BoundedCompletionChain(),
} = {}) {
  const steps = [
    {
      stepId: PHASE6R_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE,
      result: chain.boundedEvidenceResult,
    },
    {
      stepId: PHASE6R_COMPLETION_COMPONENT_IDS.INTENT_ENGINE,
      result: chain.boundedIntentResult,
    },
    {
      stepId: PHASE6R_COMPLETION_COMPONENT_IDS.LEARNING_GUARD,
      result: chain.boundedLearningResult,
    },
    {
      stepId: PHASE6R_COMPLETION_COMPONENT_IDS.READINESS_ENGINE,
      result: chain.boundedReadinessResult,
    },
    {
      stepId: PHASE6R_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW,
      result: chain.boundedWorkflowResult,
    },
    {
      stepId: PHASE6R_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH,
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
        PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_FAILED,
        `Phase 6R bounded completion chain failed at "${step.stepId}".`,
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
        PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_AUDIT_NOT_PASSING,
        `Phase 6R bounded completion chain has a non-passing audit at "${step.stepId}".`,
        {
          componentId: step.stepId,
          auditChecks: step.auditChecks,
        }
      ));
    });

  if (fingerprints.length !== steps.length || uniqueFingerprints.size !== 1) {
    issues.push(buildIssue(
      PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_PROVENANCE_MISMATCH,
      'Phase 6R bounded completion chain must carry one shared evidence projection fingerprint.',
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
      PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_MISSING,
      'Phase 6R bounded completion chain must carry quality snapshots across every handoff.'
    ));
  } else {
    const referenceQuality = allQualitySnapshots[0];
    const chainHasInsufficientQuality = allQualitySnapshots.some(quality =>
      quality.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT
    );
    if (chainHasInsufficientQuality) {
      issues.push(buildIssue(
        PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_INSUFFICIENT,
        'Phase 6R bounded completion chain must not carry insufficient quality.'
      ));
    }

    const chainQualityMismatch = allQualitySnapshots.some(quality =>
      !qualitySnapshotsMatch(referenceQuality, quality)
    );
    if (chainQualityMismatch) {
      issues.push(buildIssue(
        PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_MISMATCH,
        'Phase 6R bounded completion chain must carry one shared quality snapshot.'
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
      PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_RAW_PROVENANCE,
      'Phase 6R bounded completion chain must not carry raw evidence labels in boundary provenance.'
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
    nextPhase: {
      phaseId: '7r_1',
      label: 'Runtime Decision Inventory And Cutline',
      reason: 'The Phase 6R bounded chain is composable, so runtime decision paths can be inventoried against the new contract surface.',
    },
  };
}

function validatePhase6ComponentCompletion(record, {
  componentAuditMap = buildComponentAuditMap(),
  pathExists = defaultPathExists,
} = {}) {
  const recordValidation = validatePhase6CompletionRecord(record, { pathExists });
  const issues = [...recordValidation.issues];
  const componentAudit = componentAuditMap[record.id];

  if (!componentAudit) {
    issues.push(buildIssue(
      PHASE6R_COMPLETION_RISK_IDS.MISSING_COMPONENT,
      `No Phase 6R audit exists for component "${record.id || 'unknown'}".`,
      { componentId: record.id || null }
    ));
  } else {
    if (componentAudit.ok !== true) {
      issues.push(buildIssue(
        PHASE6R_COMPLETION_RISK_IDS.COMPONENT_AUDIT_FAILED,
        `Phase 6R component audit failed for "${record.id}".`,
        {
          componentId: record.id,
          auditIssueCount: componentAudit.issueCount || 0,
        }
      ));
    }

    const actualNextPhaseId = componentAudit.nextPhase?.phaseId ||
      PHASE6R_COMPONENT_NEXT_STEP_PHASE_IDS[record.id]?.[componentAudit.nextStep?.stepId] ||
      null;

    if (record.expectedNextPhaseId &&
        actualNextPhaseId !== record.expectedNextPhaseId) {
      issues.push(buildIssue(
        PHASE6R_COMPLETION_RISK_IDS.NEXT_PHASE_MISMATCH,
        `Phase 6R component "${record.id}" points to an unexpected next phase.`,
        {
          componentId: record.id,
          expectedNextPhaseId: record.expectedNextPhaseId,
          actualNextPhaseId,
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

function buildPolicyBuilderPhase6CompletionAudit({
  components = PHASE6R_COMPONENT_RECORDS,
  componentAuditMap = buildComponentAuditMap(),
  boundedChainAudit = buildPolicyBuilderPhase6BoundedChainCompletionAudit(),
  pathExists = defaultPathExists,
} = {}) {
  const records = asArray(components);
  const componentResults = records.map(record =>
    validatePhase6ComponentCompletion(record, {
      componentAuditMap,
      pathExists,
    })
  );
  const componentIds = new Set(records.map(record => record.id));
  const missingComponentIssues = REQUIRED_COMPONENT_IDS
    .filter(componentId => !componentIds.has(componentId))
    .map(componentId => buildIssue(
      PHASE6R_COMPLETION_RISK_IDS.MISSING_COMPONENT,
      `Phase 6R completion audit is missing required component "${componentId}".`,
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
    nextPhase: {
      phaseId: '7r_1',
      label: 'Runtime Decision Inventory And Cutline',
      reason: 'Phase 6R contracts are complete, documented, tested, and migration-gated, so runtime decision paths can be inventoried against them.',
    },
  };
}

function listPolicyBuilderPhase6CompletionComponents() {
  return PHASE6R_COMPONENT_RECORDS;
}

function listPolicyBuilderPhase6RequiredLegacyCutlineArtifacts() {
  return REQUIRED_LEGACY_CUTLINE_ARTIFACT_PATHS;
}

export {
  PHASE6R_COMPLETION_COMPONENT_IDS,
  PHASE6R_COMPLETION_RISK_IDS,
  buildPolicyBuilderPhase6ArtifactInventoryCutlineAudit,
  buildPolicyBuilderPhase6BoundedChainCompletionAudit,
  buildPolicyBuilderPhase6CompletionAudit,
  listPolicyBuilderPhase6CompletionComponents,
  listPolicyBuilderPhase6RequiredLegacyCutlineArtifacts,
  validatePhase6CompletionRecord,
  validatePhase6ComponentCompletion,
};
