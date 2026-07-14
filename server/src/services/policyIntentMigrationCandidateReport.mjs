import {
  buildPolicyIntentContract,
  POLICY_INTENT_INFERENCE_STATES,
} from './policyIntentContract.mjs';
import {
  POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS,
  buildPolicyCandidateAuthorityEligibility,
} from './policyCandidateAuthorityEligibility.mjs';

const POLICY_INTENT_MIGRATION_CANDIDATE_REPORT_VERSION = 'policy.intent_migration_candidate_report.v1';

const POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS = Object.freeze({
  READY_TO_CONVERT: 'ready_to_convert',
  NEEDS_OPERATOR_REVIEW: 'needs_operator_review',
  PARTIAL_LEGACY_INFERENCE: 'partial_legacy_inference',
  UNSUPPORTED_LEGACY_SHAPE: 'unsupported_legacy_shape',
  MISSING_ROUTING_TARGET: 'missing_routing_target',
  STALE_PROFILE_DEPENDENCY: 'stale_profile_dependency',
  BLOCKED_BY_SERVER_CONTRACT_VALIDATION: 'blocked_by_server_contract_validation',
  BLOCKED_BY_ACTIVE_INTENT_AUTHORITY: 'blocked_by_active_intent_authority',
});

const POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS = Object.freeze({
  INTENT_CONTRACT_VALID: 'intent_contract_valid',
  SERVER_CONTRACT_VALIDATION_FAILED: 'server_contract_validation_failed',
  UNSUPPORTED_SIGNAL_TYPE: 'unsupported_signal_type',
  UNSUPPORTED_SIGNAL_KEYS: 'unsupported_signal_keys',
  PARTIAL_INFERENCE_REQUIRES_REVIEW: 'partial_inference_requires_review',
  MISSING_ROUTING_TARGET: 'missing_routing_target',
  STALE_PROFILE_DEPENDENCY: 'stale_profile_dependency',
  ACTIVE_INTENT_AUTHORITY_CONFLICT: 'active_intent_authority_conflict',
  OPERATOR_REVIEW_REQUIRED: 'operator_review_required',
  READY_WITH_ROUTING_TARGET: 'ready_with_routing_target',
  RAW_LEGACY_JSON_SUPPRESSED: 'raw_legacy_json_suppressed',
});

const POLICY_INTENT_MIGRATION_CANDIDATE_DELETION_IMPACT_IDS = Object.freeze({
  POLICY_PRESETS: 'policy_presets',
  POLICY_OVERRIDES: 'policy_overrides',
  CUSTOM_SIGNALS: 'custom_signals',
  IMPACT_REPLAY_PREVIEW_DIAGNOSTICS: 'impact_replay_preview_diagnostics',
  COMPATIBILITY_BRIDGE_READ: 'compatibility_bridge_read',
});

const POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS = Object.freeze({
  MISSING_POLICY_REPORT: 'missing_policy_report',
  UNKNOWN_STATUS: 'unknown_status',
  MISSING_POLICY_ID: 'missing_policy_id',
  MISSING_POLICY_NAME: 'missing_policy_name',
  MISSING_REASON: 'missing_reason',
  UNSUPPORTED_POLICY_NOT_EXPLICIT: 'unsupported_policy_not_explicit',
  SERVER_VALIDATION_FAILURE_NOT_BLOCKED: 'server_validation_failure_not_blocked',
  MISSING_ROUTING_NOT_EXPLICIT: 'missing_routing_not_explicit',
  STALE_PROFILE_NOT_EXPLICIT: 'stale_profile_not_explicit',
  RAW_LEGACY_JSON_EXPOSED: 'raw_legacy_json_exposed',
  REPORT_MUTATED_STORAGE: 'report_mutated_storage',
  REPORT_UNBOUNDED: 'report_unbounded',
  MISSING_DELETION_IMPACT: 'missing_deletion_impact',
  ACTIVE_AUTHORITY_CONFLICT_NOT_BLOCKED: 'active_authority_conflict_not_blocked',
  ACTIVE_AUTHORITY_BLOCKER_MISSING_DETAILS: 'active_authority_blocker_missing_details',
  ACTIVE_AUTHORITY_REASON_MISSING: 'active_authority_reason_missing',
});

