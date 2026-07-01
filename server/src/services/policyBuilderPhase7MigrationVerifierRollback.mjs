import {
  PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS,
  buildPolicyBuilderPhase6MigrationPlan,
  validatePolicyBuilderPhase6MigrationPlan,
} from './policyBuilderPhase6MigrationDeletionPath.mjs';
import {
  PHASE7R_REBUILD_PROPOSAL_STATUS_IDS,
  buildPolicyBuilderPhase7LibraryPolicyRebuildProposal,
  validatePolicyBuilderPhase7LibraryPolicyRebuildProposal,
} from './policyBuilderPhase7LibraryPolicyRebuild.mjs';

const PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS = Object.freeze({
  DESTINATION_CHANGE: 'destination_change',
  NEWLY_BLOCKED_ITEM: 'newly_blocked_item',
  NEWLY_REVIEW_REQUIRED_ITEM: 'newly_review_required_item',
  ROUTE_READINESS_CHANGE: 'route_readiness_change',
  EVIDENCE_CONFIDENCE_CHANGE: 'evidence_confidence_change',
});

const PHASE7R_MIGRATION_VERIFIER_STATUS_IDS = Object.freeze({
  NO_MIGRATION_DIFFERENCES: 'no_migration_differences',
  REVIEW_REQUIRED: 'review_required',
  BLOCKED_BY_MIGRATION_RISK: 'blocked_by_migration_risk',
});

const PHASE7R_MIGRATION_VERIFIER_REASON_IDS = Object.freeze({
  PROPOSAL_VALIDATED: 'proposal_validated',
  LEGACY_COMPARISON_CONSUMED: 'legacy_comparison_consumed',
  BOUNDED_DIFFERENCES_EMITTED: 'bounded_differences_emitted',
  MIGRATION_RELEVANT_ONLY: 'migration_relevant_only',
  OPERATOR_ACCEPTANCE_REQUIRED: 'operator_acceptance_required',
  ROLLBACK_SNAPSHOT_REQUIRED: 'rollback_snapshot_required',
  DELETION_CRITERIA_DEFINED: 'deletion_criteria_defined',
  SIDE_EFFECTS_DISABLED: 'side_effects_disabled',
});

const PHASE7R_MIGRATION_DELETION_CRITERION_IDS = Object.freeze({
  PHASE8_NATIVE_INTENT_STABLE: 'phase8_native_intent_stable',
  VERIFIER_PASSED: 'verifier_passed',
  ROLLBACK_SNAPSHOT_CREATED: 'rollback_snapshot_created',
  ROLLBACK_WINDOW_ACTIVE: 'rollback_window_active',
  DELETE_CHECKLIST_APPROVED: 'delete_checklist_approved',
  LEGACY_ARTIFACTS_CLASSIFIED: 'legacy_artifacts_classified',
  CUSTOM_SIGNAL_REPLACEMENT_DEFINED: 'custom_signal_replacement_defined',
});

const PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS = Object.freeze({
  MISSING_REPORT_VERSION: 'missing_report_version',
  INVALID_PROPOSAL: 'invalid_proposal',
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
  CAN_DELETE_BEFORE_PHASE8_STABLE: 'can_delete_before_phase8_stable',
  CAN_DELETE_WITHOUT_VERIFIER_PASS: 'can_delete_without_verifier_pass',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_TRACE_REASON: 'missing_trace_reason',
});

const MAX_DIFFERENCES_DEFAULT = 25;
const CONFIDENCE_DELTA_THRESHOLD_DEFAULT = 0.15;

