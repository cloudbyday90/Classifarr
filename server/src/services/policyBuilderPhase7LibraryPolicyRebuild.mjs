import {
  PHASE6R_EVIDENCE_BUCKET_IDS,
  buildPolicyBuilderPhase6EvidenceProjection,
} from './policyBuilderPhase6EvidenceEngine.mjs';
import {
  PHASE6R_INTENT_FIELD_IDS,
  PHASE6R_INTENT_WARNING_IDS,
  buildPolicyBuilderPhase6IntentDraft,
  validatePolicyBuilderPhase6IntentDraft,
} from './policyBuilderPhase6IntentEngine.mjs';
import {
  PHASE6R_READINESS_STATE_IDS,
  buildPolicyBuilderPhase6Readiness,
  validatePolicyBuilderPhase6Readiness,
} from './policyBuilderPhase6ReadinessEngine.mjs';
import {
  PHASE6R_LEARNING_DECISION_IDS,
} from './policyBuilderPhase6LearningGuard.mjs';

const PHASE7R_REBUILD_PROPOSAL_STATUS_IDS = Object.freeze({
  READY_FOR_REVIEW: 'ready_for_review',
  NEEDS_MORE_EVIDENCE: 'needs_more_evidence',
  NEEDS_OPERATOR_CONSTRAINT_REVIEW: 'needs_operator_constraint_review',
  NEEDS_ROUTING_CONFIGURATION: 'needs_routing_configuration',
  STALE_PROFILE: 'stale_profile',
  BLOCKED: 'blocked',
});

const PHASE7R_REBUILD_REASON_IDS = Object.freeze({
  LIBRARY_PROFILE_CONSUMED: 'library_profile_consumed',
  GUARDED_OUTCOMES_CONSUMED: 'guarded_outcomes_consumed',
  EXPLICIT_CONSTRAINTS_PRESERVED: 'explicit_constraints_preserved',
  ROUTING_CONFIGURATION_CONSUMED: 'routing_configuration_consumed',
  OUTLIERS_REVIEWED: 'outliers_reviewed',
  PROFILE_FRESHNESS_REVIEWED: 'profile_freshness_reviewed',
  OPERATOR_ACCEPTANCE_REQUIRED: 'operator_acceptance_required',
  ROLLBACK_SNAPSHOT_REQUIRED: 'rollback_snapshot_required',
  OBSERVED_ABSENCE_IS_WARNING_ONLY: 'observed_absence_is_warning_only',
  SIDE_EFFECTS_DISABLED: 'side_effects_disabled',
});

const PHASE7R_REBUILD_WARNING_IDS = Object.freeze({
  OBSERVED_ABSENCE_WARNING_ONLY: 'observed_absence_warning_only',
  EXPLICIT_CONSTRAINT_REVIEW_REQUIRED: 'explicit_constraint_review_required',
  MISSING_IDENTITY_EVIDENCE: 'missing_identity_evidence',
  MISSING_ROUTING_CONFIGURATION: 'missing_routing_configuration',
  STALE_PROFILE: 'stale_profile',
  GUARDED_OUTCOME_WITHOUT_FINGERPRINT: 'guarded_outcome_without_fingerprint',
});

const PHASE7R_REBUILD_AUDIT_RISK_IDS = Object.freeze({
  MISSING_PROPOSAL_VERSION: 'missing_proposal_version',
  MISSING_INTENT_DRAFT: 'missing_intent_draft',
  INVALID_INTENT_DRAFT: 'invalid_intent_draft',
  INVALID_READINESS: 'invalid_readiness',
  DIRECT_ACTIVATION: 'direct_activation',
  DIRECT_POLICY_REPLACEMENT: 'direct_policy_replacement',
  DIRECT_POLICY_DELETE: 'direct_policy_delete',
  DIRECT_LEARNING_WRITE: 'direct_learning_write',
  DIRECT_ROUTING_WRITE: 'direct_routing_write',
  MISSING_OPERATOR_ACCEPTANCE_GATE: 'missing_operator_acceptance_gate',
  MISSING_ROLLBACK_GATE: 'missing_rollback_gate',
  OBSERVED_ABSENCE_PROMOTED_TO_AVOID: 'observed_absence_promoted_to_avoid',
  EXPLICIT_CONSTRAINT_NOT_PRESERVED: 'explicit_constraint_not_preserved',
  MISSING_EVIDENCE_SOURCE_SUMMARY: 'missing_evidence_source_summary',
  MISSING_CONFIDENCE: 'missing_confidence',
  MISSING_TRACE_REASON: 'missing_trace_reason',
  GUARDED_OUTCOME_WITHOUT_FINGERPRINT: 'guarded_outcome_without_fingerprint',
  GUARDED_OUTCOME_FINGERPRINT_MISMATCH: 'guarded_outcome_fingerprint_mismatch',
});

