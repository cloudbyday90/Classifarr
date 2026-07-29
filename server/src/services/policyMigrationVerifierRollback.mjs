import { createHash } from 'node:crypto';

import {
  POLICY_MIGRATION_ARTIFACT_DECISION_IDS,
  buildPolicyMigrationDeletionPlan,
  validatePolicyMigrationDeletionPlan,
} from './policyMigrationDeletionPath.mjs';
import {
  POLICY_REBUILD_PROPOSAL_STATUS_IDS,
  buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput,
  validatePolicyLibraryPolicyRebuildProposal,
} from './policyLibraryPolicyRebuild.mjs';
import {
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_TRANSITION_VERSION,
  validatePolicyLibraryRebuildAcceptanceTransition,
} from './policyLibraryRebuildAcceptanceTransition.mjs';
import {
  POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS,
  POLICY_MIGRATION_PREVIEW_STATUS_IDS,
  buildPolicyMigrationPreview,
  normalizePolicyMigrationPreviewClassification,
  normalizePolicyMigrationPreviewOptions,
  validatePolicyMigrationPreview,
} from './policyMigrationPreviewContract.mjs';

const POLICY_MIGRATION_DIFFERENCE_TYPE_IDS =
  POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS;

const POLICY_MIGRATION_VERIFIER_STATUS_IDS = POLICY_MIGRATION_PREVIEW_STATUS_IDS;

const POLICY_MIGRATION_VERIFIER_REASON_IDS = Object.freeze({
  PROPOSAL_VALIDATED: 'proposal_validated',
  LEGACY_COMPARISON_CONSUMED: 'legacy_comparison_consumed',
  BOUNDED_DIFFERENCES_EMITTED: 'bounded_differences_emitted',
  MIGRATION_RELEVANT_ONLY: 'migration_relevant_only',
  OPERATOR_ACCEPTANCE_REQUIRED: 'operator_acceptance_required',
  ROLLBACK_SNAPSHOT_REQUIRED: 'rollback_snapshot_required',
  DELETION_CRITERIA_DEFINED: 'deletion_criteria_defined',
  SIDE_EFFECTS_DISABLED: 'side_effects_disabled',
});

const POLICY_MIGRATION_DELETION_CRITERION_IDS = Object.freeze({
  NATIVE_INTENT_STORAGE_STABLE: 'native_intent_storage_stable',
  VERIFIER_PASSED: 'verifier_passed',
  ROLLBACK_SNAPSHOT_CREATED: 'rollback_snapshot_created',
  ROLLBACK_WINDOW_ACTIVE: 'rollback_window_active',
  DELETE_CHECKLIST_APPROVED: 'delete_checklist_approved',
  LEGACY_ARTIFACTS_CLASSIFIED: 'legacy_artifacts_classified',
  CUSTOM_SIGNAL_REPLACEMENT_DEFINED: 'custom_signal_replacement_defined',
});

const POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS = Object.freeze({
  MISSING_REPORT_VERSION: 'missing_report_version',
  INVALID_PROPOSAL: 'invalid_proposal',
  MISSING_PROPOSAL_VALIDATION: 'missing_proposal_validation',
  PROPOSAL_VALIDATION_MISMATCH: 'proposal_validation_mismatch',
  INVALID_MIGRATION_PLAN: 'invalid_migration_plan',
  INVALID_MIGRATION_PREVIEW: 'invalid_migration_preview',
  MIGRATION_PREVIEW_REPORT_MISMATCH: 'migration_preview_report_mismatch',
  UNKNOWN_DIFFERENCE_TYPE: 'unknown_difference_type',
  NON_MIGRATION_RELEVANT_DIFFERENCE: 'non_migration_relevant_difference',
  UNBOUNDED_DIFFERENCE_OUTPUT: 'unbounded_difference_output',
  RAW_PAYLOAD_EXPOSED: 'raw_payload_exposed',
  NORMAL_WORKFLOW_SURFACE: 'normal_workflow_surface',
  MISSING_APPLICATION_GATE: 'missing_application_gate',
  MISSING_ACCEPTANCE_TRANSITION: 'missing_acceptance_transition',
  INVALID_ACCEPTANCE_TRANSITION: 'invalid_acceptance_transition',
  ACCEPTANCE_TRANSITION_PROVENANCE_MISMATCH: 'acceptance_transition_provenance_mismatch',
  CAN_VERIFY_WITHOUT_ACCEPTANCE_TRANSITION: 'can_verify_without_acceptance_transition',
  CAN_APPLY_WITHOUT_OPERATOR_ACCEPTANCE: 'can_apply_without_operator_acceptance',
  CAN_APPLY_WITHOUT_ROLLBACK: 'can_apply_without_rollback',
  MISSING_ROLLBACK_PATH: 'missing_rollback_path',
  CAN_DELETE_BEFORE_NATIVE_INTENT_STABLE: 'can_delete_before_native_intent_stable',
  CAN_DELETE_WITHOUT_VERIFIER_PASS: 'can_delete_without_verifier_pass',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_TRACE_REASON: 'missing_trace_reason',
  MISSING_SAMPLE_SET_FINGERPRINT: 'missing_sample_set_fingerprint',
  MALFORMED_SAMPLE_SET_FINGERPRINT: 'malformed_sample_set_fingerprint',
  TRACE_SAMPLE_SET_FINGERPRINT_MISMATCH: 'trace_sample_set_fingerprint_mismatch',
  SAMPLE_SET_PROVENANCE_MISMATCH: 'sample_set_provenance_mismatch',
});