const STATUS_IDS = Object.freeze(Object.values(POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS));
const MAX_POLICIES_DEFAULT = 100;
const MAX_REASONS_DEFAULT = 12;
const MAX_UNSUPPORTED_SIGNALS_DEFAULT = 10;

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

function getPolicyName(policy = {}) {
  return normalizeString(policy.name) ||
    normalizeString(policy.policy_name) ||
    normalizeString(policy.display_name) ||
    `Policy ${policy.id ?? 'unknown'}`;
}

function buildRoutingTarget(policy = {}) {
  const routingTarget = asObject(policy.routingTarget || policy.routing_target);
  const libraryMapping = asObject(policy.libraryMapping || policy.library_mapping);
  const arrType = normalizeString(
    routingTarget.arr_type ||
    routingTarget.arrType ||
    libraryMapping.arr_type ||
    policy.arr_type
  );
  const arrConfigId = normalizeNumber(
    routingTarget.arr_config_id ||
    routingTarget.arrConfigId ||
    libraryMapping.arr_config_id ||
    policy.arr_config_id ||
    policy.arr_id
  );
  const rootFolderPath = normalizeString(
    routingTarget.arr_root_folder_path ||
    routingTarget.rootFolderPath ||
    libraryMapping.arr_root_folder_path ||
    policy.arr_root_folder_path
  );
  const libraryId = normalizeNumber(
    routingTarget.library_id ||
    routingTarget.libraryId ||
    libraryMapping.library_id ||
    policy.library_id
  );
  const configured = Boolean(arrType && (arrConfigId !== null || rootFolderPath));

  return {
    configured,
    libraryId,
    arrType: arrType || null,
    arrConfigId,
    rootFolderPath: rootFolderPath || null,
  };
}

function buildProfileFreshness(policy = {}) {
  const profileFreshness = asObject(policy.profileFreshness || policy.profile_freshness);
  const state = normalizeString(
    profileFreshness.state ||
    profileFreshness.status ||
    policy.profile_freshness_state ||
    policy.profile_state
  );
  const stale = profileFreshness.stale === true ||
    profileFreshness.isStale === true ||
    policy.profile_stale === true ||
    state === 'stale' ||
    state === 'expired';

  return {
    stale,
    state: state || (stale ? 'stale' : 'fresh_or_unknown'),
    lastObservedAt: profileFreshness.lastObservedAt ||
      profileFreshness.last_observed_at ||
      policy.profile_last_observed_at ||
      null,
  };
}

function buildReason(reasonId, message, severity = 'info', metadata = {}) {
  return {
    reasonId,
    severity,
    message,
    ...metadata,
  };
}

function sanitizeUnsupportedSignals(unsupportedSignals, maxUnsupportedSignals) {
  return asArray(unsupportedSignals)
    .slice(0, maxUnsupportedSignals)
    .map(signal => ({
      presetId: signal.preset_id ?? null,
      presetKey: normalizeString(signal.preset_key) || null,
      presetName: normalizeString(signal.preset_name) || null,
      signalType: normalizeString(signal.signal_type) || null,
      reasonCode: normalizeString(signal.reason_code) || 'unsupported_signal',
      unsupportedKeys: asArray(signal.unsupported_keys)
        .map(normalizeString)
        .filter(Boolean)
        .slice(0, 12),
    }));
}

function buildDeletionImpactEstimate(contract = {}) {
  const templateCount = asArray(contract.template_links).length;
  const unsupportedCount = asArray(contract.unsupported_signals).length;
  const hasRules = [
    contract.purpose,
    contract.hard_limits,
    contract.helpful_hints,
    contract.avoid,
  ].some(entries => asArray(entries).length > 0);

  return [
    {
      impactId: POLICY_INTENT_MIGRATION_CANDIDATE_DELETION_IMPACT_IDS.POLICY_PRESETS,
      eligibleAfterConversion: templateCount > 0,
      affectedCount: templateCount,
      summary: 'Preset attachments can become template application provenance after conversion.',
    },
    {
      impactId: POLICY_INTENT_MIGRATION_CANDIDATE_DELETION_IMPACT_IDS.POLICY_OVERRIDES,
      eligibleAfterConversion: hasRules,
      affectedCount: [
        ...asArray(contract.hard_limits),
        ...asArray(contract.helpful_hints),
        ...asArray(contract.avoid),
      ].length,
      summary: 'Overrides can become native intent rules after conversion.',
    },
    {
      impactId: POLICY_INTENT_MIGRATION_CANDIDATE_DELETION_IMPACT_IDS.CUSTOM_SIGNALS,
      eligibleAfterConversion: unsupportedCount === 0,
      affectedCount: unsupportedCount,
      summary: unsupportedCount === 0
        ? 'No unsupported custom signal shape blocks native conversion.'
        : 'Unsupported custom signal shape must be reviewed before deletion.',
    },
    {
      impactId: POLICY_INTENT_MIGRATION_CANDIDATE_DELETION_IMPACT_IDS.IMPACT_REPLAY_PREVIEW_DIAGNOSTICS,
      eligibleAfterConversion: false,
      affectedCount: 0,
      summary: 'Impact/replay preview diagnostic deletion remains gated by the native storage test reset.',
    },
    {
      impactId: POLICY_INTENT_MIGRATION_CANDIDATE_DELETION_IMPACT_IDS.COMPATIBILITY_BRIDGE_READ,
      eligibleAfterConversion: false,
      affectedCount: 1,
      summary: 'Compatibility bridge read deletion waits for native runtime read and rollback-window completion.',
    },
  ];
}

