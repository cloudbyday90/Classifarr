import { createHash } from 'node:crypto';

import {
  POLICY_MIGRATION_ARTIFACT_DECISION_IDS,
  buildPolicyMigrationDeletionPlan,
  validatePolicyMigrationDeletionPlan,
} from './policyMigrationDeletionPath.mjs';
import {
  POLICY_REBUILD_PROPOSAL_STATUS_IDS,
  buildPolicyLibraryPolicyRebuildProposal,
  validatePolicyLibraryPolicyRebuildProposal,
} from './policyLibraryPolicyRebuild.mjs';

const POLICY_MIGRATION_DIFFERENCE_TYPE_IDS = Object.freeze({
  DESTINATION_CHANGE: 'destination_change',
  NEWLY_BLOCKED_ITEM: 'newly_blocked_item',
  NEWLY_REVIEW_REQUIRED_ITEM: 'newly_review_required_item',
  ROUTE_READINESS_CHANGE: 'route_readiness_change',
  EVIDENCE_CONFIDENCE_CHANGE: 'evidence_confidence_change',
});

const POLICY_MIGRATION_VERIFIER_STATUS_IDS = Object.freeze({
  NO_MIGRATION_DIFFERENCES: 'no_migration_differences',
  REVIEW_REQUIRED: 'review_required',
  BLOCKED_BY_MIGRATION_RISK: 'blocked_by_migration_risk',
});

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
  UNKNOWN_DIFFERENCE_TYPE: 'unknown_difference_type',
  NON_MIGRATION_RELEVANT_DIFFERENCE: 'non_migration_relevant_difference',
  UNBOUNDED_DIFFERENCE_OUTPUT: 'unbounded_difference_output',
  RAW_PAYLOAD_EXPOSED: 'raw_payload_exposed',
  NORMAL_WORKFLOW_SURFACE: 'normal_workflow_surface',
  MISSING_APPLICATION_GATE: 'missing_application_gate',
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

const MAX_DIFFERENCES_DEFAULT = 25;
const CONFIDENCE_DELTA_THRESHOLD_DEFAULT = 0.15;
const SAMPLE_SET_FINGERPRINT_VERSION = 'policy.migration_verifier_sample_set_fingerprint.v1';
const SAMPLE_SET_FINGERPRINT_TRACE_ATTRIBUTE =
  'classifarr.policy.migration_verifier.sample_set_fingerprint';
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

