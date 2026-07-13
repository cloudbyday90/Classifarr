import {
  MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS,
} from './policyEvidenceInputCardinality.mjs';
import {
  POLICY_GUARDED_OUTCOME_PROJECTION_VERSION,
  buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions,
  validatePolicyGuardedOutcomeProjection,
} from './policyGuardedOutcomeProjection.mjs';
import {
  POLICY_LEARNING_DECISION_IDS,
} from './policyLearningGuard.mjs';
import {
  POLICY_LIBRARY_PROFILE_EVIDENCE_VERSION,
  buildPolicyLibraryProfileEvidenceAudit,
} from './policyLibraryProfileEvidence.mjs';
import {
  POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_VERSION,
  buildPolicyLibraryProfileEvidenceLoaderAudit,
} from './policyLibraryProfileEvidenceLoader.mjs';

const POLICY_LIBRARY_REBUILD_INPUT_CONTRACT_VERSION = 'policy.library_rebuild_input_contract.v1';
const MAX_REBUILD_SIGNALS_PER_SECTION = 20;
const MAX_REBUILD_FINGERPRINTS = 20;
const MAX_INPUT_SCAN_DEPTH = 8;
const MAX_SIGNAL_LABEL_LENGTH = 160;
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

const POLICY_LIBRARY_REBUILD_INPUT_STATUS_IDS = Object.freeze({
  READY: 'ready',
});

const POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS = Object.freeze({
  UNSUPPORTED_INPUT_FIELD: 'unsupported_input_field',
  UNSAFE_INPUT_SHAPE: 'unsafe_input_shape',
  INPUT_DEPTH_EXCEEDED: 'input_depth_exceeded',
  INPUT_COLLECTION_LIMIT_EXCEEDED: 'input_collection_limit_exceeded',
  INVALID_LIBRARY: 'invalid_library',
  MISSING_PROFILE_HANDOFF: 'missing_profile_handoff',
  INVALID_PROFILE_HANDOFF: 'invalid_profile_handoff',
  INVALID_PROFILE_EVIDENCE: 'invalid_profile_evidence',
  PROFILE_LIBRARY_MISMATCH: 'profile_library_mismatch',
  INVALID_GUARDED_OUTCOME_PROJECTION: 'invalid_guarded_outcome_projection',
  GUARDED_OUTCOME_COLLECTION_LIMIT_EXCEEDED: 'guarded_outcome_collection_limit_exceeded',
  INVALID_CONTRACT: 'invalid_contract',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  SOURCE_SUMMARY_MISMATCH: 'source_summary_mismatch',
});

const PROJECTION_INPUT_KEYS = new Set([
  'library',
  'profileHandoff',
  'operatorIntent',
  'existingConstraints',
  'routingConfiguration',
  'guardedOutcomeProjection',
]);

const RUNTIME_INPUT_KEYS = new Set([
  'library',
  'profileHandoff',
  'operatorIntent',
  'existingConstraints',
  'routingConfiguration',
  'guardedOutcomes',
]);

const PROHIBITED_INPUT_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'apiResponse',
  'omdbRaw',
  'providerPayload',
  'providerResponse',
  'raw',
  'rawProviderPayload',
  'tmdbRaw',
  'fetchProvider',
  'liveLookup',
  'providerLookup',
  'providerRequest',
  'cooldownState',
  'providerQuota',
  'quotaState',
  'rateLimitState',
  'remainingQuota',
  'impactPayload',
  'impactPreview',
  'replayPayload',
  'replayPreview',
]);

function isPlainDataRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPlainDataArray(value) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

function asPlainObject(value) {
  return isPlainDataRecord(value) ? value : {};
}

function asArray(value) {
  return isPlainDataArray(value) ? value : [];
}

function getDataProperty(record, key) {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return undefined;

  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

function normalizeString(value, maximumLength = MAX_SIGNAL_LABEL_LENGTH) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(0, Math.min(Math.trunc(numeric), 1_000_000))
    : null;
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const normalized = numeric > 1 ? numeric / 100 : numeric;
  return Math.max(0, Math.min(normalized, 1));
}