const MAX_TRACE_REASONS = 16;
const MAX_REBUILD_FINGERPRINTS = 20;
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEvidenceFingerprint(value = {}) {
  const fingerprintSource = asObject(value);
  const provenance = asObject(fingerprintSource.provenance);
  const fingerprint = normalizeString(fingerprintSource.fingerprint).toLowerCase();

  if (!fingerprint) return null;

  return {
    algorithm: normalizeString(fingerprintSource.algorithm) || null,
    fingerprint,
    provenance: {
      projectionVersion: normalizeString(provenance.projectionVersion) || null,
      phase6EvidenceVersion: normalizeString(provenance.phase6EvidenceVersion) || null,
      totalEntryCount: Number.isFinite(Number(provenance.totalEntryCount))
        ? Number(provenance.totalEntryCount)
        : 0,
      sourceIds: asArray(provenance.sourceIds).map(String).sort(),
      runtimeSourceIds: asArray(provenance.runtimeSourceIds).map(String).sort(),
      authoritySourceIds: asArray(provenance.authoritySourceIds).map(String).sort(),
      demotionReasonIds: asArray(provenance.demotionReasonIds).map(String).sort(),
      warningReasonIds: asArray(provenance.warningReasonIds).map(String).sort(),
      bucketCounts: asArray(provenance.bucketCounts)
        .map(bucket => ({
          bucketId: normalizeString(bucket?.bucketId) || null,
          entryCount: Number.isFinite(Number(bucket?.entryCount))
            ? Number(bucket.entryCount)
            : 0,
        }))
        .sort((left, right) => String(left.bucketId).localeCompare(String(right.bucketId))),
    },
  };
}

function getGuardedOutcomeEvidenceFingerprint(outcome = {}) {
  return normalizeEvidenceFingerprint(
    outcome.upstreamEvidenceFingerprint ||
    outcome.learningGuardContext?.upstreamEvidenceFingerprint ||
    outcome.questionReductionPlan?.decisionEvidenceFingerprint ||
    outcome.question?.decisionEvidenceFingerprint ||
    outcome.decisionEvidenceFingerprint ||
    outcome.automationDecision?.evidence?.projectionFingerprint ||
    outcome.learningDecision?.upstreamEvidenceFingerprint ||
    outcome.learningDecision?.learningGuardContext?.upstreamEvidenceFingerprint
  );
}