const MIGRATION_RELEVANT_DIFFERENCE_TYPES = Object.freeze(
  Object.values(POLICY_MIGRATION_DIFFERENCE_TYPE_IDS)
);

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

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeConfidence(value) {
  const numeric = normalizeNumber(value);
  if (numeric === null) return null;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
  return Math.max(0, Math.min(1, numeric));
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeOutcome(value = {}) {
  const outcome = asObject(value);

  return {
    destinationLibraryId: outcome.destinationLibraryId ?? outcome.libraryId ?? null,
    destinationLibraryName: normalizeString(outcome.destinationLibraryName ?? outcome.libraryName),
    statusId: normalizeString(outcome.statusId ?? outcome.status),
    routeReady: normalizeBoolean(outcome.routeReady ?? outcome.routingReady),
    blocked: normalizeBoolean(outcome.blocked),
    needsReview: normalizeBoolean(outcome.needsReview ?? outcome.reviewRequired),
    confidenceScore: normalizeConfidence(outcome.confidenceScore ?? outcome.confidence),
    confidenceLevel: normalizeString(outcome.confidenceLevel),
  };
}

function normalizeSample(value = {}, proposal = {}) {
  const sample = asObject(value);
  const proposedDefault = {
    destinationLibraryId: proposal.library?.libraryId ?? null,
    destinationLibraryName: proposal.library?.libraryName ?? '',
    statusId: proposal.statusId,
    routeReady: proposal.readiness?.ready === true,
    blocked: proposal.statusId === POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED,
    needsReview: proposal.statusId !== POLICY_REBUILD_PROPOSAL_STATUS_IDS.READY_FOR_REVIEW,
    confidenceScore: proposal.confidence?.score ?? null,
    confidenceLevel: proposal.confidence?.level ?? '',
  };

  return {
    itemId: sample.itemId ?? sample.id ?? null,
    title: normalizeString(sample.title ?? sample.name),
    year: sample.year ?? null,
    mediaType: normalizeString(sample.mediaType ?? sample.media_type),
    legacy: normalizeOutcome(sample.legacy),
    proposed: normalizeOutcome({
      ...proposedDefault,
      ...asObject(sample.proposed),
    }),
    exposesRawPayload: Boolean(sample.rawPayload || sample.providerPayload || sample.prompt || sample.embedding),
  };
}

function buildSampleSetFingerprint({
  samples,
  proposal,
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
    verifierOptions: {
      maxDifferences,
      confidenceDeltaThreshold,
    },
    samples: asArray(samples).map(sample => ({
      itemId: sample.itemId,
      year: sample.year,
      mediaType: sample.mediaType,
      legacy: sample.legacy,
      proposed: sample.proposed,
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
    },
  };
}

function valuesDiffer(left, right) {
  const leftValue = left ?? null;
  const rightValue = right ?? null;
  return leftValue !== rightValue;
}

function buildDifference({
  typeId,
  sample,
  summary,
  legacyValue,
  proposedValue,
  severity = 'review',
}) {
  return {
    typeId,
    itemId: sample.itemId,
    title: sample.title,
    year: sample.year,
    mediaType: sample.mediaType,
    severity,
    summary,
    legacyValue,
    proposedValue,
    exposesRawPayload: false,
  };
}

function compareSample(sample, confidenceDeltaThreshold) {
  const differences = [];
  const legacyDestination = sample.legacy.destinationLibraryId || sample.legacy.destinationLibraryName;
  const proposedDestination = sample.proposed.destinationLibraryId || sample.proposed.destinationLibraryName;

  if (valuesDiffer(legacyDestination, proposedDestination)) {
    differences.push(buildDifference({
      typeId: POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.DESTINATION_CHANGE,
      sample,
      summary: 'Generated intent would choose a different destination than legacy behavior.',
      legacyValue: legacyDestination,
      proposedValue: proposedDestination,
    }));
  }

  if (sample.legacy.blocked !== true && sample.proposed.blocked === true) {
    differences.push(buildDifference({
      typeId: POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.NEWLY_BLOCKED_ITEM,
      sample,
      severity: 'blocker',
      summary: 'Generated intent would newly block an item legacy behavior did not block.',
      legacyValue: sample.legacy.statusId || 'not_blocked',
      proposedValue: sample.proposed.statusId || 'blocked',
    }));
  }

  if (sample.legacy.needsReview !== true && sample.proposed.needsReview === true) {
    differences.push(buildDifference({
      typeId: POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.NEWLY_REVIEW_REQUIRED_ITEM,
      sample,
      summary: 'Generated intent would require review for an item legacy behavior allowed.',
      legacyValue: sample.legacy.statusId || 'no_review',
      proposedValue: sample.proposed.statusId || 'review_required',
    }));
  }

  if (sample.legacy.routeReady !== sample.proposed.routeReady) {
    differences.push(buildDifference({
      typeId: POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.ROUTE_READINESS_CHANGE,
      sample,
      summary: 'Generated intent changes route readiness compared with legacy behavior.',
      legacyValue: sample.legacy.routeReady,
      proposedValue: sample.proposed.routeReady,
    }));
  }

  const legacyConfidence = sample.legacy.confidenceScore;
  const proposedConfidence = sample.proposed.confidenceScore;
  const confidenceDelta = legacyConfidence !== null && proposedConfidence !== null
    ? Math.abs(legacyConfidence - proposedConfidence)
    : 0;
  if (confidenceDelta >= confidenceDeltaThreshold ||
      valuesDiffer(sample.legacy.confidenceLevel, sample.proposed.confidenceLevel)) {
    differences.push(buildDifference({
      typeId: POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.EVIDENCE_CONFIDENCE_CHANGE,
      sample,
      summary: 'Generated intent changes evidence confidence compared with legacy behavior.',
      legacyValue: sample.legacy.confidenceLevel || legacyConfidence,
      proposedValue: sample.proposed.confidenceLevel || proposedConfidence,
    }));
  }

  return differences;
}

function summarizeDifferences(differences) {
  return Object.fromEntries(
    MIGRATION_RELEVANT_DIFFERENCE_TYPES.map(typeId => [
      typeId,
      differences.filter(difference => difference.typeId === typeId).length,
    ])
  );
}

function determineStatus(differences) {
  if (differences.some(difference =>
    difference.typeId === POLICY_MIGRATION_DIFFERENCE_TYPE_IDS.NEWLY_BLOCKED_ITEM
  )) {
    return POLICY_MIGRATION_VERIFIER_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK;
  }

  if (differences.length > 0) {
    return POLICY_MIGRATION_VERIFIER_STATUS_IDS.REVIEW_REQUIRED;
  }

  return POLICY_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES;
}

function normalizeRollbackSnapshot(input = {}) {
  const snapshot = asObject(input.rollbackSnapshot);

  return {
    required: true,
    created: snapshot.created === true || Boolean(snapshot.snapshotId),
    snapshotId: snapshot.snapshotId ?? null,
    restorePath: normalizeString(snapshot.restorePath),
    retentionWindowDays: Number.isFinite(Number(snapshot.retentionWindowDays))
      ? Math.max(0, Math.trunc(Number(snapshot.retentionWindowDays)))
      : 30,
  };
}

function buildApplicationGate({ input, proposal, statusId }) {
  const rollbackSnapshot = normalizeRollbackSnapshot(input);
  const operatorAccepted = input.operatorAccepted === true ||
    proposal.acceptanceGate?.accepted === true;
  const canApply = operatorAccepted === true &&
    rollbackSnapshot.created === true &&
    normalizeString(rollbackSnapshot.restorePath).length > 0 &&
    statusId !== POLICY_MIGRATION_VERIFIER_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK;

  return {
    requiresOperatorAcceptance: true,
    operatorAccepted,
    requiresRollbackSnapshot: true,
    rollbackSnapshot,
    canApplyReplacement: canApply,
  };
}

function buildDeletionCriteria({ input, differences, migrationPlan, applicationGate }) {
  const criteriaInput = asObject(input.deletionCriteria);
  const verifierPassed = differences.length === 0;
  const deleteTargetCount = asArray(migrationPlan.artifacts)
    .filter(artifact =>
      artifact.decisionId === POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION
    ).length;

  const criteria = [
    {
      criterionId: POLICY_MIGRATION_DELETION_CRITERION_IDS.NATIVE_INTENT_STORAGE_STABLE,
      met: criteriaInput.nativeIntentStorageStable === true ||
        criteriaInput.phase8NativeIntentStable === true,
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

function buildTrace({ statusId, differences, boundedDifferences, sampleSetFingerprint }) {
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
      'classifarr.policy.migration_verifier.difference_count': differences.length,
      'classifarr.policy.migration_verifier.emitted_difference_count': boundedDifferences.length,
      'classifarr.policy.migration_verifier.truncated': differences.length > boundedDifferences.length,
      [SAMPLE_SET_FINGERPRINT_TRACE_ATTRIBUTE]: sampleSetFingerprint.fingerprint,
    },
    reasons: reasons.map(reasonId => ({
      reasonId,
      severity: 'info',
    })),
  };
}

function buildPolicyMigrationVerifierReport(input = {}) {
  const proposal = input.proposal?.version === 'policy.library_policy_rebuild.v1'
    ? input.proposal
    : buildPolicyLibraryPolicyRebuildProposal(input.proposalInput || {});
  const migrationPlan = input.migrationPlan?.version === 'policy.migration_deletion_path.v1'
    ? input.migrationPlan
    : buildPolicyMigrationDeletionPlan();
  const maxDifferences = Number.isFinite(Number(input.maxDifferences))
    ? Math.max(1, Math.trunc(Number(input.maxDifferences)))
    : MAX_DIFFERENCES_DEFAULT;
  const confidenceDeltaThreshold = Number.isFinite(Number(input.confidenceDeltaThreshold))
    ? Math.max(0, Math.min(1, Number(input.confidenceDeltaThreshold)))
    : CONFIDENCE_DELTA_THRESHOLD_DEFAULT;
  const samples = asArray(input.legacyComparisonSamples)
    .map(sample => normalizeSample(sample, proposal));
  const sampleSetFingerprint = buildSampleSetFingerprint({
    samples,
    proposal,
    maxDifferences,
    confidenceDeltaThreshold,
  });
  const differences = samples.flatMap(sample =>
    compareSample(sample, confidenceDeltaThreshold)
  );
  const boundedDifferences = differences.slice(0, maxDifferences);
  const statusId = determineStatus(differences);
  const applicationGate = buildApplicationGate({
    input,
    proposal,
    statusId,
  });
  const deletionReadiness = buildDeletionCriteria({
    input,
    differences,
    migrationPlan,
    applicationGate,
  });

  return {
    version: 'policy.migration_verifier.v1',
    statusId,
    proposal,
    proposalValidation: validatePolicyLibraryPolicyRebuildProposal(proposal),
    migrationPlanValidation: validatePolicyMigrationDeletionPlan(migrationPlan),
    sampleSummary: {
      comparedCount: samples.length,
      rawPayloadSuppressed: samples.some(sample => sample.exposesRawPayload),
    },
    sampleSetFingerprint,
    differenceSummary: {
      totalCount: differences.length,
      emittedCount: boundedDifferences.length,
      truncated: differences.length > boundedDifferences.length,
      byType: summarizeDifferences(differences),
    },
    differences: boundedDifferences,
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
      differences,
      boundedDifferences,
      sampleSetFingerprint,
    }),
  };
}

function validatePolicyMigrationVerifierReport(report = {}) {
  const issues = [];
  const proposalValidation = validatePolicyLibraryPolicyRebuildProposal(
    asObject(report.proposal)
  );

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

  const sampleSetFingerprint = report.sampleSetFingerprint;
  const sampleFingerprintValue = normalizeString(sampleSetFingerprint?.fingerprint);
  const sampleFingerprintProvenance = asObject(sampleSetFingerprint?.provenance);
  const traceSampleFingerprint = normalizeString(
    report.trace?.attributes?.[SAMPLE_SET_FINGERPRINT_TRACE_ATTRIBUTE]
  );
  const proposalGuardedOutcomeSummary = asObject(report.proposal?.evidenceSourceSummary?.guardedOutcomes);

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
      Number(proposalGuardedOutcomeSummary.invalidRequestProofCount ?? 0)
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

function buildPolicyMigrationVerifierAudit(
  report = buildPolicyMigrationVerifierReport()
) {
  const validation = validatePolicyMigrationVerifierReport(report);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: report.statusId || null,
    differenceCount: report.differenceSummary?.totalCount ?? 0,
    validation,
    nextStep: {
      stepId: 'runtime_metrics_trace',
      label: 'Runtime Metrics And Decision Trace',
      reason: 'Migration verification and rollback gates now produce bounded decision output, so runtime metrics and decision traces can count automation, review, rollback, and rebuild outcomes safely.',
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
  buildPolicyMigrationVerifierReport,
  validatePolicyMigrationVerifierReport,
};