function normalizeTimestamp(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function assertSafeDataTree(value, {
  path = 'input',
  depth = 0,
} = {}) {
  if (value === null || typeof value !== 'object') return;

  if (depth > MAX_INPUT_SCAN_DEPTH) {
    throw new TypeError(`Library rebuild input exceeds the bounded scan depth at "${path}".`);
  }

  if (Array.isArray(value)) {
    if (!isPlainDataArray(value) || value.length > MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS) {
      throw new TypeError(`Library rebuild input collection is not safe or exceeds its bound at "${path}".`);
    }

    value.forEach((entry, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new TypeError(`Library rebuild input must not contain accessor-backed entries at "${path}.${index}".`);
      }

      assertSafeDataTree(descriptor.value, { path: `${path}.${index}`, depth: depth + 1 });
    });
    return;
  }

  if (!isPlainDataRecord(value)) {
    throw new TypeError(`Library rebuild input must use plain data records at "${path}".`);
  }

  Object.keys(value).forEach(key => {
    if (PROHIBITED_INPUT_KEYS.has(key)) {
      throw new TypeError(`Library rebuild input contains a prohibited field at "${path}.${key}".`);
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new TypeError(`Library rebuild input must not use accessor-backed fields at "${path}.${key}".`);
    }

    assertSafeDataTree(descriptor.value, { path: `${path}.${key}`, depth: depth + 1 });
  });
}

function requireSupportedInput(input, allowedKeys) {
  if (!isPlainDataRecord(input)) {
    throw new TypeError('Library rebuild input must be a plain data object.');
  }

  assertSafeDataTree(input);
  const unexpectedKey = Object.keys(input).find(key => !allowedKeys.has(key));
  if (unexpectedKey) {
    throw new TypeError(`Library rebuild input does not accept "${unexpectedKey}".`);
  }
}

function normalizeSignal(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    const label = normalizeString(value);
    return label ? { key: label, label } : null;
  }

  const source = asPlainObject(value);
  const label = normalizeString(
    getDataProperty(source, 'label') ??
    getDataProperty(source, 'name') ??
    getDataProperty(source, 'value') ??
    getDataProperty(source, 'key') ??
    getDataProperty(source, 'id')
  );
  if (!label) return null;

  const rawValue = getDataProperty(source, 'value');
  const valuePrimitive = ['string', 'number', 'boolean'].includes(typeof rawValue)
    ? rawValue
    : null;

  return {
    key: normalizeString(
      getDataProperty(source, 'key') ?? getDataProperty(source, 'id') ?? label
    ) || label,
    label,
    value: valuePrimitive,
    count: normalizeCount(
      getDataProperty(source, 'count') ??
      getDataProperty(source, 'occurrences') ??
      getDataProperty(source, 'evidenceCount')
    ),
    confidence: normalizeConfidence(
      getDataProperty(source, 'confidence') ?? getDataProperty(source, 'score')
    ),
    reasonCode: normalizeString(getDataProperty(source, 'reasonCode')) || null,
    observedAt: normalizeTimestamp(
      getDataProperty(source, 'observedAt') ?? getDataProperty(source, 'updatedAt')
    ),
    stale: getDataProperty(source, 'stale') === true,
  };
}

