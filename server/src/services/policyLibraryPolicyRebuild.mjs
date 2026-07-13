import {
  POLICY_EVIDENCE_BUCKET_IDS,
} from './policyEvidenceEngine.mjs';
import {
  buildBoundedPolicyEvidenceProjection,
} from './policyEvidenceBoundary.mjs';
import {
  POLICY_INTENT_FIELD_IDS,
  POLICY_INTENT_WARNING_IDS,
  buildPolicyIntentDraftFromBoundedEvidence,
  validatePolicyIntentDraft,
} from './policyIntentEngine.mjs';
import {
  POLICY_AUTOMATION_READINESS_STATE_IDS,
  buildPolicyAutomationReadinessFromBoundedContracts,
  validatePolicyAutomationReadiness,
} from './policyAutomationReadinessEngine.mjs';
import {
  POLICY_GUARDED_OUTCOME_PROJECTION_VERSION,
  validatePolicyGuardedOutcomeProjection,
} from './policyGuardedOutcomeProjection.mjs';
import {
  POLICY_LEARNING_DECISION_IDS,
} from './policyLearningGuard.mjs';
import {
  buildPolicyLibraryRebuildReadinessHandoff,
} from './policyLibraryRebuildReadinessHandoff.mjs';
import {
  POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_VERSION,
} from './policyLibraryProfileEvidenceLoader.mjs';
import {
  POLICY_LIBRARY_REBUILD_INPUT_CONTRACT_VERSION,
  buildPolicyLibraryRebuildInputFromGuardedOutcomeProjection,
  buildPolicyLibraryRebuildInputFromRuntimeInput,
  buildPolicyLibraryRebuildInputSummary,
  validatePolicyLibraryRebuildInputContract,
} from './policyLibraryRebuildInputContract.mjs';

const POLICY_REBUILD_PROPOSAL_STATUS_IDS = Object.freeze({
  READY_FOR_REVIEW: 'ready_for_review',
  NEEDS_MORE_EVIDENCE: 'needs_more_evidence',
  NEEDS_OPERATOR_CONSTRAINT_REVIEW: 'needs_operator_constraint_review',
  NEEDS_ROUTING_CONFIGURATION: 'needs_routing_configuration',
  STALE_PROFILE: 'stale_profile',
  BLOCKED_BY_EVIDENCE_BOUNDARY: 'blocked_by_evidence_boundary',
  BLOCKED_BY_INTENT_BOUNDARY: 'blocked_by_intent_boundary',
  BLOCKED_BY_READINESS_BOUNDARY: 'blocked_by_readiness_boundary',
  BLOCKED: 'blocked',
});

const POLICY_REBUILD_REASON_IDS = Object.freeze({
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
  EVIDENCE_BOUNDARY_BLOCKED: 'evidence_boundary_blocked',
  INTENT_BOUNDARY_BLOCKED: 'intent_boundary_blocked',
  READINESS_BOUNDARY_BLOCKED: 'readiness_boundary_blocked',
});

const POLICY_REBUILD_WARNING_IDS = Object.freeze({
  OBSERVED_ABSENCE_WARNING_ONLY: 'observed_absence_warning_only',
  EXPLICIT_CONSTRAINT_REVIEW_REQUIRED: 'explicit_constraint_review_required',
  MISSING_IDENTITY_EVIDENCE: 'missing_identity_evidence',
  MISSING_ROUTING_CONFIGURATION: 'missing_routing_configuration',
  STALE_PROFILE: 'stale_profile',
  GUARDED_OUTCOME_WITHOUT_FINGERPRINT: 'guarded_outcome_without_fingerprint',
  GUARDED_OUTCOME_WITHOUT_REQUEST_PROOF: 'guarded_outcome_without_request_proof',
  GUARDED_OUTCOME_INVALID_REQUEST_PROOF: 'guarded_outcome_invalid_request_proof',
  EVIDENCE_BOUNDARY_BLOCKED: 'evidence_boundary_blocked',
  INTENT_BOUNDARY_BLOCKED: 'intent_boundary_blocked',
  READINESS_BOUNDARY_BLOCKED: 'readiness_boundary_blocked',
});

const POLICY_REBUILD_AUDIT_RISK_IDS = Object.freeze({
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
  GUARDED_OUTCOME_WITHOUT_REQUEST_PROOF: 'guarded_outcome_without_request_proof',
  GUARDED_OUTCOME_INVALID_REQUEST_PROOF: 'guarded_outcome_invalid_request_proof',
  GUARDED_OUTCOME_REQUEST_PROOF_MISMATCH: 'guarded_outcome_request_proof_mismatch',
  MISSING_EVIDENCE_BOUNDARY: 'missing_evidence_boundary',
  INVALID_EVIDENCE_BOUNDARY: 'invalid_evidence_boundary',
  BLOCKED_EVIDENCE_BOUNDARY_NOT_FAILED: 'blocked_evidence_boundary_not_failed',
  BLOCKED_EVIDENCE_BOUNDARY_WITH_DERIVED_CONTRACT: 'blocked_evidence_boundary_with_derived_contract',
  MISSING_INTENT_BOUNDARY: 'missing_intent_boundary',
  INVALID_INTENT_BOUNDARY: 'invalid_intent_boundary',
  INTENT_BOUNDARY_PROVENANCE_MISMATCH: 'intent_boundary_provenance_mismatch',
  BLOCKED_INTENT_BOUNDARY_NOT_FAILED: 'blocked_intent_boundary_not_failed',
  BLOCKED_INTENT_BOUNDARY_WITH_DERIVED_CONTRACT: 'blocked_intent_boundary_with_derived_contract',
  MISSING_READINESS_BOUNDARY: 'missing_readiness_boundary',
  INVALID_READINESS_BOUNDARY: 'invalid_readiness_boundary',
  READINESS_BOUNDARY_PROVENANCE_MISMATCH: 'readiness_boundary_provenance_mismatch',
  BLOCKED_READINESS_BOUNDARY_NOT_FAILED: 'blocked_readiness_boundary_not_failed',
  BLOCKED_READINESS_BOUNDARY_WITH_DERIVED_CONTRACT: 'blocked_readiness_boundary_with_derived_contract',
  MISSING_GUARDED_OUTCOME_PROJECTION: 'missing_guarded_outcome_projection',
  INVALID_GUARDED_OUTCOME_PROJECTION: 'invalid_guarded_outcome_projection',
  MISSING_INPUT_CONTRACT: 'missing_input_contract',
  INVALID_INPUT_CONTRACT: 'invalid_input_contract',
  INPUT_CONTRACT_LIBRARY_MISMATCH: 'input_contract_library_mismatch',
});

const MAX_TRACE_REASONS = 16;
const MAX_REBUILD_FINGERPRINTS = 20;
const MAX_EVIDENCE_BOUNDARY_RISK_IDS = 16;
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
      evidenceVersion: normalizeString(provenance.evidenceVersion) || null,
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
      reasonCode: signal.reasonCode || POLICY_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY,
    }));
}