function chooseStatus({
  contract,
  routingTarget,
  profileFreshness,
  authorityEligibility,
  reasons,
}) {
  if (authorityEligibility?.eligible === false) {
    return POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_ACTIVE_INTENT_AUTHORITY;
  }

  if (asArray(contract.unsupported_signals).some(signal =>
    signal.reason_code === 'unsupported_signal_type'
  )) {
    return POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.UNSUPPORTED_LEGACY_SHAPE;
  }

  if (contract.validation?.valid !== true) {
    return POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_SERVER_CONTRACT_VALIDATION;
  }

  if (!routingTarget.configured) {
    return POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.MISSING_ROUTING_TARGET;
  }

  if (profileFreshness.stale) {
    return POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.STALE_PROFILE_DEPENDENCY;
  }

  if (contract.inference_state === POLICY_INTENT_INFERENCE_STATES.PARTIAL) {
    return POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.PARTIAL_LEGACY_INFERENCE;
  }

  if (asArray(contract.validation?.warnings).length > 0 || reasons.some(reason => reason.severity === 'warning')) {
    return POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.NEEDS_OPERATOR_REVIEW;
  }

  return POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT;
}

function buildPolicyCandidate(policy = {}, options = {}) {
  const maxReasons = options.maxReasons ?? MAX_REASONS_DEFAULT;
  const maxUnsupportedSignals = options.maxUnsupportedSignals ?? MAX_UNSUPPORTED_SIGNALS_DEFAULT;
  const maintainerMode = options.maintainerMode === true;
  const includeRawLegacyJson = options.includeRawLegacyJson === true && maintainerMode;
  const contract = options.intentContract || policy.intentContract || buildPolicyIntentContract(policy);
  const routingTarget = buildRoutingTarget(policy);
  const profileFreshness = buildProfileFreshness(policy);
  const authorityEligibility = buildPolicyCandidateAuthorityEligibility({
    policyId: policy.id,
    activeIntentIntegrityReport: options.activeIntentIntegrityReport,
  });
  const unsupportedSignals = sanitizeUnsupportedSignals(
    contract.unsupported_signals,
    maxUnsupportedSignals
  );
  const reasons = [];

  if (contract.validation?.valid === true) {
    reasons.push(buildReason(
      POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.INTENT_CONTRACT_VALID,
      'Server intent contract validation passed.'
    ));
  } else {
    reasons.push(buildReason(
      POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.SERVER_CONTRACT_VALIDATION_FAILED,
      'Server intent contract validation failed.',
      'blocker',
      { errorCount: contract.validation?.error_count ?? 0 }
    ));
  }

  unsupportedSignals.forEach(signal => {
    const unsupportedType = signal.reasonCode === 'unsupported_signal_type';
    reasons.push(buildReason(
      unsupportedType
        ? POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.UNSUPPORTED_SIGNAL_TYPE
        : POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.UNSUPPORTED_SIGNAL_KEYS,
      unsupportedType
        ? 'Legacy policy contains a signal type that native intent cannot represent automatically.'
        : 'Legacy policy contains signal keys that require operator review before conversion.',
      unsupportedType ? 'blocker' : 'warning',
      {
        signalType: signal.signalType,
        presetKey: signal.presetKey,
      }
    ));
  });

  if (contract.inference_state === POLICY_INTENT_INFERENCE_STATES.PARTIAL) {
    reasons.push(buildReason(
      POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.PARTIAL_INFERENCE_REQUIRES_REVIEW,
      'Compatibility projection inferred only a partial native intent contract.',
      'warning'
    ));
  }

  if (!routingTarget.configured) {
    reasons.push(buildReason(
      POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.MISSING_ROUTING_TARGET,
      'Policy is missing a configured Arr routing target.',
      'blocker'
    ));
  }

  if (profileFreshness.stale) {
    reasons.push(buildReason(
      POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.STALE_PROFILE_DEPENDENCY,
      'Policy depends on stale library profile evidence.',
      'blocker',
      { state: profileFreshness.state }
    ));
  }

  if (authorityEligibility.eligible === false) {
    const needsExplicitResolution = authorityEligibility.integrityStatusId === 'blocked_unsafe_duplicate';
    reasons.push(buildReason(
      POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.ACTIVE_INTENT_AUTHORITY_CONFLICT,
      needsExplicitResolution
        ? 'Active native intent authority is ambiguous and requires operator resolution before conversion.'
        : 'Active native intent authority is ambiguous and must be repaired before conversion.',
      'blocker',
      {
        integrityStatusId: authorityEligibility.integrityStatusId,
        activeIntentCount: authorityEligibility.activeIntentCount,
      }
    ));
  }

  if (asArray(contract.validation?.warnings).length > 0) {
    reasons.push(buildReason(
      POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.OPERATOR_REVIEW_REQUIRED,
      'Server contract validation emitted warnings that require operator review.',
      'warning',
      { warningCount: contract.validation.warning_count }
    ));
  }

  if (
    authorityEligibility.eligible === true &&
    routingTarget.configured &&
    contract.validation?.valid === true &&
    !profileFreshness.stale
  ) {
    reasons.push(buildReason(
      POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.READY_WITH_ROUTING_TARGET,
      'Policy has a valid intent contract and configured routing target.'
    ));
  }

  if (!includeRawLegacyJson) {
    reasons.push(buildReason(
      POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.RAW_LEGACY_JSON_SUPPRESSED,
      'Raw legacy JSON is suppressed in operator-safe report mode.',
      'info'
    ));
  }

  const statusId = chooseStatus({
    contract,
    routingTarget,
    profileFreshness,
    authorityEligibility,
    reasons,
  });

  return {
    policyId: policy.id ?? null,
    policyName: getPolicyName(policy),
    libraryId: policy.library_id ?? null,
    libraryName: policy.library_name ?? null,
    statusId,
    canConvert: statusId === POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT,
    requiresOperatorReview: statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT,
    intentContract: {
      schemaVersion: contract.schema_version,
      source: contract.source,
      inferenceState: contract.inference_state,
      valid: contract.validation?.valid === true,
      errorCount: contract.validation?.error_count ?? 0,
      warningCount: contract.validation?.warning_count ?? 0,
      unsupportedSignalCount: asArray(contract.unsupported_signals).length,
    },
    unsupportedSignals,
    routingTarget,
    profileFreshness,
    ...(authorityEligibility.eligible === false ? {
      authorityEligibility: {
        stateId: authorityEligibility.stateId,
        integrityStatusId: authorityEligibility.integrityStatusId,
        activeIntentCount: authorityEligibility.activeIntentCount,
      },
    } : {}),
    deletionImpact: buildDeletionImpactEstimate(contract),
    reasons: reasons.slice(0, maxReasons),
    rawLegacyJson: includeRawLegacyJson
      ? asObject(policy.legacyJson || policy.legacy_json || policy)
      : undefined,
  };
}