function normalizeSignal(value) {
  if (typeof value === 'string') {
    return {
      key: value,
      label: value,
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const label = normalizeString(value.label ?? value.name ?? value.value ?? value.key ?? value.id);
  if (!label) return null;

  return {
    key: normalizeString(value.key ?? value.id ?? value.name ?? label) || label,
    label,
    value: value.value ?? null,
    count: value.count ?? value.occurrences ?? value.evidenceCount ?? null,
    confidence: value.confidence ?? value.score ?? null,
    reasonCode: value.reasonCode ?? null,
    observedAt: value.observedAt ?? value.updatedAt ?? null,
    stale: value.stale,
  };
}

function normalizeSignals(values) {
  return asArray(values)
    .map(normalizeSignal)
    .filter(Boolean);
}

function normalizeExistingConstraints(input = {}) {
  const existing = asObject(input.existingConstraints || input.explicitConstraints);

  return {
    hardLimits: normalizeSignals(existing.hardLimits || input.hardLimits),
    avoid: normalizeSignals(existing.avoid || input.avoid),
    askWhen: normalizeSignals(existing.askWhen || input.askWhen),
  };
}

function normalizeObservedAbsences(input = {}) {
  return normalizeSignals(input.observedAbsences || input.absentSignals)
    .map(signal => ({
      ...signal,
      reasonCode: signal.reasonCode || PHASE7R_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY,
    }));
}

function mapGuardedOutcomeSignal(outcome = {}, reasonCode) {
  const learning = asObject(outcome.learning ?? outcome.learningDecision?.learning);
  const candidate = asObject(outcome.candidate ?? outcome.learningDecision?.candidate);
  const finalOutcome = asObject(outcome.finalOutcome);
  const label = normalizeString(
    candidate.label ??
    candidate.value ??
    outcome.label ??
    finalOutcome.destinationLibraryName ??
    outcome.destinationLibraryName
  );

  if (!label) return null;

  return {
    key: normalizeString(candidate.key ?? outcome.key ?? label) || label,
    label,
    count: candidate.evidenceCount ?? outcome.evidenceCount ?? 1,
    confidence: outcome.confidence ?? null,
    reasonCode,
    learningDecisionId: learning.decisionId ?? null,
    canWriteLearning: learning.canWriteLearning === true,
  };
}

function collectGuardedOutcomeEvidence(guardedOutcomes = []) {
  const compatibilityCandidates = [];
  const outliers = [];
  const outcomeSummaries = [];

  asArray(guardedOutcomes).forEach((outcome, index) => {
    const learning = asObject(outcome.learning ?? outcome.learningDecision?.learning);
    const finalOutcome = asObject(outcome.finalOutcome);
    const evidenceFingerprint = getGuardedOutcomeEvidenceFingerprint(outcome);
    const hasFingerprint = SHA256_FINGERPRINT_PATTERN.test(evidenceFingerprint?.fingerprint || '') &&
      evidenceFingerprint?.algorithm === 'sha256';
    const summary = {
      outcomeIndex: index,
      accepted: false,
      fingerprint: hasFingerprint ? evidenceFingerprint.fingerprint : null,
      algorithm: hasFingerprint ? evidenceFingerprint.algorithm : null,
      learningDecisionId: learning.decisionId ?? null,
      finalOutcomeRecorded: finalOutcome.recorded === true,
      finalOutcomeStatus: normalizeString(finalOutcome.status) || null,
    };

    if (!hasFingerprint) {
      outcomeSummaries.push({
        ...summary,
        rejectionReasonId: PHASE7R_REBUILD_WARNING_IDS.GUARDED_OUTCOME_WITHOUT_FINGERPRINT,
      });
      return;
    }

    if (learning.decisionId === PHASE6R_LEARNING_DECISION_IDS.BLOCKED ||
        finalOutcome.status === 'route_failed_missing_mapping') {
      const outlier = mapGuardedOutcomeSignal(outcome, 'guarded_outcome_requires_review');
      if (outlier) {
        outliers.push(outlier);
        summary.accepted = true;
      }
      outcomeSummaries.push(summary);
      return;
    }

    if (learning.canWriteLearning === true ||
        learning.decisionId === PHASE6R_LEARNING_DECISION_IDS.CANDIDATE ||
        finalOutcome.recorded === true) {
      const compatibility = mapGuardedOutcomeSignal(outcome, 'guarded_outcome_compatibility');
      if (compatibility) {
        compatibilityCandidates.push(compatibility);
        summary.accepted = true;
      }
    }

    outcomeSummaries.push(summary);
  });

  const acceptedFingerprints = outcomeSummaries
    .filter(outcome => outcome.accepted && outcome.fingerprint)
    .map(outcome => outcome.fingerprint);
  const uniqueFingerprints = Array.from(new Set(acceptedFingerprints)).sort();
  const missingFingerprintCount = outcomeSummaries
    .filter(outcome => outcome.rejectionReasonId === PHASE7R_REBUILD_WARNING_IDS.GUARDED_OUTCOME_WITHOUT_FINGERPRINT)
    .length;

  return {
    compatibilityCandidates,
    outliers,
    summary: {
      count: outcomeSummaries.length,
      acceptedCount: outcomeSummaries.filter(outcome => outcome.accepted).length,
      missingFingerprintCount,
      fingerprintCount: uniqueFingerprints.length,
      fingerprints: uniqueFingerprints.slice(0, MAX_REBUILD_FINGERPRINTS),
      fingerprintListTruncated: uniqueFingerprints.length > MAX_REBUILD_FINGERPRINTS,
      outcomes: outcomeSummaries,
    },
  };
}

function normalizeRoutingConfiguration(input = {}) {
  const routing = asObject(input.routingConfiguration || input.routing);
  const targetName = normalizeString(
    routing.targetName ??
    routing.libraryName ??
    routing.arrRootFolderPath ??
    routing.rootFolderPath
  );

  return {
    configured: routing.configured === true || Boolean(targetName),
    routeReady: routing.routeReady !== false && (routing.configured === true || Boolean(targetName)),
    targetName,
    arrType: normalizeString(routing.arrType ?? routing.arr_type),
    arrConfigId: routing.arrConfigId ?? routing.arr_config_id ?? null,
    arrRootFolderPath: normalizeString(routing.arrRootFolderPath ?? routing.arr_root_folder_path ?? routing.rootFolderPath),
  };
}

function normalizeProfileFreshness(input = {}) {
  const freshness = asObject(input.profileFreshness);

  return {
    stale: freshness.stale === true,
    refreshedAt: normalizeString(freshness.refreshedAt ?? freshness.updatedAt),
    reasonCode: normalizeString(freshness.reasonCode),
  };
}

function buildEvidenceInput(input = {}) {
  const libraryProfile = asObject(input.libraryProfile);
  const existingConstraints = normalizeExistingConstraints(input);
  const guardedOutcomeEvidence = collectGuardedOutcomeEvidence(input.guardedOutcomes);
  const observedAbsences = normalizeObservedAbsences(input);
  const routing = normalizeRoutingConfiguration(input);
  const profileFreshness = normalizeProfileFreshness(input);
  const routingSignals = routing.targetName
    ? [{
      key: routing.arrRootFolderPath || routing.targetName,
      label: routing.targetName,
      value: routing.arrRootFolderPath || routing.targetName,
      reasonCode: PHASE7R_REBUILD_REASON_IDS.ROUTING_CONFIGURATION_CONSUMED,
    }]
    : [];
  const freshnessOutliers = profileFreshness.stale
    ? [{
      key: 'profile_freshness',
      label: 'Profile freshness',
      value: 'stale',
      stale: true,
      reasonCode: PHASE7R_REBUILD_WARNING_IDS.STALE_PROFILE,
    }]
    : [];

  return {
    libraryProfile: {
      identityCandidates: [
        ...normalizeSignals(libraryProfile.identityCandidates),
      ],
      compatibilityCandidates: [
        ...normalizeSignals(libraryProfile.compatibilityCandidates),
        ...guardedOutcomeEvidence.compatibilityCandidates,
      ],
      outliers: [
        ...normalizeSignals(libraryProfile.outliers),
        ...guardedOutcomeEvidence.outliers,
        ...observedAbsences,
        ...freshnessOutliers,
      ],
    },
    operatorIntent: {
      belongsHere: normalizeSignals(input.operatorIntent?.belongsHere),
      helpfulMatches: normalizeSignals(input.operatorIntent?.helpfulMatches),
      hardLimits: existingConstraints.hardLimits,
      avoid: existingConstraints.avoid,
      askWhen: existingConstraints.askWhen,
      routingTargets: routingSignals,
    },
    routing,
    profileFreshness,
    observedAbsences,
    existingConstraints,
    guardedOutcomeCount: asArray(input.guardedOutcomes).length,
    guardedOutcomeEvidenceSummary: guardedOutcomeEvidence.summary,
  };
}

function collectEvidenceSourceSummary({
  evidenceInput,
  evidenceProjection,
}) {
  return {
    libraryProfile: {
      identityCount: asArray(evidenceInput.libraryProfile.identityCandidates).length,
      compatibilityCount: asArray(evidenceInput.libraryProfile.compatibilityCandidates).length,
      outlierCount: asArray(evidenceInput.libraryProfile.outliers).length,
    },
    guardedOutcomes: {
      ...evidenceInput.guardedOutcomeEvidenceSummary,
    },
    explicitConstraints: {
      hardLimitCount: evidenceInput.existingConstraints.hardLimits.length,
      avoidCount: evidenceInput.existingConstraints.avoid.length,
      askWhenCount: evidenceInput.existingConstraints.askWhen.length,
      preserved: true,
    },
    routing: {
      configured: evidenceInput.routing.configured,
      routeReady: evidenceInput.routing.routeReady,
      targetName: evidenceInput.routing.targetName || null,
    },
    profileFreshness: evidenceInput.profileFreshness,
    evidenceBucketCounts: Object.fromEntries(
      Object.values(PHASE6R_EVIDENCE_BUCKET_IDS).map(bucketId => [
        bucketId,
        asArray(evidenceProjection.buckets?.[bucketId]).length,
      ])
    ),
  };
}

function buildWarning(reasonId, message, details = {}) {
  return {
    reasonId,
    severity: details.severity || 'warning',
    message,
    target: details.target || null,
  };
}

function collectWarnings({
  intentDraft,
  evidenceInput,
  readiness,
}) {
  const warnings = [];

  if (asArray(evidenceInput.observedAbsences).length > 0) {
    warnings.push(buildWarning(
      PHASE7R_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY,
      'Observed absence is review context only and was not promoted to an avoid or exclusion rule.',
      { target: PHASE6R_INTENT_FIELD_IDS.ASK_WHEN }
    ));
  }

  if (asArray(intentDraft.belongs_here).length === 0) {
    warnings.push(buildWarning(
      PHASE7R_REBUILD_WARNING_IDS.MISSING_IDENTITY_EVIDENCE,
      'The rebuild proposal needs stronger belongs-here evidence before activation.',
      { target: PHASE6R_INTENT_FIELD_IDS.BELONGS_HERE }
    ));
  }

  if (asArray(intentDraft.hard_limits).length > 0 || asArray(intentDraft.avoid).length > 0) {
    warnings.push(buildWarning(
      PHASE7R_REBUILD_WARNING_IDS.EXPLICIT_CONSTRAINT_REVIEW_REQUIRED,
      'Explicit operator constraints were preserved and should be reviewed before acceptance.',
      { target: PHASE6R_INTENT_FIELD_IDS.HARD_LIMITS }
    ));
  }

  if (readiness.stateId === PHASE6R_READINESS_STATE_IDS.NEEDS_ROUTING) {
    warnings.push(buildWarning(
      PHASE7R_REBUILD_WARNING_IDS.MISSING_ROUTING_CONFIGURATION,
      'Routing must be configured before this proposal can support automatic routing.',
      { target: PHASE6R_INTENT_FIELD_IDS.ROUTING_TARGET }
    ));
  }

  if (readiness.stateId === PHASE6R_READINESS_STATE_IDS.STALE_PROFILE) {
    warnings.push(buildWarning(
      PHASE7R_REBUILD_WARNING_IDS.STALE_PROFILE,
      'Refresh the library profile before accepting this proposal.',
      { target: 'profile_refresh' }
    ));
  }

  if (evidenceInput.guardedOutcomeEvidenceSummary?.missingFingerprintCount > 0) {
    warnings.push(buildWarning(
      PHASE7R_REBUILD_WARNING_IDS.GUARDED_OUTCOME_WITHOUT_FINGERPRINT,
      'One or more guarded outcomes were ignored because they do not carry an upstream evidence fingerprint.',
      { target: 'guarded_outcomes', severity: 'error' }
    ));
  }

  asArray(intentDraft.warnings).forEach(warning => {
    if (warning.reasonCode === PHASE6R_INTENT_WARNING_IDS.OBSERVED_ABSENCE_NOT_EXCLUSION) {
      warnings.push(buildWarning(
        PHASE7R_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY,
        warning.summary || 'Observed absence stayed a warning rather than an exclusion.',
        { target: PHASE6R_INTENT_FIELD_IDS.ASK_WHEN }
      ));
    }
  });

  return warnings;
}

function determineStatus({ intentDraft, readiness, warnings }) {
  if (readiness.stateId === PHASE6R_READINESS_STATE_IDS.STALE_PROFILE) {
    return PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.STALE_PROFILE;
  }

  if (readiness.stateId === PHASE6R_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT) {
    return PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED;
  }

  if (readiness.stateId === PHASE6R_READINESS_STATE_IDS.NEEDS_ROUTING) {
    return PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_ROUTING_CONFIGURATION;
  }

  if (asArray(intentDraft.belongs_here).length === 0) {
    return PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_MORE_EVIDENCE;
  }

  if (warnings.some(warning =>
    warning.reasonId === PHASE7R_REBUILD_WARNING_IDS.EXPLICIT_CONSTRAINT_REVIEW_REQUIRED
  )) {
    return PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_OPERATOR_CONSTRAINT_REVIEW;
  }

  return PHASE7R_REBUILD_PROPOSAL_STATUS_IDS.READY_FOR_REVIEW;
}

function buildTrace({ statusId, evidenceSourceSummary, warnings }) {
  const reasons = [
    PHASE7R_REBUILD_REASON_IDS.LIBRARY_PROFILE_CONSUMED,
    PHASE7R_REBUILD_REASON_IDS.GUARDED_OUTCOMES_CONSUMED,
    PHASE7R_REBUILD_REASON_IDS.EXPLICIT_CONSTRAINTS_PRESERVED,
    PHASE7R_REBUILD_REASON_IDS.ROUTING_CONFIGURATION_CONSUMED,
    PHASE7R_REBUILD_REASON_IDS.OUTLIERS_REVIEWED,
    PHASE7R_REBUILD_REASON_IDS.PROFILE_FRESHNESS_REVIEWED,
    PHASE7R_REBUILD_REASON_IDS.OPERATOR_ACCEPTANCE_REQUIRED,
    PHASE7R_REBUILD_REASON_IDS.ROLLBACK_SNAPSHOT_REQUIRED,
    PHASE7R_REBUILD_REASON_IDS.SIDE_EFFECTS_DISABLED,
  ];

  if (warnings.some(warning =>
    warning.reasonId === PHASE7R_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY
  )) {
    reasons.push(PHASE7R_REBUILD_REASON_IDS.OBSERVED_ABSENCE_IS_WARNING_ONLY);
  }

  const boundedReasons = reasons.slice(0, MAX_TRACE_REASONS).map(reasonId => ({
    reasonId,
    severity: 'info',
  }));

  return {
    attributes: {
      'classifarr.policy.rebuild.version': 'phase7r.library_policy_rebuild.v1',
      'classifarr.policy.rebuild.status': statusId,
      'classifarr.policy.rebuild.identity_count': evidenceSourceSummary.libraryProfile.identityCount,
      'classifarr.policy.rebuild.guarded_outcome_count': evidenceSourceSummary.guardedOutcomes.count,
      'classifarr.policy.rebuild.guarded_outcome_fingerprint_count':
        evidenceSourceSummary.guardedOutcomes.fingerprintCount,
      'classifarr.policy.rebuild.guarded_outcome_missing_fingerprint_count':
        evidenceSourceSummary.guardedOutcomes.missingFingerprintCount,
      'classifarr.policy.rebuild.routing_configured': evidenceSourceSummary.routing.configured,
      'classifarr.policy.rebuild.warning_count': warnings.length,
    },
    reasons: boundedReasons,
    truncated: reasons.length > boundedReasons.length,
  };
}

function buildPolicyBuilderPhase7LibraryPolicyRebuildProposal(input = {}) {
  const evidenceInput = buildEvidenceInput(input);
  const evidenceProjection = buildPolicyBuilderPhase6EvidenceProjection(evidenceInput);
  const intentDraft = buildPolicyBuilderPhase6IntentDraft(evidenceProjection);
  const readiness = buildPolicyBuilderPhase6Readiness({
    evidenceProjection,
    intentDraft,
    routing: evidenceInput.routing,
    profileFreshness: evidenceInput.profileFreshness,
    learningDecision: input.learningDecision || {},
  });
  const evidenceSourceSummary = collectEvidenceSourceSummary({
    evidenceInput,
    evidenceProjection,
  });
  const warnings = collectWarnings({
    intentDraft,
    evidenceInput,
    readiness,
  });
  const statusId = determineStatus({
    intentDraft,
    readiness,
    warnings,
  });

  return {
    version: 'phase7r.library_policy_rebuild.v1',
    statusId,
    library: {
      libraryId: input.library?.libraryId ?? input.libraryId ?? null,
      libraryName: normalizeString(input.library?.libraryName ?? input.library?.name ?? input.libraryName),
      mediaType: normalizeString(input.library?.mediaType ?? input.mediaType),
    },
    evidenceProjection,
    intentDraft,
    readiness,
    evidenceSourceSummary,
    confidence: intentDraft.confidence,
    assumptions: [
      ...asArray(intentDraft.assumptions),
      {
        reasonCode: PHASE7R_REBUILD_REASON_IDS.OPERATOR_ACCEPTANCE_REQUIRED,
        summary: 'The rebuild proposal cannot activate until an operator accepts it.',
      },
      {
        reasonCode: PHASE7R_REBUILD_REASON_IDS.ROLLBACK_SNAPSHOT_REQUIRED,
        summary: 'A rollback snapshot is required before any accepted replacement can apply.',
      },
    ],
    warnings,
    acceptanceGate: {
      requiresExplicitOperatorAcceptance: true,
      accepted: false,
      acceptedBy: null,
      acceptedAt: null,
    },
    rollbackGate: {
      requiresRollbackSnapshot: true,
      snapshotCreated: false,
      snapshotId: null,
    },
    sideEffects: {
      policyActivated: false,
      policyReplaced: false,
      policyDeleted: false,
      learningWritten: false,
      routingWritten: false,
    },
    trace: buildTrace({
      statusId,
      evidenceSourceSummary,
      warnings,
    }),
  };
}

function validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal = {}) {
  const issues = [];

  if (proposal.version !== 'phase7r.library_policy_rebuild.v1') {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.MISSING_PROPOSAL_VERSION,
      message: 'Library policy rebuild proposal must use the Phase 7R.6 version.',
    });
  }

  if (proposal.intentDraft?.version !== 'phase6r.intent.v1') {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.MISSING_INTENT_DRAFT,
      message: 'Library policy rebuild proposal must include a Phase 6R intent draft.',
    });
  } else {
    const intentValidation = validatePolicyBuilderPhase6IntentDraft(proposal.intentDraft);
    if (!intentValidation.ok) {
      issues.push({
        riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.INVALID_INTENT_DRAFT,
        message: 'Library policy rebuild proposal must include a valid Phase 6R intent draft.',
        details: intentValidation.issues,
      });
    }
  }

  const readinessValidation = validatePolicyBuilderPhase6Readiness(proposal.readiness);
  if (!readinessValidation.ok) {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.INVALID_READINESS,
      message: 'Library policy rebuild proposal must include valid Phase 6R readiness.',
      details: readinessValidation.issues,
    });
  }

  if (proposal.acceptanceGate?.requiresExplicitOperatorAcceptance !== true) {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.MISSING_OPERATOR_ACCEPTANCE_GATE,
      message: 'Library policy rebuild proposal must require explicit operator acceptance.',
    });
  }

  if (proposal.rollbackGate?.requiresRollbackSnapshot !== true) {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.MISSING_ROLLBACK_GATE,
      message: 'Library policy rebuild proposal must require a rollback snapshot before replacement.',
    });
  }

  Object.entries(asObject(proposal.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      const riskId = {
        policyActivated: PHASE7R_REBUILD_AUDIT_RISK_IDS.DIRECT_ACTIVATION,
        policyReplaced: PHASE7R_REBUILD_AUDIT_RISK_IDS.DIRECT_POLICY_REPLACEMENT,
        policyDeleted: PHASE7R_REBUILD_AUDIT_RISK_IDS.DIRECT_POLICY_DELETE,
        learningWritten: PHASE7R_REBUILD_AUDIT_RISK_IDS.DIRECT_LEARNING_WRITE,
        routingWritten: PHASE7R_REBUILD_AUDIT_RISK_IDS.DIRECT_ROUTING_WRITE,
      }[key] || PHASE7R_REBUILD_AUDIT_RISK_IDS.DIRECT_POLICY_REPLACEMENT;

      issues.push({
        riskId,
        message: `Library policy rebuild proposal cannot perform side effect "${key}".`,
      });
    }
  });

  const observedAbsenceWarnings = asArray(proposal.warnings)
    .filter(warning => warning.reasonId === PHASE7R_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY);
  const observedAbsenceAvoid = asArray(proposal.intentDraft?.avoid)
    .some(entry => entry.reasonCode === PHASE7R_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY ||
      entry.reasonCode === 'observed_absence');
  if (observedAbsenceAvoid || (
    observedAbsenceWarnings.length > 0 &&
    asArray(proposal.intentDraft?.avoid).some(entry => entry.inferred === true)
  )) {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.OBSERVED_ABSENCE_PROMOTED_TO_AVOID,
      message: 'Observed absence must remain a warning and cannot become an avoid/exclusion rule.',
    });
  }

  const constraintSummary = proposal.evidenceSourceSummary?.explicitConstraints;
  if (constraintSummary && constraintSummary.preserved !== true) {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.EXPLICIT_CONSTRAINT_NOT_PRESERVED,
      message: 'Explicit operator constraints must be preserved unless the operator changes them.',
    });
  }

  if (!proposal.evidenceSourceSummary?.libraryProfile) {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.MISSING_EVIDENCE_SOURCE_SUMMARY,
      message: 'Library policy rebuild proposal must explain evidence sources.',
    });
  }

  const guardedOutcomeSummary = proposal.evidenceSourceSummary?.guardedOutcomes;
  const guardedTraceFingerprintCount = Number(
    proposal.trace?.attributes?.['classifarr.policy.rebuild.guarded_outcome_fingerprint_count']
  );
  const guardedTraceMissingFingerprintCount = Number(
    proposal.trace?.attributes?.['classifarr.policy.rebuild.guarded_outcome_missing_fingerprint_count']
  );

  if (guardedOutcomeSummary?.missingFingerprintCount > 0) {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_WITHOUT_FINGERPRINT,
      message: 'Guarded outcomes must carry upstream sanitized evidence fingerprints before rebuild can consume them.',
    });
  }

  if (guardedOutcomeSummary && (
    guardedTraceFingerprintCount !== guardedOutcomeSummary.fingerprintCount ||
    guardedTraceMissingFingerprintCount !== guardedOutcomeSummary.missingFingerprintCount
  )) {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_FINGERPRINT_MISMATCH,
      message: 'Guarded outcome fingerprint trace counts must match the rebuild source summary.',
    });
  }

  if (!proposal.confidence?.level || !Array.isArray(proposal.confidence?.reasonCodes)) {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.MISSING_CONFIDENCE,
      message: 'Library policy rebuild proposal must include confidence and reason codes.',
    });
  }

  if (asArray(proposal.trace?.reasons).length === 0) {
    issues.push({
      riskId: PHASE7R_REBUILD_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      message: 'Library policy rebuild proposal must include bounded trace reasons.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyBuilderPhase7LibraryPolicyRebuildAudit(
  proposal = buildPolicyBuilderPhase7LibraryPolicyRebuildProposal()
) {
  const validation = validatePolicyBuilderPhase7LibraryPolicyRebuildProposal(proposal);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: proposal.statusId || null,
    validation,
    nextPhase: {
      phaseId: '7r_7',
      label: 'Migration Verifier And Rollback Path',
      reason: 'Library-derived proposals are now side-effect-free and acceptance-gated, so the next boundary is comparing proposal behavior with legacy behavior and enforcing rollback before replacement.',
    },
  };
}

export {
  PHASE7R_REBUILD_AUDIT_RISK_IDS,
  PHASE7R_REBUILD_PROPOSAL_STATUS_IDS,
  PHASE7R_REBUILD_REASON_IDS,
  PHASE7R_REBUILD_WARNING_IDS,
  buildPolicyBuilderPhase7LibraryPolicyRebuildAudit,
  buildPolicyBuilderPhase7LibraryPolicyRebuildProposal,
  validatePolicyBuilderPhase7LibraryPolicyRebuildProposal,
};