function mapGuardedOutcomeSignal(outcome = {}, reasonCode) {
  const learning = asObject(outcome.learning);
  const candidate = asObject(learning.candidate);
  const finalOutcome = asObject(outcome.finalOutcome);
  const label = normalizeString(
    candidate.label ??
    finalOutcome.destinationLibraryName
  );

  if (!label) return null;

  return {
    key: normalizeString(candidate.key ?? label) || label,
    label,
    count: candidate.evidenceCount ?? 1,
    confidence: null,
    reasonCode,
    learningDecisionId: normalizeString(learning.decisionId) || null,
    canWriteLearning: learning.canWriteLearning === true,
  };
}

function collectGuardedOutcomeEvidence(guardedOutcomeProjection = {}) {
  const compatibilityCandidates = [];
  const outliers = [];
  const outcomeSummaries = [];
  const projection = asObject(guardedOutcomeProjection);
  const projectionSummary = asObject(projection.summary);

  asArray(projection.outcomes).forEach((outcome, index) => {
    const learning = asObject(outcome.learning);
    const finalOutcome = asObject(outcome.finalOutcome);
    const evidenceFingerprint = normalizeEvidenceFingerprint(outcome.evidenceFingerprint);
    const hasFingerprint = SHA256_FINGERPRINT_PATTERN.test(evidenceFingerprint?.fingerprint || '') &&
      evidenceFingerprint?.algorithm === 'sha256';
    const requestProofFingerprint = normalizeString(outcome.requestProofFingerprint).toLowerCase();
    const summary = {
      outcomeIndex: index,
      accepted: false,
      fingerprint: hasFingerprint ? evidenceFingerprint.fingerprint : null,
      algorithm: hasFingerprint ? evidenceFingerprint.algorithm : null,
      requestProofValid: requestProofFingerprint === evidenceFingerprint?.fingerprint,
      requestProofIssueCount: requestProofFingerprint === evidenceFingerprint?.fingerprint ? 0 : 1,
      requestProofFingerprint,
      learningDecisionId: learning.decisionId ?? null,
      finalOutcomeRecorded: finalOutcome.recorded === true,
      finalOutcomeStatus: normalizeString(finalOutcome.status) || null,
    };

    if (!hasFingerprint) {
      outcomeSummaries.push({
        ...summary,
        rejectionReasonId: POLICY_REBUILD_WARNING_IDS.GUARDED_OUTCOME_WITHOUT_FINGERPRINT,
      });
      return;
    }

    if (requestProofFingerprint !== evidenceFingerprint.fingerprint) {
      outcomeSummaries.push({
        ...summary,
        rejectionReasonId: POLICY_REBUILD_WARNING_IDS.GUARDED_OUTCOME_INVALID_REQUEST_PROOF,
      });
      return;
    }

    if (learning.decisionId === 'blocked' ||
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
        learning.decisionId === POLICY_LEARNING_DECISION_IDS.CANDIDATE ||
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
  return {
    compatibilityCandidates,
    outliers,
    summary: {
      count: projectionSummary.decisionCount ?? outcomeSummaries.length,
      acceptedCount: outcomeSummaries.filter(outcome => outcome.accepted).length,
      rejectedCount: projectionSummary.rejectedCount ?? 0,
      missingFingerprintCount: projectionSummary.missingFingerprintCount ?? 0,
      requestProofCount: projectionSummary.requestProofCount ?? 0,
      missingRequestProofCount: projectionSummary.missingRequestProofCount ?? 0,
      invalidRequestProofCount: projectionSummary.invalidRequestProofCount ?? 0,
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

function buildEvidenceInput(input = {}, guardedOutcomeProjection = {}) {
  const libraryProfile = asObject(input.libraryProfile);
  const existingConstraints = normalizeExistingConstraints(input);
  const guardedOutcomeEvidence = collectGuardedOutcomeEvidence(guardedOutcomeProjection);
  const observedAbsences = normalizeObservedAbsences(input);
  const routing = normalizeRoutingConfiguration(input);
  const profileFreshness = normalizeProfileFreshness(input);
  const routingSignals = routing.targetName
    ? [{
      key: routing.arrRootFolderPath || routing.targetName,
      label: routing.targetName,
      value: routing.arrRootFolderPath || routing.targetName,
      reasonCode: POLICY_REBUILD_REASON_IDS.ROUTING_CONFIGURATION_CONSUMED,
    }]
    : [];
  const freshnessOutliers = profileFreshness.stale
    ? [{
      key: 'profile_freshness',
      label: 'Profile freshness',
      value: 'stale',
      stale: true,
      reasonCode: POLICY_REBUILD_WARNING_IDS.STALE_PROFILE,
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
    guardedOutcomeCount: guardedOutcomeEvidence.summary.count,
    guardedOutcomeEvidenceSummary: guardedOutcomeEvidence.summary,
  };
}

function buildRebuildEvidenceEnvelope(evidenceInput = {}) {
  return {
    libraryProfile: evidenceInput.libraryProfile,
    operatorIntent: evidenceInput.operatorIntent,
    profileFreshness: evidenceInput.profileFreshness,
  };
}

function buildEvidenceBoundaryContext(boundaryResult = {}) {
  const boundary = asObject(boundaryResult);
  const fingerprint = asObject(boundary.projectionFingerprint);
  const riskIds = Array.from(new Set(
    asArray(boundary.issues)
      .map(issue => normalizeString(issue?.riskId))
      .filter(Boolean)
  )).slice(0, MAX_EVIDENCE_BOUNDARY_RISK_IDS);

  return {
    version: normalizeString(boundary.version) || null,
    statusId: normalizeString(boundary.statusId) || null,
    ok: boundary.ok === true,
    issueCount: Number.isFinite(Number(boundary.issueCount))
      ? Number(boundary.issueCount)
      : 0,
    riskIds,
    projectionFingerprint: boundary.ok === true
      ? {
          algorithm: normalizeString(fingerprint.algorithm) || null,
          fingerprint: normalizeString(fingerprint.fingerprint).toLowerCase() || null,
        }
      : null,
  };
}

function buildIntentBoundaryContext(intentResult = {}) {
  const boundary = asObject(intentResult);
  const evidenceBoundary = asObject(boundary.evidenceBoundary);
  const fingerprint = asObject(evidenceBoundary.projectionFingerprint);
  const riskIds = Array.from(new Set(
    asArray(boundary.issues)
      .map(issue => normalizeString(issue?.riskId))
      .filter(Boolean)
  )).slice(0, MAX_EVIDENCE_BOUNDARY_RISK_IDS);

  return {
    statusId: normalizeString(boundary.statusId) || null,
    ok: boundary.ok === true,
    issueCount: Number.isFinite(Number(boundary.issueCount))
      ? Number(boundary.issueCount)
      : 0,
    riskIds,
    intentVersion: normalizeString(boundary.intent?.version) || null,
    intentAuditOk: boundary.intentAudit?.ok === true,
    evidenceFingerprintAuditOk: boundary.evidenceFingerprintAudit?.ok === true,
    projectionFingerprint: {
      algorithm: normalizeString(fingerprint.algorithm) || null,
      fingerprint: normalizeString(fingerprint.fingerprint).toLowerCase() || null,
    },
  };
}

function buildReadinessBoundaryMember(boundary = {}) {
  const source = asObject(boundary);
  const fingerprint = asObject(source.projectionFingerprint);

  return {
    statusId: normalizeString(source.statusId) || null,
    projectionFingerprint: {
      algorithm: normalizeString(fingerprint.algorithm) || null,
      fingerprint: normalizeString(fingerprint.fingerprint).toLowerCase() || null,
    },
  };
}

function buildReadinessBoundaryContext(readinessResult = {}) {
  const source = asObject(readinessResult);
  const boundaryContext = asObject(source.boundaryContext);
  const riskIds = Array.from(new Set(
    asArray(source.issues)
      .map(issue => normalizeString(issue?.riskId))
      .filter(Boolean)
  )).slice(0, MAX_EVIDENCE_BOUNDARY_RISK_IDS);

  return {
    statusId: normalizeString(source.statusId) || null,
    ok: source.ok === true,
    issueCount: Number.isFinite(Number(source.issueCount))
      ? Number(source.issueCount)
      : 0,
    riskIds,
    projectionFingerprintMatch: boundaryContext.projectionFingerprintMatch === true,
    evidenceBoundary: buildReadinessBoundaryMember(boundaryContext.evidenceBoundary),
    intentBoundary: buildReadinessBoundaryMember(boundaryContext.intentBoundary),
    learningBoundary: buildReadinessBoundaryMember(boundaryContext.learningBoundary),
    readinessAuditOk: source.readinessAudit?.ok === true,
  };
}

function getBoundaryBlockMetadata({
  statusId,
  intentBoundary = null,
  readinessBoundary = null,
} = {}) {
  if (statusId === POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY) {
    return {
      reasonId: POLICY_REBUILD_REASON_IDS.EVIDENCE_BOUNDARY_BLOCKED,
      warningId: POLICY_REBUILD_WARNING_IDS.EVIDENCE_BOUNDARY_BLOCKED,
      summary: 'The rebuild proposal stopped because its evidence input did not pass validation.',
      target: 'evidence_boundary',
    };
  }

  if (readinessBoundary) {
    return {
      reasonId: POLICY_REBUILD_REASON_IDS.READINESS_BOUNDARY_BLOCKED,
      warningId: POLICY_REBUILD_WARNING_IDS.READINESS_BOUNDARY_BLOCKED,
      summary: 'The rebuild proposal stopped because its verified readiness handoff did not pass validation.',
      target: 'readiness_boundary',
    };
  }

  if (statusId === POLICY_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_MORE_EVIDENCE) {
    return {
      reasonId: POLICY_REBUILD_REASON_IDS.INTENT_BOUNDARY_BLOCKED,
      warningId: POLICY_REBUILD_WARNING_IDS.MISSING_IDENTITY_EVIDENCE,
      summary: 'Add or declare destination identity evidence before rebuilding this policy.',
      target: 'belongs_here',
    };
  }

  if (intentBoundary) {
    return {
      reasonId: POLICY_REBUILD_REASON_IDS.INTENT_BOUNDARY_BLOCKED,
      warningId: POLICY_REBUILD_WARNING_IDS.INTENT_BOUNDARY_BLOCKED,
      summary: 'The rebuild proposal stopped because verified intent inference did not pass validation.',
      target: 'intent_boundary',
    };
  }

  return {
    reasonId: POLICY_REBUILD_REASON_IDS.EVIDENCE_BOUNDARY_BLOCKED,
    warningId: POLICY_REBUILD_WARNING_IDS.EVIDENCE_BOUNDARY_BLOCKED,
    summary: 'The rebuild proposal stopped because its policy boundary did not pass validation.',
    target: 'evidence_boundary',
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
      Object.values(POLICY_EVIDENCE_BUCKET_IDS).map(bucketId => [
        bucketId,
        asArray(evidenceProjection?.buckets?.[bucketId]).length,
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
      POLICY_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY,
      'Observed absence is review context only and was not promoted to an avoid or exclusion rule.',
      { target: POLICY_INTENT_FIELD_IDS.ASK_WHEN }
    ));
  }

  if (asArray(intentDraft.belongs_here).length === 0) {
    warnings.push(buildWarning(
      POLICY_REBUILD_WARNING_IDS.MISSING_IDENTITY_EVIDENCE,
      'The rebuild proposal needs stronger belongs-here evidence before activation.',
      { target: POLICY_INTENT_FIELD_IDS.BELONGS_HERE }
    ));
  }

  if (asArray(intentDraft.hard_limits).length > 0 || asArray(intentDraft.avoid).length > 0) {
    warnings.push(buildWarning(
      POLICY_REBUILD_WARNING_IDS.EXPLICIT_CONSTRAINT_REVIEW_REQUIRED,
      'Explicit operator constraints were preserved and should be reviewed before acceptance.',
      { target: POLICY_INTENT_FIELD_IDS.HARD_LIMITS }
    ));
  }

  if (readiness.stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING) {
    warnings.push(buildWarning(
      POLICY_REBUILD_WARNING_IDS.MISSING_ROUTING_CONFIGURATION,
      'Routing must be configured before this proposal can support automatic routing.',
      { target: POLICY_INTENT_FIELD_IDS.ROUTING_TARGET }
    ));
  }

  if (readiness.stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE) {
    warnings.push(buildWarning(
      POLICY_REBUILD_WARNING_IDS.STALE_PROFILE,
      'Refresh the library profile before accepting this proposal.',
      { target: 'profile_refresh' }
    ));
  }

  if (evidenceInput.guardedOutcomeEvidenceSummary?.missingFingerprintCount > 0) {
    warnings.push(buildWarning(
      POLICY_REBUILD_WARNING_IDS.GUARDED_OUTCOME_WITHOUT_FINGERPRINT,
      'One or more guarded outcomes were ignored because they do not carry an upstream evidence fingerprint.',
      { target: 'guarded_outcomes', severity: 'error' }
    ));
  }

  if (evidenceInput.guardedOutcomeEvidenceSummary?.missingRequestProofCount > 0) {
    warnings.push(buildWarning(
      POLICY_REBUILD_WARNING_IDS.GUARDED_OUTCOME_WITHOUT_REQUEST_PROOF,
      'One or more guarded outcomes were ignored because they do not carry request-time validation proof.',
      { target: 'guarded_outcomes', severity: 'error' }
    ));
  }

  if (evidenceInput.guardedOutcomeEvidenceSummary?.invalidRequestProofCount > 0) {
    warnings.push(buildWarning(
      POLICY_REBUILD_WARNING_IDS.GUARDED_OUTCOME_INVALID_REQUEST_PROOF,
      'One or more guarded outcomes were ignored because request-time validation proof failed.',
      { target: 'guarded_outcomes', severity: 'error' }
    ));
  }

  asArray(intentDraft.warnings).forEach(warning => {
    if (warning.reasonCode === POLICY_INTENT_WARNING_IDS.OBSERVED_ABSENCE_NOT_EXCLUSION) {
      warnings.push(buildWarning(
        POLICY_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY,
        warning.summary || 'Observed absence stayed a warning rather than an exclusion.',
        { target: POLICY_INTENT_FIELD_IDS.ASK_WHEN }
      ));
    }
  });

  return warnings;
}

function determineStatus({ intentDraft, readiness, warnings }) {
  if (readiness.stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.STALE_PROFILE) {
    return POLICY_REBUILD_PROPOSAL_STATUS_IDS.STALE_PROFILE;
  }

  if (readiness.stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.BLOCKED_BY_HARD_LIMIT) {
    return POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED;
  }

  if (readiness.stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_ROUTING) {
    return POLICY_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_ROUTING_CONFIGURATION;
  }

  if (asArray(intentDraft.belongs_here).length === 0) {
    return POLICY_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_MORE_EVIDENCE;
  }

  if (warnings.some(warning =>
    warning.reasonId === POLICY_REBUILD_WARNING_IDS.EXPLICIT_CONSTRAINT_REVIEW_REQUIRED
  )) {
    return POLICY_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_OPERATOR_CONSTRAINT_REVIEW;
  }

  return POLICY_REBUILD_PROPOSAL_STATUS_IDS.READY_FOR_REVIEW;
}

function buildTrace({
  statusId,
  evidenceSourceSummary,
  warnings,
  inputContract,
  evidenceBoundary,
  intentBoundary = null,
  readinessBoundary = null,
}) {
  const reasons = [
    POLICY_REBUILD_REASON_IDS.LIBRARY_PROFILE_CONSUMED,
    POLICY_REBUILD_REASON_IDS.GUARDED_OUTCOMES_CONSUMED,
    POLICY_REBUILD_REASON_IDS.EXPLICIT_CONSTRAINTS_PRESERVED,
    POLICY_REBUILD_REASON_IDS.ROUTING_CONFIGURATION_CONSUMED,
    POLICY_REBUILD_REASON_IDS.OUTLIERS_REVIEWED,
    POLICY_REBUILD_REASON_IDS.PROFILE_FRESHNESS_REVIEWED,
    POLICY_REBUILD_REASON_IDS.OPERATOR_ACCEPTANCE_REQUIRED,
    POLICY_REBUILD_REASON_IDS.ROLLBACK_SNAPSHOT_REQUIRED,
    POLICY_REBUILD_REASON_IDS.SIDE_EFFECTS_DISABLED,
  ];

  if (warnings.some(warning =>
    warning.reasonId === POLICY_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY
  )) {
    reasons.push(POLICY_REBUILD_REASON_IDS.OBSERVED_ABSENCE_IS_WARNING_ONLY);
  }

  const boundedReasons = reasons.slice(0, MAX_TRACE_REASONS).map(reasonId => ({
    reasonId,
    severity: 'info',
  }));

  return {
    attributes: {
      'classifarr.policy.rebuild.version': 'policy.library_policy_rebuild.v1',
      'classifarr.policy.rebuild.status': statusId,
      'classifarr.policy.rebuild.input_contract_version': inputContract?.version || null,
      'classifarr.policy.rebuild.input_contract_profile_stale': inputContract?.profile?.stale === true,
      'classifarr.policy.rebuild.input_contract_guarded_outcome_count':
        inputContract?.guardedOutcomes?.count ?? 0,
      'classifarr.policy.rebuild.identity_count': evidenceSourceSummary.libraryProfile.identityCount,
      'classifarr.policy.rebuild.guarded_outcome_count': evidenceSourceSummary.guardedOutcomes.count,
      'classifarr.policy.rebuild.guarded_outcome_fingerprint_count':
        evidenceSourceSummary.guardedOutcomes.fingerprintCount,
      'classifarr.policy.rebuild.guarded_outcome_missing_fingerprint_count':
        evidenceSourceSummary.guardedOutcomes.missingFingerprintCount,
      'classifarr.policy.rebuild.guarded_outcome_request_proof_count':
        evidenceSourceSummary.guardedOutcomes.requestProofCount,
      'classifarr.policy.rebuild.guarded_outcome_missing_request_proof_count':
        evidenceSourceSummary.guardedOutcomes.missingRequestProofCount,
      'classifarr.policy.rebuild.guarded_outcome_invalid_request_proof_count':
        evidenceSourceSummary.guardedOutcomes.invalidRequestProofCount,
      'classifarr.policy.rebuild.routing_configured': evidenceSourceSummary.routing.configured,
      'classifarr.policy.rebuild.warning_count': warnings.length,
      'classifarr.policy.rebuild.evidence_boundary_status': evidenceBoundary?.statusId || null,
      'classifarr.policy.rebuild.evidence_boundary_issue_count': evidenceBoundary?.issueCount ?? 0,
      'classifarr.policy.rebuild.evidence_boundary_ready': evidenceBoundary?.ok === true,
      'classifarr.policy.rebuild.intent_boundary_status': intentBoundary?.statusId || null,
      'classifarr.policy.rebuild.intent_boundary_issue_count': intentBoundary?.issueCount ?? 0,
      'classifarr.policy.rebuild.intent_boundary_ready': intentBoundary?.ok === true,
      'classifarr.policy.rebuild.readiness_boundary_status': readinessBoundary?.statusId || null,
      'classifarr.policy.rebuild.readiness_boundary_issue_count': readinessBoundary?.issueCount ?? 0,
      'classifarr.policy.rebuild.readiness_boundary_ready': readinessBoundary?.ok === true,
    },
    reasons: boundedReasons,
    truncated: reasons.length > boundedReasons.length,
  };
}

function requireValidGuardedOutcomeProjection(input = {}) {
  const rebuildInput = asObject(input);
  const projection = asObject(rebuildInput.guardedOutcomeProjection);
  if (projection.version !== POLICY_GUARDED_OUTCOME_PROJECTION_VERSION) {
    throw new TypeError(
      'Library policy rebuild requires a policy.guarded_outcome_projection.v1 projection.'
    );
  }

  const validation = validatePolicyGuardedOutcomeProjection(projection);
  if (!validation.ok) {
    throw new TypeError('Library policy rebuild requires a valid guarded-outcome projection.');
  }

  return projection;
}

function buildBlockedPolicyLibraryPolicyRebuildProposal({
  input = {},
  inputContract = null,
  evidenceInput = {},
  evidenceBoundary,
  intentBoundary = null,
  readinessBoundary = null,
  guardedOutcomeProjection,
  statusId = POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY,
} = {}) {
  const evidenceSourceSummary = collectEvidenceSourceSummary({
    evidenceInput,
    evidenceProjection: null,
  });
  const boundaryMetadata = getBoundaryBlockMetadata({
    statusId,
    intentBoundary,
    readinessBoundary,
  });
  const warnings = [buildWarning(
    boundaryMetadata.warningId,
    boundaryMetadata.summary,
    {
      target: boundaryMetadata.target,
      severity: 'error',
    }
  )];

  return {
    version: 'policy.library_policy_rebuild.v1',
    statusId,
    library: {
      libraryId: input.library?.libraryId ?? input.libraryId ?? null,
      libraryName: normalizeString(input.library?.libraryName ?? input.library?.name ?? input.libraryName),
      mediaType: normalizeString(input.library?.mediaType ?? input.mediaType),
    },
    inputContract,
    guardedOutcomeProjection,
    evidenceBoundary,
    intentBoundary,
    readinessBoundary,
    evidenceProjection: null,
    intentDraft: null,
    readiness: null,
    evidenceSourceSummary,
    confidence: {
      level: 'blocked',
      score: 0,
      reasonCodes: [boundaryMetadata.reasonId],
    },
    assumptions: [
      {
        reasonCode: POLICY_REBUILD_REASON_IDS.OPERATOR_ACCEPTANCE_REQUIRED,
        summary: 'The rebuild proposal cannot activate until an operator accepts it.',
      },
      {
        reasonCode: POLICY_REBUILD_REASON_IDS.ROLLBACK_SNAPSHOT_REQUIRED,
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
      inputContract,
      evidenceBoundary,
      intentBoundary,
      readinessBoundary,
    }),
  };
}

function buildPolicyLibraryPolicyRebuildProposalFromInputContract(input = {}) {
  const inputValidation = validatePolicyLibraryRebuildInputContract(input);
  if (!inputValidation.ok) {
    throw new TypeError('Library policy rebuild requires a valid rebuild-input contract.');
  }

  const inputContract = buildPolicyLibraryRebuildInputSummary(input);
  const guardedOutcomeProjection = requireValidGuardedOutcomeProjection(input);
  const evidenceInput = buildEvidenceInput(input, guardedOutcomeProjection);
  const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
    evidenceInput: buildRebuildEvidenceEnvelope(evidenceInput),
  });
  const evidenceBoundary = buildEvidenceBoundaryContext(boundedEvidenceResult);

  if (boundedEvidenceResult.ok !== true || !boundedEvidenceResult.projection) {
    return buildBlockedPolicyLibraryPolicyRebuildProposal({
      input,
      inputContract,
      evidenceInput,
      evidenceBoundary,
      guardedOutcomeProjection,
    });
  }

  const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
    boundedEvidenceResult,
  });
  const intentBoundary = buildIntentBoundaryContext(boundedIntentResult);

  if (boundedIntentResult.ok !== true || !boundedIntentResult.intent) {
    const statusId = boundedIntentResult.statusId === 'blocked_by_evidence_quality'
      ? POLICY_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_MORE_EVIDENCE
      : POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY;

    return buildBlockedPolicyLibraryPolicyRebuildProposal({
      input,
      inputContract,
      evidenceInput,
      evidenceBoundary,
      intentBoundary,
      guardedOutcomeProjection,
      statusId,
    });
  }

  const evidenceProjection = boundedEvidenceResult.projection;
  const intentDraft = boundedIntentResult.intent;
  const boundedLearningResult = buildPolicyLibraryRebuildReadinessHandoff({
    boundedIntentResult,
    guardedOutcomeProjection,
  });

  if (boundedLearningResult.ok !== true || !boundedLearningResult.decision) {
    return buildBlockedPolicyLibraryPolicyRebuildProposal({
      input,
      inputContract,
      evidenceInput,
      evidenceBoundary,
      intentBoundary,
      readinessBoundary: {
        statusId: boundedLearningResult.statusId || null,
        ok: false,
        issueCount: boundedLearningResult.issueCount || 0,
        riskIds: asArray(boundedLearningResult.issues)
          .map(issue => normalizeString(issue?.riskId))
          .filter(Boolean)
          .slice(0, MAX_EVIDENCE_BOUNDARY_RISK_IDS),
      },
      guardedOutcomeProjection,
      statusId: POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED_BY_READINESS_BOUNDARY,
    });
  }

  const boundedReadinessResult = buildPolicyAutomationReadinessFromBoundedContracts({
    boundedEvidenceResult,
    boundedIntentResult,
    boundedLearningResult,
    routing: evidenceInput.routing,
    profileFreshness: evidenceInput.profileFreshness,
  });
  const readinessBoundary = buildReadinessBoundaryContext(boundedReadinessResult);

  if (boundedReadinessResult.ok !== true || !boundedReadinessResult.readiness) {
    return buildBlockedPolicyLibraryPolicyRebuildProposal({
      input,
      inputContract,
      evidenceInput,
      evidenceBoundary,
      intentBoundary,
      readinessBoundary,
      guardedOutcomeProjection,
      statusId: POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED_BY_READINESS_BOUNDARY,
    });
  }

  const readiness = boundedReadinessResult.readiness;
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
    version: 'policy.library_policy_rebuild.v1',
    statusId,
    library: {
      libraryId: input.library?.libraryId ?? input.libraryId ?? null,
      libraryName: normalizeString(input.library?.libraryName ?? input.library?.name ?? input.libraryName),
      mediaType: normalizeString(input.library?.mediaType ?? input.mediaType),
    },
    inputContract,
    guardedOutcomeProjection,
    evidenceBoundary,
    intentBoundary,
    readinessBoundary,
    evidenceProjection,
    intentDraft,
    readiness,
    evidenceSourceSummary,
    confidence: intentDraft.confidence,
    assumptions: [
      ...asArray(intentDraft.assumptions),
      {
        reasonCode: POLICY_REBUILD_REASON_IDS.OPERATOR_ACCEPTANCE_REQUIRED,
        summary: 'The rebuild proposal cannot activate until an operator accepts it.',
      },
      {
        reasonCode: POLICY_REBUILD_REASON_IDS.ROLLBACK_SNAPSHOT_REQUIRED,
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
      inputContract,
      evidenceBoundary,
      intentBoundary,
      readinessBoundary,
    }),
  };
}

function buildPolicyLibraryPolicyRebuildProposalFromGuardedOutcomeProjection(input = {}) {
  const rebuildInput = buildPolicyLibraryRebuildInputFromGuardedOutcomeProjection(input);

  return buildPolicyLibraryPolicyRebuildProposalFromInputContract(rebuildInput);
}

function buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput(input = {}) {
  const rebuildInput = buildPolicyLibraryRebuildInputFromRuntimeInput(input);

  return buildPolicyLibraryPolicyRebuildProposalFromInputContract(rebuildInput);
}

function validatePolicyLibraryPolicyRebuildProposal(proposal = {}) {
  const issues = [];
  const inputContract = asObject(proposal.inputContract);
  const evidenceBoundary = asObject(proposal.evidenceBoundary);
  const intentBoundary = asObject(proposal.intentBoundary);
  const readinessBoundary = asObject(proposal.readinessBoundary);
  const guardedOutcomeProjection = asObject(proposal.guardedOutcomeProjection);
  const blockedByEvidenceBoundary =
    proposal.statusId === POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY;
  const blockedByIntentBoundary =
    proposal.statusId === POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY ||
    (
      proposal.statusId === POLICY_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_MORE_EVIDENCE &&
      intentBoundary.ok === false
    );
  const blockedByReadinessBoundary =
    proposal.statusId === POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED_BY_READINESS_BOUNDARY;
  const blockedByBoundary =
    blockedByEvidenceBoundary || blockedByIntentBoundary || blockedByReadinessBoundary;

  if (proposal.version !== 'policy.library_policy_rebuild.v1') {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_PROPOSAL_VERSION,
      message: 'Library policy rebuild proposal must use the policy library rebuild version.',
    });
  }

  if (inputContract.version !== POLICY_LIBRARY_REBUILD_INPUT_CONTRACT_VERSION ||
      inputContract.statusId !== 'ready' ||
      inputContract.ok !== true ||
      !Number.isInteger(Number(inputContract.libraryId))) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_INPUT_CONTRACT,
      message: 'Library policy rebuild proposal must retain a ready sanitized rebuild-input contract summary.',
    });
  } else if (
    Number(proposal.library?.libraryId) !== Number(inputContract.libraryId) ||
    Number(inputContract.profile?.libraryId) !== Number(inputContract.libraryId) ||
    inputContract.profile?.version !== POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_VERSION
  ) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INPUT_CONTRACT_LIBRARY_MISMATCH,
      message: 'Library policy rebuild proposal input-contract summary must match the selected library and profile handoff.',
    });
  } else if (
    inputContract.guardedOutcomes?.version !== POLICY_GUARDED_OUTCOME_PROJECTION_VERSION ||
    inputContract.guardedOutcomes?.count !==
      inputContract.guardedOutcomes?.acceptedCount +
      inputContract.guardedOutcomes?.rejectedCount +
        inputContract.guardedOutcomes?.ignoredCount
  ) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INVALID_INPUT_CONTRACT,
      message: 'Library policy rebuild proposal input-contract summary must retain bounded guarded-outcome provenance.',
    });
  } else if (
    inputContract.guardedOutcomes?.count !== proposal.evidenceSourceSummary?.guardedOutcomes?.count ||
    inputContract.guardedOutcomes?.acceptedCount !== proposal.evidenceSourceSummary?.guardedOutcomes?.acceptedCount ||
    inputContract.guardedOutcomes?.rejectedCount !== proposal.evidenceSourceSummary?.guardedOutcomes?.rejectedCount ||
    inputContract.guardedOutcomes?.fingerprintCount !== proposal.evidenceSourceSummary?.guardedOutcomes?.fingerprintCount ||
    inputContract.guardedOutcomes?.requestProofCount !== proposal.evidenceSourceSummary?.guardedOutcomes?.requestProofCount
  ) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INVALID_INPUT_CONTRACT,
      message: 'Library policy rebuild proposal input-contract summary must match emitted guarded-outcome evidence.',
    });
  }

  if (guardedOutcomeProjection.version !== POLICY_GUARDED_OUTCOME_PROJECTION_VERSION) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_GUARDED_OUTCOME_PROJECTION,
      message: 'Library policy rebuild proposal must retain a guarded-outcome projection.',
    });
  } else {
    const guardedOutcomeProjectionValidation =
      validatePolicyGuardedOutcomeProjection(guardedOutcomeProjection);
    if (!guardedOutcomeProjectionValidation.ok) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INVALID_GUARDED_OUTCOME_PROJECTION,
        message: 'Library policy rebuild proposal must retain a valid guarded-outcome projection.',
        details: guardedOutcomeProjectionValidation.issues,
      });
    }
  }

  if (!evidenceBoundary.version || !evidenceBoundary.statusId) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_EVIDENCE_BOUNDARY,
      message: 'Library policy rebuild proposal must retain a sanitized evidence-boundary context.',
    });
  }

  if (blockedByEvidenceBoundary) {
    if (evidenceBoundary.ok !== false) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_EVIDENCE_BOUNDARY_NOT_FAILED,
        message: 'An evidence-boundary-blocked rebuild proposal must retain a failed boundary context.',
      });
    }

    if (proposal.evidenceProjection || proposal.intentDraft || proposal.readiness) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_EVIDENCE_BOUNDARY_WITH_DERIVED_CONTRACT,
        message: 'An evidence-boundary-blocked rebuild proposal cannot retain projection, intent, or readiness output.',
      });
    }
    if (Object.keys(intentBoundary).length > 0) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_EVIDENCE_BOUNDARY_WITH_DERIVED_CONTRACT,
        message: 'An evidence-boundary-blocked rebuild proposal cannot retain an intent-boundary output.',
      });
    }
    if (Object.keys(readinessBoundary).length > 0) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_EVIDENCE_BOUNDARY_WITH_DERIVED_CONTRACT,
        message: 'An evidence-boundary-blocked rebuild proposal cannot retain a readiness-boundary output.',
      });
    }
  } else if (blockedByIntentBoundary) {
    if (
      evidenceBoundary.ok !== true ||
      !SHA256_FINGERPRINT_PATTERN.test(evidenceBoundary.projectionFingerprint?.fingerprint || '') ||
      evidenceBoundary.projectionFingerprint?.algorithm !== 'sha256'
    ) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INVALID_EVIDENCE_BOUNDARY,
        message: 'An intent-boundary-blocked rebuild proposal requires a valid evidence boundary.',
      });
    }
    if (intentBoundary.ok !== false) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_INTENT_BOUNDARY_NOT_FAILED,
        message: 'An intent-boundary-blocked rebuild proposal must retain a failed intent boundary.',
      });
    }
    if (![
      POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED_BY_INTENT_BOUNDARY,
      POLICY_REBUILD_PROPOSAL_STATUS_IDS.NEEDS_MORE_EVIDENCE,
    ].includes(proposal.statusId)) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_INTENT_BOUNDARY_NOT_FAILED,
        message: 'A failed intent boundary must produce an intent block or needs-more-evidence status.',
      });
    }
    if (proposal.evidenceProjection || proposal.intentDraft || proposal.readiness) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_INTENT_BOUNDARY_WITH_DERIVED_CONTRACT,
        message: 'An intent-boundary-blocked rebuild proposal cannot retain projection, intent, or readiness output.',
      });
    }
    if (Object.keys(readinessBoundary).length > 0) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_INTENT_BOUNDARY_WITH_DERIVED_CONTRACT,
        message: 'An intent-boundary-blocked rebuild proposal cannot retain a readiness-boundary output.',
      });
    }
  } else if (blockedByReadinessBoundary) {
    const evidenceFingerprint = evidenceBoundary.projectionFingerprint?.fingerprint;
    const intentFingerprint = intentBoundary.projectionFingerprint?.fingerprint;
    const readinessEvidenceFingerprint = readinessBoundary.evidenceBoundary?.projectionFingerprint?.fingerprint;
    const readinessIntentFingerprint = readinessBoundary.intentBoundary?.projectionFingerprint?.fingerprint;
    const readinessLearningFingerprint = readinessBoundary.learningBoundary?.projectionFingerprint?.fingerprint;

    if (
      evidenceBoundary.ok !== true ||
      !SHA256_FINGERPRINT_PATTERN.test(evidenceFingerprint || '') ||
      evidenceBoundary.projectionFingerprint?.algorithm !== 'sha256'
    ) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INVALID_EVIDENCE_BOUNDARY,
        message: 'A readiness-boundary-blocked rebuild proposal requires a valid evidence boundary.',
      });
    }
    if (
      intentBoundary.ok !== true ||
      intentBoundary.statusId !== 'ready' ||
      intentBoundary.intentAuditOk !== true ||
      intentBoundary.evidenceFingerprintAuditOk !== true ||
      intentFingerprint !== evidenceFingerprint
    ) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INVALID_INTENT_BOUNDARY,
        message: 'A readiness-boundary-blocked rebuild proposal requires a verified intent boundary.',
      });
    }
    if (
      !readinessBoundary.statusId ||
      readinessBoundary.ok !== false ||
      !Number.isFinite(Number(readinessBoundary.issueCount)) ||
      !Array.isArray(readinessBoundary.riskIds)
    ) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_READINESS_BOUNDARY_NOT_FAILED,
        message: 'A readiness-boundary-blocked rebuild proposal must retain a sanitized failed readiness boundary.',
      });
    }
    if (proposal.evidenceProjection || proposal.intentDraft || proposal.readiness) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.BLOCKED_READINESS_BOUNDARY_WITH_DERIVED_CONTRACT,
        message: 'A readiness-boundary-blocked rebuild proposal cannot retain projection, intent, or readiness output.',
      });
    }
    if (
      readinessBoundary.projectionFingerprintMatch === true &&
      (
        evidenceFingerprint !== readinessEvidenceFingerprint ||
        evidenceFingerprint !== readinessIntentFingerprint ||
        evidenceFingerprint !== readinessLearningFingerprint
      )
    ) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.READINESS_BOUNDARY_PROVENANCE_MISMATCH,
        message: 'Readiness-boundary provenance must agree when the handoff reports a match.',
      });
    }
  } else if (
    evidenceBoundary.ok !== true ||
    !SHA256_FINGERPRINT_PATTERN.test(evidenceBoundary.projectionFingerprint?.fingerprint || '') ||
    evidenceBoundary.projectionFingerprint?.algorithm !== 'sha256'
  ) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INVALID_EVIDENCE_BOUNDARY,
      message: 'A non-blocked rebuild proposal requires a ready evidence boundary with a valid projection fingerprint.',
    });
  }

  if (!blockedByBoundary) {
    const evidenceFingerprint = evidenceBoundary.projectionFingerprint?.fingerprint;
    const intentBoundaryFingerprint = intentBoundary.projectionFingerprint?.fingerprint;
    const intentFingerprint = proposal.intentDraft?.evidenceBoundary?.projectionFingerprint?.fingerprint;
    const hasIntentBoundary = Object.keys(intentBoundary).length > 0;
    const hasVerifiedIntentBoundary =
      intentBoundary.ok === true &&
      intentBoundary.statusId === 'ready' &&
      intentBoundary.intentVersion === 'policy.intent.v1' &&
      intentBoundary.intentAuditOk === true &&
      intentBoundary.evidenceFingerprintAuditOk === true &&
      intentBoundary.projectionFingerprint?.algorithm === 'sha256' &&
      SHA256_FINGERPRINT_PATTERN.test(intentBoundaryFingerprint || '');

    if (!hasIntentBoundary) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_INTENT_BOUNDARY,
        message: 'A ready rebuild proposal requires a bounded intent-boundary summary.',
      });
    } else if (!hasVerifiedIntentBoundary) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INVALID_INTENT_BOUNDARY,
        message: 'A ready rebuild proposal requires a passing bounded intent boundary.',
      });
    }

    if (
      !evidenceFingerprint ||
      evidenceFingerprint !== intentBoundaryFingerprint ||
      evidenceFingerprint !== intentFingerprint
    ) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INTENT_BOUNDARY_PROVENANCE_MISMATCH,
        message: 'A ready rebuild proposal intent must retain the verified evidence fingerprint.',
      });
    }

    const readinessEvidenceFingerprint = readinessBoundary.evidenceBoundary?.projectionFingerprint?.fingerprint;
    const readinessIntentFingerprint = readinessBoundary.intentBoundary?.projectionFingerprint?.fingerprint;
    const readinessLearningFingerprint = readinessBoundary.learningBoundary?.projectionFingerprint?.fingerprint;
    const hasReadinessBoundary = Object.keys(readinessBoundary).length > 0;
    const hasVerifiedReadinessBoundary =
      readinessBoundary.ok === true &&
      readinessBoundary.statusId === 'ready' &&
      readinessBoundary.readinessAuditOk === true &&
      readinessBoundary.projectionFingerprintMatch === true &&
      readinessBoundary.evidenceBoundary?.statusId === 'ready' &&
      readinessBoundary.intentBoundary?.statusId === 'ready' &&
      readinessBoundary.learningBoundary?.statusId === 'ready' &&
      readinessBoundary.evidenceBoundary?.projectionFingerprint?.algorithm === 'sha256' &&
      readinessBoundary.intentBoundary?.projectionFingerprint?.algorithm === 'sha256' &&
      readinessBoundary.learningBoundary?.projectionFingerprint?.algorithm === 'sha256';

    if (!hasReadinessBoundary) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_READINESS_BOUNDARY,
        message: 'A ready rebuild proposal requires a bounded readiness-boundary summary.',
      });
    } else if (!hasVerifiedReadinessBoundary) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INVALID_READINESS_BOUNDARY,
        message: 'A ready rebuild proposal requires a passing bounded readiness boundary.',
      });
    }

    if (
      !evidenceFingerprint ||
      evidenceFingerprint !== readinessEvidenceFingerprint ||
      evidenceFingerprint !== readinessIntentFingerprint ||
      evidenceFingerprint !== readinessLearningFingerprint
    ) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.READINESS_BOUNDARY_PROVENANCE_MISMATCH,
        message: 'A ready rebuild proposal readiness must retain the verified evidence fingerprint.',
      });
    }
  }

  if (!blockedByBoundary && proposal.intentDraft?.version !== 'policy.intent.v1') {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_INTENT_DRAFT,
      message: 'Library policy rebuild proposal must include a bounded policy intent draft.',
    });
  } else if (!blockedByBoundary) {
    const intentValidation = validatePolicyIntentDraft(proposal.intentDraft);
    if (!intentValidation.ok) {
      issues.push({
        riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INVALID_INTENT_DRAFT,
        message: 'Library policy rebuild proposal must include a valid bounded policy intent draft.',
        details: intentValidation.issues,
      });
    }
  }

  const readinessValidation = blockedByBoundary
    ? { ok: true }
    : validatePolicyAutomationReadiness(proposal.readiness);
  if (!readinessValidation.ok) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.INVALID_READINESS,
      message: 'Library policy rebuild proposal must include valid policy automation readiness.',
      details: readinessValidation.issues,
    });
  }

  if (proposal.acceptanceGate?.requiresExplicitOperatorAcceptance !== true) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_OPERATOR_ACCEPTANCE_GATE,
      message: 'Library policy rebuild proposal must require explicit operator acceptance.',
    });
  }

  if (proposal.rollbackGate?.requiresRollbackSnapshot !== true) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_ROLLBACK_GATE,
      message: 'Library policy rebuild proposal must require a rollback snapshot before replacement.',
    });
  }

  Object.entries(asObject(proposal.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      const riskId = {
        policyActivated: POLICY_REBUILD_AUDIT_RISK_IDS.DIRECT_ACTIVATION,
        policyReplaced: POLICY_REBUILD_AUDIT_RISK_IDS.DIRECT_POLICY_REPLACEMENT,
        policyDeleted: POLICY_REBUILD_AUDIT_RISK_IDS.DIRECT_POLICY_DELETE,
        learningWritten: POLICY_REBUILD_AUDIT_RISK_IDS.DIRECT_LEARNING_WRITE,
        routingWritten: POLICY_REBUILD_AUDIT_RISK_IDS.DIRECT_ROUTING_WRITE,
      }[key] || POLICY_REBUILD_AUDIT_RISK_IDS.DIRECT_POLICY_REPLACEMENT;

      issues.push({
        riskId,
        message: `Library policy rebuild proposal cannot perform side effect "${key}".`,
      });
    }
  });

  const observedAbsenceWarnings = asArray(proposal.warnings)
    .filter(warning => warning.reasonId === POLICY_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY);
  const observedAbsenceAvoid = asArray(proposal.intentDraft?.avoid)
    .some(entry => entry.reasonCode === POLICY_REBUILD_WARNING_IDS.OBSERVED_ABSENCE_WARNING_ONLY ||
      entry.reasonCode === 'observed_absence');
  if (observedAbsenceAvoid || (
    observedAbsenceWarnings.length > 0 &&
    asArray(proposal.intentDraft?.avoid).some(entry => entry.inferred === true)
  )) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.OBSERVED_ABSENCE_PROMOTED_TO_AVOID,
      message: 'Observed absence must remain a warning and cannot become an avoid/exclusion rule.',
    });
  }

  const constraintSummary = proposal.evidenceSourceSummary?.explicitConstraints;
  if (constraintSummary && constraintSummary.preserved !== true) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.EXPLICIT_CONSTRAINT_NOT_PRESERVED,
      message: 'Explicit operator constraints must be preserved unless the operator changes them.',
    });
  }

  if (!proposal.evidenceSourceSummary?.libraryProfile) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_EVIDENCE_SOURCE_SUMMARY,
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
  const guardedTraceRequestProofCount = Number(
    proposal.trace?.attributes?.['classifarr.policy.rebuild.guarded_outcome_request_proof_count']
  );
  const guardedTraceMissingRequestProofCount = Number(
    proposal.trace?.attributes?.['classifarr.policy.rebuild.guarded_outcome_missing_request_proof_count']
  );
  const guardedTraceInvalidRequestProofCount = Number(
    proposal.trace?.attributes?.['classifarr.policy.rebuild.guarded_outcome_invalid_request_proof_count']
  );

  if (guardedOutcomeSummary?.missingFingerprintCount > 0) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_WITHOUT_FINGERPRINT,
      message: 'Guarded outcomes must carry upstream sanitized evidence fingerprints before rebuild can consume them.',
    });
  }

  if (guardedOutcomeSummary?.missingRequestProofCount > 0) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_WITHOUT_REQUEST_PROOF,
      message: 'Guarded outcomes must carry request-time validation proof before rebuild can consume them.',
    });
  }

  if (guardedOutcomeSummary?.invalidRequestProofCount > 0) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_INVALID_REQUEST_PROOF,
      message: 'Guarded outcomes must pass request-time validation before rebuild can consume them.',
    });
  }

  if (guardedOutcomeSummary && (
    guardedTraceFingerprintCount !== guardedOutcomeSummary.fingerprintCount ||
    guardedTraceMissingFingerprintCount !== guardedOutcomeSummary.missingFingerprintCount
  )) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_FINGERPRINT_MISMATCH,
      message: 'Guarded outcome fingerprint trace counts must match the rebuild source summary.',
    });
  }

  if (guardedOutcomeSummary && (
    guardedTraceRequestProofCount !== guardedOutcomeSummary.requestProofCount ||
    guardedTraceMissingRequestProofCount !== guardedOutcomeSummary.missingRequestProofCount ||
    guardedTraceInvalidRequestProofCount !== guardedOutcomeSummary.invalidRequestProofCount
  )) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.GUARDED_OUTCOME_REQUEST_PROOF_MISMATCH,
      message: 'Guarded outcome request-proof trace counts must match the rebuild source summary.',
    });
  }

  if (!proposal.confidence?.level || !Array.isArray(proposal.confidence?.reasonCodes)) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_CONFIDENCE,
      message: 'Library policy rebuild proposal must include confidence and reason codes.',
    });
  }

  if (asArray(proposal.trace?.reasons).length === 0) {
    issues.push({
      riskId: POLICY_REBUILD_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      message: 'Library policy rebuild proposal must include bounded trace reasons.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyLibraryPolicyRebuildAudit(proposal = null) {
  const hasProposal = Boolean(proposal && typeof proposal === 'object');
  const validation = hasProposal
    ? validatePolicyLibraryPolicyRebuildProposal(proposal)
    : {
      ok: true,
      issueCount: 0,
      issues: [],
    };

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: hasProposal ? proposal.statusId || null : null,
    validation,
    inputContract: {
      version: POLICY_LIBRARY_REBUILD_INPUT_CONTRACT_VERSION,
      requiresVerifiedCachedProfile: true,
      requiresGuardedOutcomeProjection: true,
      requiresExplicitOperatorAcceptance: true,
      requiresRollbackSnapshot: true,
      proposalValidated: hasProposal,
    },
    nextStep: {
      stepId: 'migration_verifier_rollback',
      label: 'Migration Verifier And Rollback Path',
      reason: 'Library-derived proposals are now side-effect-free and acceptance-gated, so the next boundary is comparing proposal behavior with legacy behavior and enforcing rollback before replacement.',
    },
  };
}

export {
  POLICY_REBUILD_AUDIT_RISK_IDS,
  POLICY_REBUILD_PROPOSAL_STATUS_IDS,
  POLICY_REBUILD_REASON_IDS,
  POLICY_REBUILD_WARNING_IDS,
  buildPolicyLibraryPolicyRebuildAudit,
  buildPolicyLibraryPolicyRebuildProposalFromGuardedOutcomeProjection,
  buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput,
  validatePolicyLibraryPolicyRebuildProposal,
};