function summarizeCandidates(candidates) {
  const countsByStatus = Object.fromEntries(
    STATUS_IDS.map(statusId => [statusId, 0])
  );
  candidates.forEach(candidate => {
    if (countsByStatus[candidate.statusId] !== undefined) {
      countsByStatus[candidate.statusId] += 1;
    }
  });

  return {
    totalPolicyCount: candidates.length,
    convertibleCount: countsByStatus[POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT],
    reviewRequiredCount: candidates.filter(candidate => candidate.requiresOperatorReview).length,
    countsByStatus,
  };
}

function buildPolicyIntentMigrationCandidateReport({
  policies = [],
  maxPolicies = MAX_POLICIES_DEFAULT,
  maxReasons = MAX_REASONS_DEFAULT,
  maxUnsupportedSignals = MAX_UNSUPPORTED_SIGNALS_DEFAULT,
  maintainerMode = false,
  includeRawLegacyJson = false,
  activeIntentIntegrityReport = null,
} = {}) {
  const normalizedMaxPolicies = Math.max(1, Math.min(
    Number.isFinite(Number(maxPolicies)) ? Number(maxPolicies) : MAX_POLICIES_DEFAULT,
    MAX_POLICIES_DEFAULT
  ));
  const sourcePolicies = asArray(policies);
  const candidates = sourcePolicies
    .slice(0, normalizedMaxPolicies)
    .map(policy => buildPolicyCandidate(policy, {
      maxReasons,
      maxUnsupportedSignals,
      maintainerMode,
      includeRawLegacyJson,
      activeIntentIntegrityReport,
    }));
  const report = {
    version: POLICY_INTENT_MIGRATION_CANDIDATE_REPORT_VERSION,
    mode: 'dry_run',
    bounded: {
      maxPolicies: normalizedMaxPolicies,
      maxReasons,
      maxUnsupportedSignals,
      truncated: sourcePolicies.length > normalizedMaxPolicies,
      sourcePolicyCount: sourcePolicies.length,
      emittedPolicyCount: candidates.length,
    },
    candidates,
    summary: summarizeCandidates(candidates),
    rawLegacyJsonIncluded: maintainerMode === true && includeRawLegacyJson === true,
    sideEffects: {
      policyStorageMutated: false,
      nativeRowsInserted: false,
      migrationEventsWritten: false,
      rollbackSnapshotsWritten: false,
      legacyPathsDeleted: false,
    },
    nextStep: {
      stepId: 'explicit_conversion_workflow',
      label: 'Explicit Conversion Workflow',
      reason: 'Candidate readiness is now reportable without writes, so the next step is an explicit conversion action that creates rollback snapshots and migration events.',
    },
  };

  return {
    ...report,
    validation: validatePolicyIntentMigrationCandidateReport(report),
  };
}