function normalizeSignals(value) {
  const values = asArray(value);
  if (values.length > MAX_REBUILD_SIGNALS_PER_SECTION) {
    throw new TypeError('Library rebuild signal collections must remain within the configured bound.');
  }

  const byKey = new Map();
  values
    .map(normalizeSignal)
    .filter(Boolean)
    .forEach(signal => byKey.set(signal.key, signal));

  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function normalizeLibrary(value) {
  const library = asPlainObject(value);
  const libraryId = normalizePositiveInteger(getDataProperty(library, 'libraryId'));

  if (libraryId === null) {
    throw new TypeError('Library rebuild input requires a positive library ID.');
  }

  return {
    libraryId,
    libraryName: normalizeString(
      getDataProperty(library, 'libraryName') ?? getDataProperty(library, 'name')
    ) || null,
    mediaType: normalizeString(getDataProperty(library, 'mediaType')) || null,
  };
}

function normalizeExistingConstraints(value) {
  const constraints = asPlainObject(value);

  return {
    hardLimits: normalizeSignals(getDataProperty(constraints, 'hardLimits')),
    avoid: normalizeSignals(getDataProperty(constraints, 'avoid')),
    askWhen: normalizeSignals(getDataProperty(constraints, 'askWhen')),
  };
}

function normalizeOperatorIntent(value) {
  const intent = asPlainObject(value);

  return {
    belongsHere: normalizeSignals(getDataProperty(intent, 'belongsHere')),
    helpfulMatches: normalizeSignals(getDataProperty(intent, 'helpfulMatches')),
  };
}

function normalizeRoutingConfiguration(value) {
  const routing = asPlainObject(value);
  const targetName = normalizeString(
    getDataProperty(routing, 'targetName') ??
    getDataProperty(routing, 'libraryName') ??
    getDataProperty(routing, 'arrRootFolderPath') ??
    getDataProperty(routing, 'rootFolderPath')
  );
  const configured = getDataProperty(routing, 'configured') === true || Boolean(targetName);

  return {
    configured,
    routeReady: getDataProperty(routing, 'routeReady') !== false && configured,
    targetName: targetName || null,
    arrType: normalizeString(
      getDataProperty(routing, 'arrType') ?? getDataProperty(routing, 'arr_type')
    ) || null,
    arrConfigId: normalizePositiveInteger(
      getDataProperty(routing, 'arrConfigId') ?? getDataProperty(routing, 'arr_config_id')
    ),
    arrRootFolderPath: normalizeString(
      getDataProperty(routing, 'arrRootFolderPath') ??
      getDataProperty(routing, 'arr_root_folder_path') ??
      getDataProperty(routing, 'rootFolderPath')
    ) || null,
  };
}

function normalizeProfileFreshness(value) {
  const freshness = asPlainObject(value);

  return {
    stale: getDataProperty(freshness, 'stale') === true,
    refreshedAt: normalizeTimestamp(
      getDataProperty(freshness, 'refreshedAt') ?? getDataProperty(freshness, 'updatedAt')
    ),
    reasonCode: normalizeString(getDataProperty(freshness, 'reasonCode')) || null,
  };
}

function normalizeLibraryProfile(value) {
  const profile = asPlainObject(value);

  return {
    identityCandidates: normalizeSignals(getDataProperty(profile, 'identityCandidates')),
    compatibilityCandidates: normalizeSignals(getDataProperty(profile, 'compatibilityCandidates')),
    outliers: normalizeSignals(getDataProperty(profile, 'outliers')),
  };
}

function normalizeEvidenceFingerprint(value = {}) {
  const fingerprint = asPlainObject(value);
  const provenance = asPlainObject(getDataProperty(fingerprint, 'provenance'));
  const normalizedFingerprint = normalizeString(getDataProperty(fingerprint, 'fingerprint')).toLowerCase();

  if (!normalizedFingerprint) return null;

  return {
    algorithm: normalizeString(getDataProperty(fingerprint, 'algorithm')).toLowerCase() || null,
    fingerprint: normalizedFingerprint,
    provenance: {
      projectionVersion: normalizeString(getDataProperty(provenance, 'projectionVersion')) || null,
      evidenceVersion: normalizeString(getDataProperty(provenance, 'evidenceVersion')) || null,
      totalEntryCount: normalizeCount(getDataProperty(provenance, 'totalEntryCount')) || 0,
      sourceIds: normalizeSignals(getDataProperty(provenance, 'sourceIds')).map(signal => signal.label),
      runtimeSourceIds: normalizeSignals(getDataProperty(provenance, 'runtimeSourceIds')).map(signal => signal.label),
      authoritySourceIds: normalizeSignals(getDataProperty(provenance, 'authoritySourceIds')).map(signal => signal.label),
      demotionReasonIds: normalizeSignals(getDataProperty(provenance, 'demotionReasonIds')).map(signal => signal.label),
      warningReasonIds: normalizeSignals(getDataProperty(provenance, 'warningReasonIds')).map(signal => signal.label),
    },
  };
}

function mapGuardedOutcomeSignal(outcome = {}, reasonCode) {
  const projectedOutcome = asPlainObject(outcome);
  const learning = asPlainObject(getDataProperty(projectedOutcome, 'learning'));
  const candidate = asPlainObject(getDataProperty(learning, 'candidate'));
  const finalOutcome = asPlainObject(getDataProperty(projectedOutcome, 'finalOutcome'));
  const label = normalizeString(
    getDataProperty(candidate, 'label') ?? getDataProperty(finalOutcome, 'destinationLibraryName')
  );

  if (!label) return null;

  return {
    key: normalizeString(getDataProperty(candidate, 'key')) || label,
    label,
    value: null,
    count: normalizeCount(getDataProperty(candidate, 'evidenceCount')) ?? 1,
    confidence: null,
    reasonCode,
    observedAt: null,
    stale: false,
    learningDecisionId: normalizeString(getDataProperty(learning, 'decisionId')) || null,
    canWriteLearning: getDataProperty(learning, 'canWriteLearning') === true,
  };
}

function collectGuardedOutcomeEvidence(guardedOutcomeProjection = {}) {
  const projection = asPlainObject(guardedOutcomeProjection);
  const outcomes = asArray(getDataProperty(projection, 'outcomes'));
  const projectionSummary = asPlainObject(getDataProperty(projection, 'summary'));
  const compatibilityCandidates = [];
  const outliers = [];
  const outcomeSummaries = [];

  if (outcomes.length > MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS) {
    throw new TypeError('Guarded outcome evidence exceeds the configured rebuild bound.');
  }

  outcomes.forEach((outcome, index) => {
    const projectedOutcome = asPlainObject(outcome);
    const learning = asPlainObject(getDataProperty(projectedOutcome, 'learning'));
    const finalOutcome = asPlainObject(getDataProperty(projectedOutcome, 'finalOutcome'));
    const evidenceFingerprint = normalizeEvidenceFingerprint(
      getDataProperty(projectedOutcome, 'evidenceFingerprint')
    );
    const hasFingerprint = SHA256_FINGERPRINT_PATTERN.test(evidenceFingerprint?.fingerprint || '') &&
      evidenceFingerprint?.algorithm === 'sha256';
    const requestProofFingerprint = normalizeString(
      getDataProperty(projectedOutcome, 'requestProofFingerprint')
    ).toLowerCase();
    const summary = {
      outcomeIndex: index,
      accepted: false,
      fingerprint: hasFingerprint ? evidenceFingerprint.fingerprint : null,
      algorithm: hasFingerprint ? evidenceFingerprint.algorithm : null,
      requestProofValid: requestProofFingerprint === evidenceFingerprint?.fingerprint,
      requestProofIssueCount: requestProofFingerprint === evidenceFingerprint?.fingerprint ? 0 : 1,
      requestProofFingerprint,
      learningDecisionId: normalizeString(getDataProperty(learning, 'decisionId')) || null,
      finalOutcomeRecorded: getDataProperty(finalOutcome, 'recorded') === true,
      finalOutcomeStatus: normalizeString(getDataProperty(finalOutcome, 'status')) || null,
    };

    if (!hasFingerprint || requestProofFingerprint !== evidenceFingerprint.fingerprint) {
      outcomeSummaries.push(summary);
      return;
    }

    const learningDecisionId = normalizeString(getDataProperty(learning, 'decisionId'));
    const finalOutcomeStatus = normalizeString(getDataProperty(finalOutcome, 'status'));
    const requiresReview = learningDecisionId === POLICY_LEARNING_DECISION_IDS.BLOCKED ||
      finalOutcomeStatus === 'route_failed_missing_mapping';
    const reasonCode = requiresReview
      ? 'guarded_outcome_requires_review'
      : 'guarded_outcome_compatibility';
    const signal = mapGuardedOutcomeSignal(projectedOutcome, reasonCode);

    if (signal && (
      requiresReview ||
      getDataProperty(learning, 'canWriteLearning') === true ||
      learningDecisionId === POLICY_LEARNING_DECISION_IDS.CANDIDATE ||
      getDataProperty(finalOutcome, 'recorded') === true
    )) {
      summary.accepted = true;
      (requiresReview ? outliers : compatibilityCandidates).push(signal);
    }

    outcomeSummaries.push(summary);
  });

  const fingerprints = [...new Set(
    outcomeSummaries
      .filter(outcome => outcome.accepted && outcome.fingerprint)
      .map(outcome => outcome.fingerprint)
  )].sort();

  return {
    compatibilityCandidates: normalizeSignals(compatibilityCandidates),
    outliers: normalizeSignals(outliers),
    summary: {
      count: normalizeCount(getDataProperty(projectionSummary, 'decisionCount')) ?? outcomeSummaries.length,
      acceptedCount: outcomeSummaries.filter(outcome => outcome.accepted).length,
      rejectedCount: normalizeCount(getDataProperty(projectionSummary, 'rejectedCount')) || 0,
      missingFingerprintCount: normalizeCount(getDataProperty(projectionSummary, 'missingFingerprintCount')) || 0,
      requestProofCount: normalizeCount(getDataProperty(projectionSummary, 'requestProofCount')) || 0,
      missingRequestProofCount: normalizeCount(getDataProperty(projectionSummary, 'missingRequestProofCount')) || 0,
      invalidRequestProofCount: normalizeCount(getDataProperty(projectionSummary, 'invalidRequestProofCount')) || 0,
      fingerprintCount: fingerprints.length,
      fingerprints: fingerprints.slice(0, MAX_REBUILD_FINGERPRINTS),
      fingerprintListTruncated: fingerprints.length > MAX_REBUILD_FINGERPRINTS,
      outcomes: outcomeSummaries,
    },
  };
}

function requireProfileHandoff(value, library) {
  if (!isPlainDataRecord(value)) {
    throw new TypeError('Library rebuild input requires a cached profile handoff.');
  }

  const handoff = value;
  if (getDataProperty(handoff, 'version') !== POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_VERSION ||
      getDataProperty(handoff, 'ok') !== true ||
      normalizePositiveInteger(getDataProperty(handoff, 'libraryId')) !== library.libraryId) {
    throw new TypeError('Library rebuild input requires a successful profile handoff for the selected library.');
  }

  const handoffAudit = buildPolicyLibraryProfileEvidenceLoaderAudit(handoff);
  const profileEvidence = getDataProperty(handoff, 'profileEvidence');
  const profileEvidenceAudit = buildPolicyLibraryProfileEvidenceAudit(profileEvidence);

  if (!handoffAudit.ok || !profileEvidenceAudit.ok ||
      getDataProperty(asPlainObject(profileEvidence), 'version') !== POLICY_LIBRARY_PROFILE_EVIDENCE_VERSION) {
    throw new TypeError('Library rebuild input requires verified bounded library profile evidence.');
  }

  return {
    libraryProfile: normalizeLibraryProfile(
      getDataProperty(asPlainObject(profileEvidence), 'libraryProfile')
    ),
    profileFreshness: normalizeProfileFreshness(getDataProperty(handoff, 'profileFreshness')),
    sourceSummary: {
      version: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_VERSION,
      libraryId: library.libraryId,
      statusId: normalizeString(getDataProperty(handoff, 'statusId')) || null,
      profileEvidenceVersion: POLICY_LIBRARY_PROFILE_EVIDENCE_VERSION,
      stale: getDataProperty(asPlainObject(getDataProperty(handoff, 'profileFreshness')), 'stale') === true,
    },
  };
}

function requireValidGuardedOutcomeProjection(value) {
  const projection = asPlainObject(value);
  if (getDataProperty(projection, 'version') !== POLICY_GUARDED_OUTCOME_PROJECTION_VERSION) {
    throw new TypeError('Library rebuild input requires a policy.guarded_outcome_projection.v1 projection.');
  }

  const validation = validatePolicyGuardedOutcomeProjection(projection);
  if (!validation.ok) {
    throw new TypeError('Library rebuild input requires a valid guarded-outcome projection.');
  }

  const outcomes = asArray(getDataProperty(projection, 'outcomes'));
  const rejections = asArray(getDataProperty(projection, 'rejections'));
  if (outcomes.length + rejections.length > MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS) {
    throw new TypeError('Library rebuild guarded outcomes exceed the configured collection bound.');
  }

  return projection;
}

function buildContract({
  library,
  profileHandoff,
  operatorIntent,
  existingConstraints,
  routingConfiguration,
  guardedOutcomeProjection,
} = {}) {
  const normalizedLibrary = normalizeLibrary(library);
  const profile = requireProfileHandoff(profileHandoff, normalizedLibrary);
  const projection = requireValidGuardedOutcomeProjection(guardedOutcomeProjection);
  const normalizedOperatorIntent = normalizeOperatorIntent(operatorIntent);
  const normalizedConstraints = normalizeExistingConstraints(existingConstraints);
  const routing = normalizeRoutingConfiguration(routingConfiguration);
  const guardedOutcomeEvidence = collectGuardedOutcomeEvidence(projection);
  const routingSignals = routing.targetName
    ? [{
      key: routing.arrRootFolderPath || routing.targetName,
      label: routing.targetName,
      value: routing.arrRootFolderPath || routing.targetName,
      count: null,
      confidence: null,
      reasonCode: 'routing_configuration_consumed',
      observedAt: null,
      stale: false,
    }]
    : [];
  const freshnessOutliers = profile.profileFreshness.stale
    ? [{
      key: 'profile_freshness',
      label: 'Profile freshness',
      value: 'stale',
      count: null,
      confidence: null,
      reasonCode: 'stale_profile',
      observedAt: profile.profileFreshness.refreshedAt,
      stale: true,
    }]
    : [];
  const observedAbsences = profile.libraryProfile.outliers.filter(signal =>
    signal.reasonCode === 'observed_absence_requires_review'
  );
  const evidenceInput = {
    libraryProfile: {
      identityCandidates: profile.libraryProfile.identityCandidates,
      compatibilityCandidates: normalizeSignals([
        ...profile.libraryProfile.compatibilityCandidates,
        ...guardedOutcomeEvidence.compatibilityCandidates,
      ]),
      outliers: normalizeSignals([
        ...profile.libraryProfile.outliers,
        ...guardedOutcomeEvidence.outliers,
        ...freshnessOutliers,
      ]),
    },
    operatorIntent: {
      belongsHere: normalizedOperatorIntent.belongsHere,
      helpfulMatches: normalizedOperatorIntent.helpfulMatches,
      hardLimits: normalizedConstraints.hardLimits,
      avoid: normalizedConstraints.avoid,
      askWhen: normalizedConstraints.askWhen,
      routingTargets: routingSignals,
    },
    routing,
    profileFreshness: profile.profileFreshness,
    observedAbsences,
    existingConstraints: normalizedConstraints,
    guardedOutcomeCount: guardedOutcomeEvidence.summary.count,
    guardedOutcomeEvidenceSummary: guardedOutcomeEvidence.summary,
  };

  return {
    version: POLICY_LIBRARY_REBUILD_INPUT_CONTRACT_VERSION,
    statusId: POLICY_LIBRARY_REBUILD_INPUT_STATUS_IDS.READY,
    ok: true,
    library: normalizedLibrary,
    libraryProfile: profile.libraryProfile,
    profileFreshness: profile.profileFreshness,
    operatorIntent: normalizedOperatorIntent,
    existingConstraints: normalizedConstraints,
    routingConfiguration: routing,
    observedAbsences,
    guardedOutcomeProjection: projection,
    evidenceInput,
    evidenceEnvelope: {
      libraryProfile: evidenceInput.libraryProfile,
      operatorIntent: evidenceInput.operatorIntent,
      profileFreshness: evidenceInput.profileFreshness,
    },
    sourceSummary: {
      profile: profile.sourceSummary,
      guardedOutcomes: {
        version: POLICY_GUARDED_OUTCOME_PROJECTION_VERSION,
        count: guardedOutcomeEvidence.summary.count,
        acceptedCount: guardedOutcomeEvidence.summary.acceptedCount,
        rejectedCount: guardedOutcomeEvidence.summary.rejectedCount,
        ignoredCount: Math.max(
          0,
          guardedOutcomeEvidence.summary.count -
            guardedOutcomeEvidence.summary.acceptedCount -
            guardedOutcomeEvidence.summary.rejectedCount
        ),
        fingerprintCount: guardedOutcomeEvidence.summary.fingerprintCount,
        requestProofCount: guardedOutcomeEvidence.summary.requestProofCount,
      },
    },
    sideEffects: {
      libraryProfileRead: false,
      liveMediaServerLookupPerformed: false,
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      policyStorageMutated: false,
    },
  };
}

function buildPolicyLibraryRebuildInputFromGuardedOutcomeProjection(input = {}) {
  requireSupportedInput(input, PROJECTION_INPUT_KEYS);

  return buildContract({
    library: getDataProperty(input, 'library'),
    profileHandoff: getDataProperty(input, 'profileHandoff'),
    operatorIntent: getDataProperty(input, 'operatorIntent'),
    existingConstraints: getDataProperty(input, 'existingConstraints'),
    routingConfiguration: getDataProperty(input, 'routingConfiguration'),
    guardedOutcomeProjection: getDataProperty(input, 'guardedOutcomeProjection'),
  });
}

function buildPolicyLibraryRebuildInputFromRuntimeInput(input = {}) {
  requireSupportedInput(input, RUNTIME_INPUT_KEYS);

  const guardedOutcomes = getDataProperty(input, 'guardedOutcomes');
  if (asArray(guardedOutcomes).length > MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS) {
    throw new TypeError('Library rebuild guarded outcomes exceed the configured collection bound.');
  }

  const guardedOutcomeProjection = buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions({
    requestTimeDecisions: guardedOutcomes,
  });

  return buildContract({
    library: getDataProperty(input, 'library'),
    profileHandoff: getDataProperty(input, 'profileHandoff'),
    operatorIntent: getDataProperty(input, 'operatorIntent'),
    existingConstraints: getDataProperty(input, 'existingConstraints'),
    routingConfiguration: getDataProperty(input, 'routingConfiguration'),
    guardedOutcomeProjection,
  });
}

function buildPolicyLibraryRebuildInputSummary(contract = {}) {
  const source = asPlainObject(contract);
  const library = asPlainObject(getDataProperty(source, 'library'));
  const sourceSummary = asPlainObject(getDataProperty(source, 'sourceSummary'));
  const profile = asPlainObject(getDataProperty(sourceSummary, 'profile'));
  const guardedOutcomes = asPlainObject(getDataProperty(sourceSummary, 'guardedOutcomes'));

  return {
    version: normalizeString(getDataProperty(source, 'version')) || null,
    statusId: normalizeString(getDataProperty(source, 'statusId')) || null,
    ok: getDataProperty(source, 'ok') === true,
    libraryId: normalizePositiveInteger(getDataProperty(library, 'libraryId')),
    profile: {
      version: normalizeString(getDataProperty(profile, 'version')) || null,
      libraryId: normalizePositiveInteger(getDataProperty(profile, 'libraryId')),
      statusId: normalizeString(getDataProperty(profile, 'statusId')) || null,
      stale: getDataProperty(profile, 'stale') === true,
    },
    guardedOutcomes: {
      version: normalizeString(getDataProperty(guardedOutcomes, 'version')) || null,
      count: normalizeCount(getDataProperty(guardedOutcomes, 'count')) || 0,
      acceptedCount: normalizeCount(getDataProperty(guardedOutcomes, 'acceptedCount')) || 0,
      rejectedCount: normalizeCount(getDataProperty(guardedOutcomes, 'rejectedCount')) || 0,
      ignoredCount: normalizeCount(getDataProperty(guardedOutcomes, 'ignoredCount')) || 0,
      fingerprintCount: normalizeCount(getDataProperty(guardedOutcomes, 'fingerprintCount')) || 0,
      requestProofCount: normalizeCount(getDataProperty(guardedOutcomes, 'requestProofCount')) || 0,
    },
  };
}

function validatePolicyLibraryRebuildInputContract(contract = {}) {
  const issues = [];
  const source = asPlainObject(contract);
  const summary = buildPolicyLibraryRebuildInputSummary(source);
  const evidenceInput = asPlainObject(getDataProperty(source, 'evidenceInput'));
  const sideEffects = asPlainObject(getDataProperty(source, 'sideEffects'));
  const guardedOutcomeProjection = asPlainObject(
    getDataProperty(source, 'guardedOutcomeProjection')
  );

  if (summary.version !== POLICY_LIBRARY_REBUILD_INPUT_CONTRACT_VERSION ||
      summary.statusId !== POLICY_LIBRARY_REBUILD_INPUT_STATUS_IDS.READY ||
      summary.ok !== true ||
      summary.libraryId === null) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS.INVALID_CONTRACT,
      message: 'Library rebuild input must use the ready rebuild-input contract.',
    });
  }

  if (summary.profile.version !== POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_VERSION ||
      summary.profile.libraryId !== summary.libraryId ||
      !summary.profile.statusId) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS.INVALID_PROFILE_HANDOFF,
      message: 'Library rebuild input must retain a matching verified profile-handoff summary.',
    });
  }

  if (summary.guardedOutcomes.version !== POLICY_GUARDED_OUTCOME_PROJECTION_VERSION ||
      summary.guardedOutcomes.count !== summary.guardedOutcomes.acceptedCount +
        summary.guardedOutcomes.rejectedCount +
        summary.guardedOutcomes.ignoredCount ||
      summary.guardedOutcomes.fingerprintCount > summary.guardedOutcomes.acceptedCount ||
      summary.guardedOutcomes.requestProofCount > summary.guardedOutcomes.acceptedCount) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS.SOURCE_SUMMARY_MISMATCH,
      message: 'Library rebuild guarded-outcome summary must match the bounded projection contract.',
    });
  }

  const guardedProjectionValidation = validatePolicyGuardedOutcomeProjection(
    guardedOutcomeProjection
  );
  if (!guardedProjectionValidation.ok) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS.INVALID_GUARDED_OUTCOME_PROJECTION,
      message: 'Library rebuild input must retain a valid guarded-outcome projection.',
    });
  } else {
    const guardedOutcomeEvidence = collectGuardedOutcomeEvidence(guardedOutcomeProjection);
    const expectedSummary = guardedOutcomeEvidence.summary;
    const expectedIgnoredCount = Math.max(
      0,
      expectedSummary.count - expectedSummary.acceptedCount - expectedSummary.rejectedCount
    );

    if (
      summary.guardedOutcomes.count !== expectedSummary.count ||
      summary.guardedOutcomes.acceptedCount !== expectedSummary.acceptedCount ||
      summary.guardedOutcomes.rejectedCount !== expectedSummary.rejectedCount ||
      summary.guardedOutcomes.ignoredCount !== expectedIgnoredCount ||
      summary.guardedOutcomes.fingerprintCount !== expectedSummary.fingerprintCount ||
      summary.guardedOutcomes.requestProofCount !== expectedSummary.requestProofCount
    ) {
      issues.push({
        riskId: POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS.SOURCE_SUMMARY_MISMATCH,
        message: 'Library rebuild guarded-outcome summary must match the validated projection evidence.',
      });
    }
  }

  if (!isPlainDataRecord(evidenceInput) ||
      !isPlainDataRecord(getDataProperty(evidenceInput, 'libraryProfile')) ||
      !isPlainDataRecord(getDataProperty(evidenceInput, 'operatorIntent')) ||
      !isPlainDataRecord(getDataProperty(evidenceInput, 'routing')) ||
      !isPlainDataRecord(getDataProperty(evidenceInput, 'profileFreshness'))) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS.INVALID_CONTRACT,
      message: 'Library rebuild input must retain the bounded evidence envelope inputs.',
    });
  }

  [
    'libraryProfileRead',
    'liveMediaServerLookupPerformed',
    'liveProviderLookupPerformed',
    'providerQuotaRead',
    'policyStorageMutated',
  ].forEach(sideEffectId => {
    if (getDataProperty(sideEffects, sideEffectId) !== false) {
      issues.push({
        riskId: POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Library rebuild input composition must remain side-effect-free.',
        sideEffectId,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  MAX_REBUILD_SIGNALS_PER_SECTION,
  POLICY_LIBRARY_REBUILD_INPUT_CONTRACT_VERSION,
  POLICY_LIBRARY_REBUILD_INPUT_RISK_IDS,
  POLICY_LIBRARY_REBUILD_INPUT_STATUS_IDS,
  buildPolicyLibraryRebuildInputFromGuardedOutcomeProjection,
  buildPolicyLibraryRebuildInputFromRuntimeInput,
  buildPolicyLibraryRebuildInputSummary,
  validatePolicyLibraryRebuildInputContract,
};