const MIGRATION_RELEVANT_DIFFERENCE_TYPES = Object.freeze(
  Object.values(PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS)
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
    blocked: proposal.statusId === PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED,
    needsReview: proposal.statusId !== PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.READY_FOR_REVIEW,
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
      typeId: PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.DESTINATION_CHANGE,
      sample,
      summary: 'Generated intent would choose a different destination than legacy behavior.',
      legacyValue: legacyDestination,
      proposedValue: proposedDestination,
    }));
  }

  if (sample.legacy.blocked !== true && sample.proposed.blocked === true) {
    differences.push(buildDifference({
      typeId: PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.NEWLY_BLOCKED_ITEM,
      sample,
      severity: 'blocker',
      summary: 'Generated intent would newly block an item legacy behavior did not block.',
      legacyValue: sample.legacy.statusId || 'not_blocked',
      proposedValue: sample.proposed.statusId || 'blocked',
    }));
  }

  if (sample.legacy.needsReview !== true && sample.proposed.needsReview === true) {
    differences.push(buildDifference({
      typeId: PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.NEWLY_REVIEW_REQUIRED_ITEM,
      sample,
      summary: 'Generated intent would require review for an item legacy behavior allowed.',
      legacyValue: sample.legacy.statusId || 'no_review',
      proposedValue: sample.proposed.statusId || 'review_required',
    }));
  }

  if (sample.legacy.routeReady !== sample.proposed.routeReady) {
    differences.push(buildDifference({
      typeId: PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.ROUTE_READINESS_CHANGE,
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
      typeId: PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.EVIDENCE_CONFIDENCE_CHANGE,
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
    difference.typeId === PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS.NEWLY_BLOCKED_ITEM
  )) {
    return PHASE7R_MIGRATION_VERIFIER_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK;
  }

  if (differences.length > 0) {
    return PHASE7R_MIGRATION_VERIFIER_STATUS_IDS.REVIEW_REQUIRED;
  }

  return PHASE7R_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES;
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
    statusId !== PHASE7R_MIGRATION_VERIFIER_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK;

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
      artifact.decisionId === PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION
    ).length;

  const criteria = [
    {
      criterionId: PHASE7R_MIGRATION_DELETION_CRITERION_IDS.PHASE8_NATIVE_INTENT_STABLE,
      met: criteriaInput.phase8NativeIntentStable === true,
      summary: 'Phase 8R native intent storage has proven stable.',
    },
    {
      criterionId: PHASE7R_MIGRATION_DELETION_CRITERION_IDS.VERIFIER_PASSED,
      met: verifierPassed,
      summary: 'Migration verifier found no behavior-sensitive differences.',
    },
    {
      criterionId: PHASE7R_MIGRATION_DELETION_CRITERION_IDS.ROLLBACK_SNAPSHOT_CREATED,
      met: applicationGate.rollbackSnapshot.created === true,
      summary: 'Rollback snapshot exists for the replacement window.',
    },
    {
      criterionId: PHASE7R_MIGRATION_DELETION_CRITERION_IDS.ROLLBACK_WINDOW_ACTIVE,
      met: criteriaInput.rollbackWindowActive === true,
      summary: 'Rollback retention window is active.',
    },
    {
      criterionId: PHASE7R_MIGRATION_DELETION_CRITERION_IDS.DELETE_CHECKLIST_APPROVED,
      met: criteriaInput.deleteChecklistApproved === true,
      summary: 'Deletion checklist has been approved.',
    },
    {
      criterionId: PHASE7R_MIGRATION_DELETION_CRITERION_IDS.LEGACY_ARTIFACTS_CLASSIFIED,
      met: deleteTargetCount > 0,
      summary: 'Legacy artifacts have explicit migration/deletion classifications.',
    },
    {
      criterionId: PHASE7R_MIGRATION_DELETION_CRITERION_IDS.CUSTOM_SIGNAL_REPLACEMENT_DEFINED,
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

function buildTrace({ statusId, differences, boundedDifferences }) {
  const reasons = [
    PHASE7R_MIGRATION_VERIFIER_REASON_IDS.PROPOSAL_VALIDATED,
    PHASE7R_MIGRATION_VERIFIER_REASON_IDS.LEGACY_COMPARISON_CONSUMED,
    PHASE7R_MIGRATION_VERIFIER_REASON_IDS.BOUNDED_DIFFERENCES_EMITTED,
    PHASE7R_MIGRATION_VERIFIER_REASON_IDS.MIGRATION_RELEVANT_ONLY,
    PHASE7R_MIGRATION_VERIFIER_REASON_IDS.OPERATOR_ACCEPTANCE_REQUIRED,
    PHASE7R_MIGRATION_VERIFIER_REASON_IDS.ROLLBACK_SNAPSHOT_REQUIRED,
    PHASE7R_MIGRATION_VERIFIER_REASON_IDS.DELETION_CRITERIA_DEFINED,
    PHASE7R_MIGRATION_VERIFIER_REASON_IDS.SIDE_EFFECTS_DISABLED,
  ];

  return {
    attributes: {
      'classifarr.policy.migration_verifier.version': 'phase7r.migration_verifier.v1',
      'classifarr.policy.migration_verifier.status': statusId,
      'classifarr.policy.migration_verifier.difference_count': differences.length,
      'classifarr.policy.migration_verifier.emitted_difference_count': boundedDifferences.length,
      'classifarr.policy.migration_verifier.truncated': differences.length > boundedDifferences.length,
    },
    reasons: reasons.map(reasonId => ({
      reasonId,
      severity: 'info',
    })),
  };
}

function buildPolicyBuilderPhase7MigrationVerifierReport(input = {}) {
  const proposal = input.proposal?.version === 'phase7r.library_policy_rebuild.v1'
    ? input.proposal
    : buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(input.proposalInput || {});
  const migrationPlan = input.migrationPlan?.version === 'phase6r.migration_deletion_path.v1'
    ? input.migrationPlan
    : buildPolicyBuilderPhase6MigrationPlan();
  const maxDifferences = Number.isFinite(Number(input.maxDifferences))
    ? Math.max(1, Math.trunc(Number(input.maxDifferences)))
    : MAX_DIFFERENCES_DEFAULT;
  const confidenceDeltaThreshold = Number.isFinite(Number(input.confidenceDeltaThreshold))
    ? Math.max(0, Math.min(1, Number(input.confidenceDeltaThreshold)))
    : CONFIDENCE_DELTA_THRESHOLD_DEFAULT;
  const samples = asArray(input.legacyComparisonSamples)
    .map(sample => normalizeSample(sample, proposal));
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
    version: 'phase7r.migration_verifier.v1',
    statusId,
    proposal,
    proposalValidation: validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal),
    migrationPlanValidation: validatePolicyBuilderPhase6MigrationPlan(migrationPlan),
    sampleSummary: {
      comparedCount: samples.length,
      rawPayloadSuppressed: samples.some(sample => sample.exposesRawPayload),
    },
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
    }),
  };
}