function validatePolicyIntentMigrationCandidateReport(report = {}) {
  const issues = [];
  const candidates = asArray(report.candidates);

  if (report.mode !== 'dry_run') {
    issues.push({
      riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.REPORT_MUTATED_STORAGE,
      message: 'Intent migration candidate report must remain in dry-run mode.',
    });
  }

  if (candidates.length === 0 && report.bounded?.sourcePolicyCount > 0) {
    issues.push({
      riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.MISSING_POLICY_REPORT,
      message: 'Migration candidate report must include a candidate row for each emitted policy.',
    });
  }

  if (report.bounded?.emittedPolicyCount > report.bounded?.maxPolicies) {
    issues.push({
      riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.REPORT_UNBOUNDED,
      message: 'Migration candidate report emitted more policies than its max policy bound.',
    });
  }

  candidates.forEach((candidate, index) => {
    if (!STATUS_IDS.includes(candidate.statusId)) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.UNKNOWN_STATUS,
        policyId: candidate.policyId ?? null,
        statusId: candidate.statusId,
        message: 'Migration candidate uses an unknown status.',
      });
    }

    if (candidate.policyId === null || candidate.policyId === undefined) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.MISSING_POLICY_ID,
        candidateIndex: index,
        message: 'Migration candidate must include the affected policy id.',
      });
    }

    if (!normalizeString(candidate.policyName)) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.MISSING_POLICY_NAME,
        policyId: candidate.policyId ?? null,
        message: 'Migration candidate must include the affected policy name.',
      });
    }

    if (asArray(candidate.reasons).length === 0) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.MISSING_REASON,
        policyId: candidate.policyId ?? null,
        message: 'Migration candidate must include explainable bounded reasons.',
      });
    }

    if (
      candidate.authorityEligibility?.stateId ===
        POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_AUTHORITY_CONFLICT &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_ACTIVE_INTENT_AUTHORITY
    ) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.ACTIVE_AUTHORITY_CONFLICT_NOT_BLOCKED,
        policyId: candidate.policyId ?? null,
        message: 'An active native authority conflict must block conversion explicitly.',
      });
    }

    if (
      candidate.statusId === POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_ACTIVE_INTENT_AUTHORITY &&
      candidate.authorityEligibility?.stateId !==
        POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_AUTHORITY_CONFLICT
    ) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.ACTIVE_AUTHORITY_BLOCKER_MISSING_DETAILS,
        policyId: candidate.policyId ?? null,
        message: 'An active native authority blocker must include bounded authority details.',
      });
    }

    if (
      candidate.authorityEligibility?.stateId ===
        POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_AUTHORITY_CONFLICT &&
      !asArray(candidate.reasons).some(reason =>
        reason.reasonId === POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.ACTIVE_INTENT_AUTHORITY_CONFLICT
      )
    ) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.ACTIVE_AUTHORITY_REASON_MISSING,
        policyId: candidate.policyId ?? null,
        message: 'An active native authority conflict must include an explainable bounded reason.',
      });
    }

    if (
      asArray(candidate.unsupportedSignals).some(signal =>
        signal.reasonCode === 'unsupported_signal_type'
      ) &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.UNSUPPORTED_LEGACY_SHAPE &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_ACTIVE_INTENT_AUTHORITY
    ) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.UNSUPPORTED_POLICY_NOT_EXPLICIT,
        policyId: candidate.policyId ?? null,
        message: 'Unsupported legacy signal types must be reported explicitly.',
      });
    }

    if (
      candidate.intentContract?.valid === false &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_SERVER_CONTRACT_VALIDATION &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.UNSUPPORTED_LEGACY_SHAPE &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_ACTIVE_INTENT_AUTHORITY
    ) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.SERVER_VALIDATION_FAILURE_NOT_BLOCKED,
        policyId: candidate.policyId ?? null,
        message: 'Server contract validation failures must block conversion.',
      });
    }

    if (
      candidate.routingTarget?.configured === false &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.MISSING_ROUTING_TARGET &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_SERVER_CONTRACT_VALIDATION &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.UNSUPPORTED_LEGACY_SHAPE &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_ACTIVE_INTENT_AUTHORITY
    ) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.MISSING_ROUTING_NOT_EXPLICIT,
        policyId: candidate.policyId ?? null,
        message: 'Missing routing target must be explicit unless a higher-priority blocker exists.',
      });
    }

    if (
      candidate.profileFreshness?.stale === true &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.STALE_PROFILE_DEPENDENCY &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_SERVER_CONTRACT_VALIDATION &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.UNSUPPORTED_LEGACY_SHAPE &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.MISSING_ROUTING_TARGET &&
      candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_ACTIVE_INTENT_AUTHORITY
    ) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.STALE_PROFILE_NOT_EXPLICIT,
        policyId: candidate.policyId ?? null,
        message: 'Stale profile dependency must be explicit unless a higher-priority blocker exists.',
      });
    }

    if (asArray(candidate.deletionImpact).length === 0) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.MISSING_DELETION_IMPACT,
        policyId: candidate.policyId ?? null,
        message: 'Migration candidate must include estimated legacy deletion impact.',
      });
    }

    if (candidate.rawLegacyJson && report.rawLegacyJsonIncluded !== true) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.RAW_LEGACY_JSON_EXPOSED,
        policyId: candidate.policyId ?? null,
        message: 'Raw legacy JSON cannot be exposed in operator-safe report mode.',
      });
    }
  });

  Object.entries(report.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.REPORT_MUTATED_STORAGE,
        message: `Migration candidate report cannot perform side effect "${key}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyIntentMigrationCandidateReportAudit(
  report = buildPolicyIntentMigrationCandidateReport()
) {
  const validation = validatePolicyIntentMigrationCandidateReport(report);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    emittedPolicyCount: report.bounded?.emittedPolicyCount ?? 0,
    summary: report.summary || summarizeCandidates([]),
    validation,
    nextStep: report.nextStep || {
      stepId: 'explicit_conversion_workflow',
      label: 'Explicit Conversion Workflow',
      reason: 'Dry-run readiness reporting is complete; conversion now needs an explicit audited action.',
    },
  };
}

export {
  POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS,
  POLICY_INTENT_MIGRATION_CANDIDATE_DELETION_IMPACT_IDS,
  POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS,
  POLICY_INTENT_MIGRATION_CANDIDATE_REPORT_VERSION,
  POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS,
  buildPolicyIntentMigrationCandidateReport,
  buildPolicyIntentMigrationCandidateReportAudit,
  validatePolicyIntentMigrationCandidateReport,
};