const SAMPLE_SET_FINGERPRINT_VERSION = 'policy.migration_verifier_sample_set_fingerprint.v1';
const SAMPLE_SET_FINGERPRINT_TRACE_ATTRIBUTE =
  'classifarr.policy.migration_verifier.sample_set_fingerprint';
const ACCEPTANCE_TRANSITION_FINGERPRINT_TRACE_ATTRIBUTE =
  'classifarr.policy.migration_verifier.acceptance_transition_fingerprint';
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

const MIGRATION_RELEVANT_DIFFERENCE_TYPES = Object.freeze(
  Object.values(POLICY_MIGRATION_DIFFERENCE_TYPE_IDS)
);
const MIGRATION_VERIFIER_REDUCER_INPUT_KEYS = new Set([
  'proposal',
  'migrationPlan',
  'maxDifferences',
  'confidenceDeltaThreshold',
  'representativeClassifications',
  'legacyComparisonSamples',
  'acceptanceTransition',
  'deletionCriteria',
  'now',
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

function buildSampleSetFingerprint({
  samples,
  proposal,
  acceptanceTransition,
  maxDifferences,
  confidenceDeltaThreshold,
}) {
  const proposalGuardedOutcomeSummary = asObject(proposal.evidenceSourceSummary?.guardedOutcomes);
  const proposalGuardedOutcomeFingerprints = asArray(proposalGuardedOutcomeSummary.fingerprints)
    .map(String)
    .sort();
  const payload = {
    version: SAMPLE_SET_FINGERPRINT_VERSION,
    proposal: {
      version: proposal.version || null,
      statusId: proposal.statusId || null,
      libraryId: proposal.library?.libraryId ?? null,
      mediaType: proposal.library?.mediaType || null,
      guardedOutcomeFingerprints: proposalGuardedOutcomeFingerprints,
      guardedOutcomeFingerprintCount: proposalGuardedOutcomeSummary.fingerprintCount ?? 0,
      guardedOutcomeMissingFingerprintCount: proposalGuardedOutcomeSummary.missingFingerprintCount ?? 0,
      guardedOutcomeRequestProofCount: proposalGuardedOutcomeSummary.requestProofCount ?? 0,
      guardedOutcomeMissingRequestProofCount: proposalGuardedOutcomeSummary.missingRequestProofCount ?? 0,
      guardedOutcomeInvalidRequestProofCount: proposalGuardedOutcomeSummary.invalidRequestProofCount ?? 0,
    },
    acceptanceTransition: {
      version: acceptanceTransition.version || null,
      statusId: acceptanceTransition.statusId || null,
      fingerprint: acceptanceTransition.transitionFingerprint?.fingerprint || null,
    },
    verifierOptions: {
      maxDifferences,
      confidenceDeltaThreshold,
    },
    samples: asArray(samples).map(sample => ({
      itemId: sample.itemId,
      year: sample.year,
      mediaType: sample.mediaType,
      legacy: sample.legacy,
      proposed: sample.generatedIntent,
      exposesRawPayload: sample.exposesRawPayload,
    })),
  };

  return {
    version: SAMPLE_SET_FINGERPRINT_VERSION,
    algorithm: 'sha256',
    fingerprint: sha256(payload),
    provenance: {
      sampleCount: asArray(samples).length,
      rawPayloadSuppressed: asArray(samples).some(sample => sample.exposesRawPayload),
      maxDifferences,
      confidenceDeltaThreshold,
      proposalVersion: proposal.version || null,
      proposalStatusId: proposal.statusId || null,
      proposalGuardedOutcomeFingerprintCount: proposalGuardedOutcomeSummary.fingerprintCount ?? 0,
      proposalGuardedOutcomeMissingFingerprintCount: proposalGuardedOutcomeSummary.missingFingerprintCount ?? 0,
      proposalGuardedOutcomeRequestProofCount: proposalGuardedOutcomeSummary.requestProofCount ?? 0,
      proposalGuardedOutcomeMissingRequestProofCount: proposalGuardedOutcomeSummary.missingRequestProofCount ?? 0,
      proposalGuardedOutcomeInvalidRequestProofCount: proposalGuardedOutcomeSummary.invalidRequestProofCount ?? 0,
      proposalGuardedOutcomeFingerprints,
      acceptanceTransitionVersion: acceptanceTransition.version || null,
      acceptanceTransitionStatusId: acceptanceTransition.statusId || null,
      acceptanceTransitionFingerprint:
        acceptanceTransition.transitionFingerprint?.fingerprint || null,
    },
  };
}

function buildApplicationGate({ acceptanceTransition, statusId }) {
  const rollbackPlan = asObject(acceptanceTransition.rollbackWindowPlan);
  const rollbackSnapshot = {
    required: true,
    planned: rollbackPlan.snapshot?.planned === true,
    created: false,
    snapshotId: null,
    restorePath: normalizeString(rollbackPlan.snapshot?.restorePath),
    expiresAt: normalizeString(rollbackPlan.snapshot?.expiresAt),
    retentionWindowDays: Number.isFinite(Number(rollbackPlan.retention?.windowDays))
      ? Math.max(0, Math.trunc(Number(rollbackPlan.retention.windowDays)))
      : null,
  };

  return {
    requiresOperatorAcceptance: true,
    operatorAccepted: acceptanceTransition.acceptance?.accepted === true,
    acceptanceTransition: {
      version: acceptanceTransition.version || null,
      statusId: acceptanceTransition.statusId || null,
      fingerprint: acceptanceTransition.transitionFingerprint?.fingerprint || null,
      expiresAt: acceptanceTransition.acceptance?.expiresAt || null,
    },
    requiresRollbackSnapshot: true,
    rollbackSnapshot,
    canEnterMigrationVerification:
      acceptanceTransition.application?.canEnterMigrationVerification === true,
    canApplyReplacement: false,
    requiresPersistedRollbackSnapshot: true,
    replacementBlockedReason: statusId === POLICY_MIGRATION_VERIFIER_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK
      ? 'migration_risk_blocked'
      : statusId === POLICY_MIGRATION_VERIFIER_STATUS_IDS.INSUFFICIENT_REPRESENTATIVE_COVERAGE
        ? 'representative_coverage_required'
      : 'persisted_rollback_snapshot_required',
  };
}

function buildDeletionCriteria({ input, migrationPreview, migrationPlan, applicationGate }) {
  const criteriaInput = asObject(input.deletionCriteria);
  const verifierPassed =
    migrationPreview.statusId === POLICY_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES &&
    migrationPreview.representativeSummary?.coverageSufficient === true;
  const deleteTargetCount = asArray(migrationPlan.artifacts)
    .filter(artifact =>
      artifact.decisionId === POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION
    ).length;

  const criteria = [
    {
      criterionId: POLICY_MIGRATION_DELETION_CRITERION_IDS.NATIVE_INTENT_STORAGE_STABLE,
      met: criteriaInput.nativeIntentStorageStable === true,
      summary: 'Native intent storage has proven stable.',
    },
    {
      criterionId: POLICY_MIGRATION_DELETION_CRITERION_IDS.VERIFIER_PASSED,
      met: verifierPassed,
      summary: 'Migration verifier found no behavior-sensitive differences.',
    },
    {
      criterionId: POLICY_MIGRATION_DELETION_CRITERION_IDS.ROLLBACK_SNAPSHOT_CREATED,
      met: applicationGate.rollbackSnapshot.created === true,
      summary: 'Rollback snapshot exists for the replacement window.',
    },
    {
      criterionId: POLICY_MIGRATION_DELETION_CRITERION_IDS.ROLLBACK_WINDOW_ACTIVE,
      met: criteriaInput.rollbackWindowActive === true,
      summary: 'Rollback retention window is active.',
    },
    {
      criterionId: POLICY_MIGRATION_DELETION_CRITERION_IDS.DELETE_CHECKLIST_APPROVED,
      met: criteriaInput.deleteChecklistApproved === true,
      summary: 'Deletion checklist has been approved.',
    },
    {
      criterionId: POLICY_MIGRATION_DELETION_CRITERION_IDS.LEGACY_ARTIFACTS_CLASSIFIED,
      met: deleteTargetCount > 0,
      summary: 'Legacy artifacts have explicit migration/deletion classifications.',
    },
    {
      criterionId: POLICY_MIGRATION_DELETION_CRITERION_IDS.CUSTOM_SIGNAL_REPLACEMENT_DEFINED,
      met: criteriaInput.customSignalReplacementDefined === true,
      summary: 'Custom-signal replacement path is defined for native intent storage.',
    },
  ];

  return {
    canDeleteLegacyPaths: criteria.every(criterion => criterion.met === true),
    deleteTargetCount,
    criteria,
  };
}

function buildTrace({
  statusId,
  differenceSummary,
  boundedDifferences,
  sampleSetFingerprint,
  acceptanceTransition,
}) {
  const reasons = [
    POLICY_MIGRATION_VERIFIER_REASON_IDS.PROPOSAL_VALIDATED,
    POLICY_MIGRATION_VERIFIER_REASON_IDS.LEGACY_COMPARISON_CONSUMED,
    POLICY_MIGRATION_VERIFIER_REASON_IDS.BOUNDED_DIFFERENCES_EMITTED,
    POLICY_MIGRATION_VERIFIER_REASON_IDS.MIGRATION_RELEVANT_ONLY,
    POLICY_MIGRATION_VERIFIER_REASON_IDS.OPERATOR_ACCEPTANCE_REQUIRED,
    POLICY_MIGRATION_VERIFIER_REASON_IDS.ROLLBACK_SNAPSHOT_REQUIRED,
    POLICY_MIGRATION_VERIFIER_REASON_IDS.DELETION_CRITERIA_DEFINED,
    POLICY_MIGRATION_VERIFIER_REASON_IDS.SIDE_EFFECTS_DISABLED,
  ];

  return {
    attributes: {
      'classifarr.policy.migration_verifier.version': 'policy.migration_verifier.v1',
      'classifarr.policy.migration_verifier.status': statusId,
      'classifarr.policy.migration_verifier.difference_count': differenceSummary.totalCount,
      'classifarr.policy.migration_verifier.emitted_difference_count': boundedDifferences.length,
      'classifarr.policy.migration_verifier.truncated': differenceSummary.truncated === true,
      [SAMPLE_SET_FINGERPRINT_TRACE_ATTRIBUTE]: sampleSetFingerprint.fingerprint,
      [ACCEPTANCE_TRANSITION_FINGERPRINT_TRACE_ATTRIBUTE]:
        acceptanceTransition.transitionFingerprint.fingerprint,
    },
    reasons: reasons.map(reasonId => ({
      reasonId,
      severity: 'info',
    })),
  };
}

function requireValidRebuildProposal(input = {}) {
  const verifierInput = asObject(input);
  const unexpectedInputKey = Object.keys(verifierInput).find(key =>
    !MIGRATION_VERIFIER_REDUCER_INPUT_KEYS.has(key)
  );

  if (unexpectedInputKey) {
    throw new TypeError(
      `Migration verifier requires a validated rebuild proposal; raw input key "${unexpectedInputKey}" must use buildPolicyMigrationVerifierReportFromRuntimeInput.`
    );
  }

  const proposal = asObject(verifierInput.proposal);
  if (proposal.version !== 'policy.library_policy_rebuild.v1') {
    throw new TypeError('Migration verifier requires a policy.library_policy_rebuild.v1 proposal.');
  }

  const validation = validatePolicyLibraryPolicyRebuildProposal(proposal);
  if (!validation.ok) {
    throw new TypeError('Migration verifier requires a valid rebuild proposal.');
  }

  return proposal;
}

function requireValidAcceptanceTransition(input = {}, proposal = {}) {
  const acceptanceTransition = asObject(input.acceptanceTransition);
  if (acceptanceTransition.version !== POLICY_LIBRARY_REBUILD_ACCEPTANCE_TRANSITION_VERSION) {
    throw new TypeError(
      'Migration verifier requires a policy.library_rebuild_acceptance_transition.v1 acceptance transition.'
    );
  }

  const transitionValidation = validatePolicyLibraryRebuildAcceptanceTransition({
    transition: acceptanceTransition,
    proposal,
    now: input.now,
  });
  if (!transitionValidation.ok ||
      acceptanceTransition.statusId !==
        POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION ||
      acceptanceTransition.application?.canEnterMigrationVerification !== true) {
    throw new TypeError(
      'Migration verifier requires a current accepted rebuild transition bound to the rebuild proposal and rollback plan.'
    );
  }

  return acceptanceTransition;
}

function buildGeneratedIntentDefault(proposal = {}) {
  return {
    destinationLibraryId: proposal.library?.libraryId ?? null,
    destinationLibraryName: proposal.library?.libraryName ?? '',
    statusId: proposal.statusId,
    routeReady: proposal.readiness?.ready === true,
    blocked: proposal.statusId === POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED,
    needsReview: proposal.statusId !== POLICY_REBUILD_PROPOSAL_STATUS_IDS.READY_FOR_REVIEW,
    confidenceScore: proposal.confidence?.score ?? null,
    confidenceLevel: proposal.confidence?.level ?? '',
  };
}

function getRepresentativeClassifications(input = {}) {
  const hasContractInput = Object.hasOwn(input, 'representativeClassifications');
  const hasLegacyInput = Object.hasOwn(input, 'legacyComparisonSamples');

  if (hasContractInput && hasLegacyInput) {
    throw new TypeError(
      'Migration verifier accepts either representativeClassifications or legacyComparisonSamples, not both.'
    );
  }

  return hasContractInput
    ? input.representativeClassifications
    : input.legacyComparisonSamples;
}

function buildPolicyMigrationVerifierReportFromRebuildProposal(input = {}) {
  const verifierInput = asObject(input);
  const proposal = requireValidRebuildProposal(verifierInput);
  const acceptanceTransition = requireValidAcceptanceTransition(verifierInput, proposal);
  const migrationPlan = verifierInput.migrationPlan?.version === 'policy.migration_deletion_path.v1'
    ? verifierInput.migrationPlan
    : buildPolicyMigrationDeletionPlan();
  const previewOptions = normalizePolicyMigrationPreviewOptions({
    maxDifferences: verifierInput.maxDifferences,
    confidenceDeltaThreshold: verifierInput.confidenceDeltaThreshold,
  });
  const generatedIntentDefault = buildGeneratedIntentDefault(proposal);
  const samples = asArray(getRepresentativeClassifications(verifierInput))
    .map(sample => normalizePolicyMigrationPreviewClassification(sample, generatedIntentDefault));
  const sampleSetFingerprint = buildSampleSetFingerprint({
    samples,
    proposal,
    acceptanceTransition,
    ...previewOptions,
  });
  const migrationPreview = buildPolicyMigrationPreview({
    representativeClassifications: samples,
    generatedIntentDefault,
    ...previewOptions,
  });
  const statusId = migrationPreview.statusId;
  const applicationGate = buildApplicationGate({
    acceptanceTransition,
    statusId,
  });
  const deletionReadiness = buildDeletionCriteria({
    input: verifierInput,
    migrationPreview,
    migrationPlan,
    applicationGate,
  });

  return {
    version: 'policy.migration_verifier.v1',
    statusId,
    proposal,
    acceptanceTransition,
    proposalValidation: validatePolicyLibraryPolicyRebuildProposal(proposal),
    migrationPlanValidation: validatePolicyMigrationDeletionPlan(migrationPlan),
    migrationPreview,
    sampleSummary: {
      comparedCount: migrationPreview.representativeSummary.comparedCount,
      rawPayloadSuppressed: migrationPreview.representativeSummary.rawPayloadSuppressed,
    },
    sampleSetFingerprint,
    differenceSummary: migrationPreview.differenceSummary,
    differences: migrationPreview.differences,
    applicationGate,
    deletionReadiness,
    normalWorkflowSurface: false,
    migrationRelevantDifferenceTypes: MIGRATION_RELEVANT_DIFFERENCE_TYPES,
    sideEffects: {
      policyActivated: false,
      policyReplaced: false,
      policyDeleted: false,
      learningWritten: false,
      routingWritten: false,
      rollbackCreated: false,
    },
    trace: buildTrace({
      statusId,
      differenceSummary: migrationPreview.differenceSummary,
      boundedDifferences: migrationPreview.differences,
      sampleSetFingerprint,
      acceptanceTransition,
    }),
  };
}

function buildPolicyMigrationVerifierReportFromRuntimeInput(input = {}) {
  const runtimeInput = asObject(input);

  if (Object.hasOwn(runtimeInput, 'proposal')) {
    throw new TypeError(
      'Migration verifier received a rebuild proposal; use buildPolicyMigrationVerifierReportFromRebuildProposal.'
    );
  }

  const { proposalInput, ...verifierInput } = runtimeInput;
  const proposal = buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput(proposalInput || {});

  return buildPolicyMigrationVerifierReportFromRebuildProposal({
    ...verifierInput,
    proposal,
  });
}

function validatePolicyMigrationVerifierReport(report = {}) {
  const issues = [];
  const proposalValidation = validatePolicyLibraryPolicyRebuildProposal(
    asObject(report.proposal)
  );
  const acceptanceTransition = asObject(report.acceptanceTransition);
  const acceptanceTransitionValidation = validatePolicyLibraryRebuildAcceptanceTransition({
    transition: acceptanceTransition,
    proposal: asObject(report.proposal),
    now: acceptanceTransition.evaluatedAt || new Date(),
  });

  if (report.version !== 'policy.migration_verifier.v1') {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_REPORT_VERSION,
      message: 'Migration verifier report must use the durable policy migration verifier version.',
    });
  }

  if (!report.proposalValidation ||
      typeof report.proposalValidation !== 'object' ||
      typeof report.proposalValidation.ok !== 'boolean') {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_PROPOSAL_VALIDATION,
      message: 'Migration verifier report must carry rebuild proposal validation proof.',
    });
  } else if (report.proposalValidation.ok !== proposalValidation.ok ||
      Number(report.proposalValidation.issueCount) !== proposalValidation.issueCount) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.PROPOSAL_VALIDATION_MISMATCH,
      message: 'Migration verifier proposal validation proof must match the embedded proposal.',
    });
  }

  if (report.proposalValidation?.ok !== true || !proposalValidation.ok) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.INVALID_PROPOSAL,
      message: 'Migration verifier report must include a valid rebuild proposal.',
    });
  }

  if (report.migrationPlanValidation?.ok !== true) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.INVALID_MIGRATION_PLAN,
      message: 'Migration verifier report must include a valid migration plan.',
    });
  }

  const migrationPreviewValidation = validatePolicyMigrationPreview(
    asObject(report.migrationPreview)
  );
  if (!migrationPreviewValidation.ok) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.INVALID_MIGRATION_PREVIEW,
      message: 'Migration verifier report must include a valid bounded migration preview.',
      previewRiskIds: migrationPreviewValidation.issues.map(issue => issue.riskId),
    });
  } else if (
    report.statusId !== report.migrationPreview.statusId ||
    Number(report.differenceSummary?.totalCount) !==
      Number(report.migrationPreview.differenceSummary?.totalCount) ||
    Number(report.differenceSummary?.emittedCount) !==
      Number(report.migrationPreview.differenceSummary?.emittedCount) ||
    JSON.stringify(asArray(report.differences)) !==
      JSON.stringify(asArray(report.migrationPreview.differences))
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MIGRATION_PREVIEW_REPORT_MISMATCH,
      message: 'Migration verifier report must preserve the bounded migration preview result.',
    });
  }

  if (acceptanceTransition.version !== POLICY_LIBRARY_REBUILD_ACCEPTANCE_TRANSITION_VERSION) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_ACCEPTANCE_TRANSITION,
      message: 'Migration verifier report must include a rebuild acceptance transition.',
    });
  } else if (!acceptanceTransitionValidation.ok ||
      acceptanceTransition.statusId !==
        POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION ||
      acceptanceTransition.application?.canEnterMigrationVerification !== true) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.INVALID_ACCEPTANCE_TRANSITION,
      message: 'Migration verifier report must include a current accepted transition bound to the proposal and rollback plan.',
    });
  }

  const sampleSetFingerprint = report.sampleSetFingerprint;
  const sampleFingerprintValue = normalizeString(sampleSetFingerprint?.fingerprint);
  const sampleFingerprintProvenance = asObject(sampleSetFingerprint?.provenance);
  const traceSampleFingerprint = normalizeString(
    report.trace?.attributes?.[SAMPLE_SET_FINGERPRINT_TRACE_ATTRIBUTE]
  );
  const traceAcceptanceTransitionFingerprint = normalizeString(
    report.trace?.attributes?.[ACCEPTANCE_TRANSITION_FINGERPRINT_TRACE_ATTRIBUTE]
  );
  const proposalGuardedOutcomeSummary = asObject(report.proposal?.evidenceSourceSummary?.guardedOutcomes);
  const acceptanceTransitionFingerprint = normalizeString(
    acceptanceTransition.transitionFingerprint?.fingerprint
  );

  if (!sampleFingerprintValue) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_SAMPLE_SET_FINGERPRINT,
      message: 'Migration verifier report must carry a sample-set fingerprint.',
    });
  } else if (
    sampleSetFingerprint?.version !== SAMPLE_SET_FINGERPRINT_VERSION ||
    sampleSetFingerprint?.algorithm !== 'sha256' ||
    !SHA256_FINGERPRINT_PATTERN.test(sampleFingerprintValue)
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MALFORMED_SAMPLE_SET_FINGERPRINT,
      message: 'Migration verifier sample-set fingerprint must be a supported SHA-256 digest.',
    });
  }

  if (sampleFingerprintValue && traceSampleFingerprint !== sampleFingerprintValue) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.TRACE_SAMPLE_SET_FINGERPRINT_MISMATCH,
      message: 'Migration verifier trace sample-set fingerprint must match the report.',
    });
  }

  if (acceptanceTransitionFingerprint &&
      traceAcceptanceTransitionFingerprint !== acceptanceTransitionFingerprint) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.ACCEPTANCE_TRANSITION_PROVENANCE_MISMATCH,
      message: 'Migration verifier trace acceptance-transition fingerprint must match the embedded transition.',
    });
  }

  if (sampleSetFingerprint && (
    sampleFingerprintProvenance.proposalVersion !== report.proposal?.version ||
    sampleFingerprintProvenance.proposalStatusId !== report.proposal?.statusId ||
    Number(sampleFingerprintProvenance.proposalGuardedOutcomeFingerprintCount) !==
      Number(proposalGuardedOutcomeSummary.fingerprintCount ?? 0) ||
    Number(sampleFingerprintProvenance.proposalGuardedOutcomeMissingFingerprintCount) !==
      Number(proposalGuardedOutcomeSummary.missingFingerprintCount ?? 0) ||
    Number(sampleFingerprintProvenance.proposalGuardedOutcomeRequestProofCount) !==
      Number(proposalGuardedOutcomeSummary.requestProofCount ?? 0) ||
    Number(sampleFingerprintProvenance.proposalGuardedOutcomeMissingRequestProofCount) !==
      Number(proposalGuardedOutcomeSummary.missingRequestProofCount ?? 0) ||
    Number(sampleFingerprintProvenance.proposalGuardedOutcomeInvalidRequestProofCount) !==
      Number(proposalGuardedOutcomeSummary.invalidRequestProofCount ?? 0) ||
    sampleFingerprintProvenance.acceptanceTransitionVersion !== acceptanceTransition.version ||
    sampleFingerprintProvenance.acceptanceTransitionStatusId !== acceptanceTransition.statusId ||
    sampleFingerprintProvenance.acceptanceTransitionFingerprint !== acceptanceTransitionFingerprint
  )) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.SAMPLE_SET_PROVENANCE_MISMATCH,
      message: 'Migration verifier sample-set provenance must match the embedded rebuild proposal summary.',
    });
  }

  const allowedTypes = new Set(MIGRATION_RELEVANT_DIFFERENCE_TYPES);
  asArray(report.differences).forEach(difference => {
    if (!allowedTypes.has(difference.typeId)) {
      issues.push({
        riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.UNKNOWN_DIFFERENCE_TYPE,
        message: `Migration verifier emitted unknown difference type "${difference.typeId}".`,
      });
    }

    if (difference.migrationRelevant === false) {
      issues.push({
        riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.NON_MIGRATION_RELEVANT_DIFFERENCE,
        message: 'Migration verifier output must include only migration-relevant differences.',
      });
    }

    if (difference.exposesRawPayload === true || difference.rawPayload || difference.prompt || difference.embedding) {
      issues.push({
        riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
        message: 'Migration verifier differences must not expose raw payloads, prompts, or embeddings.',
      });
    }
  });

  if (
    Number(report.differenceSummary?.emittedCount) > Number(report.differenceSummary?.totalCount) ||
    asArray(report.differences).length !== Number(report.differenceSummary?.emittedCount)
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.UNBOUNDED_DIFFERENCE_OUTPUT,
      message: 'Migration verifier emitted difference output must be bounded and counted.',
    });
  }

  if (report.normalWorkflowSurface === true) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.NORMAL_WORKFLOW_SURFACE,
      message: 'Migration verifier output cannot become normal policy-authoring UI.',
    });
  }

  if (report.applicationGate?.requiresOperatorAcceptance !== true ||
      report.applicationGate?.requiresRollbackSnapshot !== true) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_APPLICATION_GATE,
      message: 'Migration verifier must require operator acceptance and rollback before replacement.',
    });
  }

  if (report.applicationGate?.canEnterMigrationVerification !== true ||
      report.applicationGate?.acceptanceTransition?.fingerprint !== acceptanceTransitionFingerprint ||
      report.applicationGate?.acceptanceTransition?.statusId !== acceptanceTransition.statusId) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_VERIFY_WITHOUT_ACCEPTANCE_TRANSITION,
      message: 'Migration verifier may compare samples only through the bound accepted rebuild transition.',
    });
  }

  if (
    report.applicationGate?.canApplyReplacement === true &&
    report.applicationGate?.operatorAccepted !== true
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_APPLY_WITHOUT_OPERATOR_ACCEPTANCE,
      message: 'Migration replacement cannot apply without explicit operator acceptance.',
    });
  }

  if (
    report.applicationGate?.canApplyReplacement === true &&
    report.applicationGate?.rollbackSnapshot?.created !== true
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_APPLY_WITHOUT_ROLLBACK,
      message: 'Migration replacement cannot apply without a rollback snapshot.',
    });
  }

  if (report.applicationGate?.canApplyReplacement === true ||
      report.applicationGate?.requiresPersistedRollbackSnapshot !== true ||
      report.applicationGate?.rollbackSnapshot?.created === true) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_APPLY_WITHOUT_ROLLBACK,
      message: 'Migration verifier is comparison-only; policy replacement requires a later persisted rollback snapshot gate.',
    });
  }

  if (
    report.applicationGate?.rollbackSnapshot?.created === true &&
    !normalizeString(report.applicationGate?.rollbackSnapshot?.restorePath)
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_ROLLBACK_PATH,
      message: 'Rollback snapshot must include a restore path.',
    });
  }

  const nativeIntentStorageStable = asArray(report.deletionReadiness?.criteria)
    .find(criterion =>
      criterion.criterionId === POLICY_MIGRATION_DELETION_CRITERION_IDS.NATIVE_INTENT_STORAGE_STABLE
    )?.met === true;
  const verifierPassed = asArray(report.deletionReadiness?.criteria)
    .find(criterion =>
      criterion.criterionId === POLICY_MIGRATION_DELETION_CRITERION_IDS.VERIFIER_PASSED
    )?.met === true;

  if (
    report.deletionReadiness?.canDeleteLegacyPaths === true &&
    !nativeIntentStorageStable
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_DELETE_BEFORE_NATIVE_INTENT_STABLE,
      message: 'Legacy paths cannot be deleted before native intent storage is stable.',
    });
  }

  if (report.deletionReadiness?.canDeleteLegacyPaths === true && !verifierPassed) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_DELETE_WITHOUT_VERIFIER_PASS,
      message: 'Legacy paths cannot be deleted while migration verifier differences remain.',
    });
  }

  Object.entries(asObject(report.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: `Migration verifier cannot perform side effect "${key}".`,
      });
    }
  });

  if (asArray(report.trace?.reasons).length === 0) {
    issues.push({
      riskId: POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      message: 'Migration verifier must include bounded trace reasons.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyMigrationVerifierAudit(report = null) {
  const hasReport = Boolean(report && typeof report === 'object');
  const validation = hasReport
    ? validatePolicyMigrationVerifierReport(report)
    : {
      ok: true,
      issueCount: 0,
      issues: [],
    };

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: hasReport ? report.statusId || null : null,
    differenceCount: hasReport ? report.differenceSummary?.totalCount ?? 0 : 0,
    validation,
    nextStep: {
      stepId: 'library_rebuild_snapshot_gate',
      label: 'Library Rebuild Snapshot Gate',
      reason: 'A no-difference verifier result must first create one current, transaction-gated rollback snapshot before replacement or metrics can consume the rebuild outcome.',
    },
  };
}

export {
  POLICY_MIGRATION_DELETION_CRITERION_IDS,
  POLICY_MIGRATION_DIFFERENCE_TYPE_IDS,
  POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS,
  POLICY_MIGRATION_VERIFIER_REASON_IDS,
  POLICY_MIGRATION_VERIFIER_STATUS_IDS,
  buildPolicyMigrationVerifierAudit,
  buildPolicyMigrationVerifierReportFromRebuildProposal,
  buildPolicyMigrationVerifierReportFromRuntimeInput,
  validatePolicyMigrationVerifierReport,
};