function validatePolicyBuilderPhase7MigrationVerifierReport(report = {}) {
  const issues = [];

  if (report.version !== 'phase7r.migration_verifier.v1') {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_REPORT_VERSION,
      message: 'Migration verifier report must use the Phase 7R.7 version.',
    });
  }

  if (report.proposalValidation?.ok !== true) {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.INVALID_PROPOSAL,
      message: 'Migration verifier report must include a valid rebuild proposal.',
    });
  }

  if (report.migrationPlanValidation?.ok !== true) {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.INVALID_MIGRATION_PLAN,
      message: 'Migration verifier report must include a valid migration plan.',
    });
  }

  const allowedTypes = new Set(MIGRATION_RELEVANT_DIFFERENCE_TYPES);
  asArray(report.differences).forEach(difference => {
    if (!allowedTypes.has(difference.typeId)) {
      issues.push({
        riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.UNKNOWN_DIFFERENCE_TYPE,
        message: `Migration verifier emitted unknown difference type "${difference.typeId}".`,
      });
    }

    if (difference.migrationRelevant === false) {
      issues.push({
        riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.NON_MIGRATION_RELEVANT_DIFFERENCE,
        message: 'Migration verifier output must include only migration-relevant differences.',
      });
    }

    if (difference.exposesRawPayload === true || difference.rawPayload || difference.prompt || difference.embedding) {
      issues.push({
        riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
        message: 'Migration verifier differences must not expose raw payloads, prompts, or embeddings.',
      });
    }
  });

  if (
    Number(report.differenceSummary?.emittedCount) > Number(report.differenceSummary?.totalCount) ||
    asArray(report.differences).length !== Number(report.differenceSummary?.emittedCount)
  ) {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.UNBOUNDED_DIFFERENCE_OUTPUT,
      message: 'Migration verifier emitted difference output must be bounded and counted.',
    });
  }

  if (report.normalWorkflowSurface === true) {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.NORMAL_WORKFLOW_SURFACE,
      message: 'Migration verifier output cannot become normal policy-authoring UI.',
    });
  }

  if (report.applicationGate?.requiresOperatorAcceptance !== true ||
      report.applicationGate?.requiresRollbackSnapshot !== true) {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_APPLICATION_GATE,
      message: 'Migration verifier must require operator acceptance and rollback before replacement.',
    });
  }

  if (
    report.applicationGate?.canApplyReplacement === true &&
    report.applicationGate?.operatorAccepted !== true
  ) {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_APPLY_WITHOUT_OPERATOR_ACCEPTANCE,
      message: 'Migration replacement cannot apply without explicit operator acceptance.',
    });
  }

  if (
    report.applicationGate?.canApplyReplacement === true &&
    report.applicationGate?.rollbackSnapshot?.created !== true
  ) {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_APPLY_WITHOUT_ROLLBACK,
      message: 'Migration replacement cannot apply without a rollback snapshot.',
    });
  }

  if (
    report.applicationGate?.rollbackSnapshot?.created === true &&
    !normalizeString(report.applicationGate?.rollbackSnapshot?.restorePath)
  ) {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_ROLLBACK_PATH,
      message: 'Rollback snapshot must include a restore path.',
    });
  }

  const phase8Stable = asArray(report.deletionReadiness?.criteria)
    .find(criterion =>
      criterion.criterionId === PHASE7R_MIGRATION_DELETION_CRITERION_IDS.PHASE8_NATIVE_INTENT_STABLE
    )?.met === true;
  const verifierPassed = asArray(report.deletionReadiness?.criteria)
    .find(criterion =>
      criterion.criterionId === PHASE7R_MIGRATION_DELETION_CRITERION_IDS.VERIFIER_PASSED
    )?.met === true;

  if (report.deletionReadiness?.canDeleteLegacyPaths === true && !phase8Stable) {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_DELETE_BEFORE_PHASE8_STABLE,
      message: 'Legacy paths cannot be deleted before Phase 8R native intent storage is stable.',
    });
  }

  if (report.deletionReadiness?.canDeleteLegacyPaths === true && !verifierPassed) {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.CAN_DELETE_WITHOUT_VERIFIER_PASS,
      message: 'Legacy paths cannot be deleted while migration verifier differences remain.',
    });
  }

  Object.entries(asObject(report.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: `Migration verifier cannot perform side effect "${key}".`,
      });
    }
  });

  if (asArray(report.trace?.reasons).length === 0) {
    issues.push({
      riskId: PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      message: 'Migration verifier must include bounded trace reasons.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyBuilderPhase7MigrationVerifierAudit(
  report = buildPolicyBuilderPhase7MigrationVerifierReport()
) {
  const validation = validatePolicyBuilderPhase7MigrationVerifierReport(report);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: report.statusId || null,
    differenceCount: report.differenceSummary?.totalCount ?? 0,
    validation,
    nextPhase: {
      phaseId: '7r_8',
      label: 'Runtime Metrics And Decision Trace',
      reason: 'Migration verification and rollback gates now produce bounded decision output, so runtime metrics and decision traces can count automation, review, rollback, and rebuild outcomes safely.',
    },
  };
}

export {
  PHASE7R_MIGRATION_DELETION_CRITERION_IDS,
  PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS,
  PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS,
  PHASE7R_MIGRATION_VERIFIER_REASON_IDS,
  PHASE7R_MIGRATION_VERIFIER_STATUS_IDS,
  buildPolicyBuilderPhase7MigrationVerifierAudit,
  buildPolicyBuilderPhase7MigrationVerifierReport,
  validatePolicyBuilderPhase7MigrationVerifierReport,
};
