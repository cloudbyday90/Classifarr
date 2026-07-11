import { libraryProfileService } from './libraryProfileService.mjs';
import {
  buildPolicyLibraryProfileEvidence,
  buildPolicyLibraryProfileEvidenceAudit,
} from './policyLibraryProfileEvidence.mjs';
import {
  buildBoundedPolicyEvidenceProjection,
  buildPolicyEvidenceBoundaryAudit,
} from './policyEvidenceBoundary.mjs';

const POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_VERSION = 'policy.library_profile_evidence_loader.v1';
const POLICY_LIBRARY_PROFILE_FRESHNESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS = Object.freeze({
  READY: 'ready',
  READY_WITH_STALE_PROFILE: 'ready_with_stale_profile',
  INVALID_LIBRARY_ID: 'invalid_library_id',
  PROFILE_NOT_FOUND: 'profile_not_found',
  PROFILE_LOAD_FAILED: 'profile_load_failed',
  INVALID_PROFILE_EVIDENCE: 'invalid_profile_evidence',
  EVIDENCE_BOUNDARY_BLOCKED: 'evidence_boundary_blocked',
});

const POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS = Object.freeze({
  INVALID_LIBRARY_ID: 'invalid_library_id',
  PROFILE_NOT_FOUND: 'profile_not_found',
  PROFILE_LOAD_FAILED: 'profile_load_failed',
  INVALID_PROFILE_EVIDENCE: 'invalid_profile_evidence',
  EVIDENCE_BOUNDARY_BLOCKED: 'evidence_boundary_blocked',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  READY_WITHOUT_PROFILE_EVIDENCE_AUDIT: 'ready_without_profile_evidence_audit',
  READY_WITHOUT_BOUNDARY_AUDIT: 'ready_without_boundary_audit',
});

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeLibraryId(value) {
  const libraryId = Number(value);
  return Number.isInteger(libraryId) && libraryId > 0 ? libraryId : null;
}

function normalizeTimestamp(value) {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function resolveProfileTimestamp(profile = {}) {
  return normalizeTimestamp(profile.last_generated_at ?? profile.lastGeneratedAt) ||
    normalizeTimestamp(profile.updated_at ?? profile.updatedAt);
}

function normalizeMaximumAgeMs(value) {
  const maximumAgeMs = Number(value);
  return Number.isFinite(maximumAgeMs) && maximumAgeMs > 0
    ? Math.floor(maximumAgeMs)
    : POLICY_LIBRARY_PROFILE_FRESHNESS_MAX_AGE_MS;
}

function buildPolicyLibraryProfileFreshness({
  profile = {},
  now = Date.now(),
  maximumAgeMs = POLICY_LIBRARY_PROFILE_FRESHNESS_MAX_AGE_MS,
} = {}) {
  const updatedAt = resolveProfileTimestamp(asPlainObject(profile));
  const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const maximumAge = normalizeMaximumAgeMs(maximumAgeMs);
  const ageMs = updatedAt === null ? null : Math.max(0, currentTime - Date.parse(updatedAt));
  const stale = updatedAt === null || ageMs > maximumAge;

  return {
    key: 'library_profile',
    label: 'Library profile',
    value: stale ? 'review_required' : 'current',
    stale,
    updatedAt,
    ageMs,
    maximumAgeMs: maximumAge,
    reasonCode: updatedAt === null
      ? 'missing_profile_timestamp'
      : stale
        ? 'stale_profile_timestamp'
        : 'current_profile_timestamp',
  };
}

function buildSideEffects({ libraryProfileRead = false, evidenceProjectionBuilt = false } = {}) {
  return {
    libraryProfileRead,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    evidenceProjectionBuilt,
    policyStorageMutated: false,
  };
}

function buildLoaderResult({
  libraryId = null,
  statusId,
  ok,
  issue = null,
  profileEvidence = null,
  profileEvidenceAudit = null,
  profileFreshness = null,
  evidenceBoundary = null,
  evidenceBoundaryAudit = null,
  libraryProfileRead = false,
} = {}) {
  const issues = issue ? [issue] : [];

  return {
    version: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_VERSION,
    ok,
    statusId,
    libraryId,
    issueCount: issues.length,
    issues,
    profileEvidence,
    profileEvidenceAudit,
    profileFreshness,
    evidenceBoundary,
    evidenceBoundaryAudit,
    sideEffects: buildSideEffects({
      libraryProfileRead,
      evidenceProjectionBuilt: evidenceBoundary?.sideEffects?.evidenceProjectionBuilt === true,
    }),
  };
}

async function loadPolicyLibraryProfileEvidence({
  libraryId,
  getProfile = libraryProfileService.getProfile.bind(libraryProfileService),
  now = Date.now(),
  maximumAgeMs = POLICY_LIBRARY_PROFILE_FRESHNESS_MAX_AGE_MS,
} = {}) {
  const normalizedLibraryId = normalizeLibraryId(libraryId);
  if (normalizedLibraryId === null) {
    return buildLoaderResult({
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.INVALID_LIBRARY_ID,
      ok: false,
      issue: {
        riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.INVALID_LIBRARY_ID,
        message: 'Library profile evidence requires a positive integer library ID.',
      },
    });
  }

  const profileReader = typeof getProfile === 'function' ? getProfile : null;
  if (!profileReader) {
    return buildLoaderResult({
      libraryId: normalizedLibraryId,
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.PROFILE_LOAD_FAILED,
      ok: false,
      issue: {
        riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.PROFILE_LOAD_FAILED,
        message: 'Stored library profile could not be loaded.',
      },
    });
  }

  let profile;
  try {
    profile = await profileReader(normalizedLibraryId);
  } catch {
    return buildLoaderResult({
      libraryId: normalizedLibraryId,
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.PROFILE_LOAD_FAILED,
      ok: false,
      issue: {
        riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.PROFILE_LOAD_FAILED,
        message: 'Stored library profile could not be loaded.',
      },
    });
  }

  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return buildLoaderResult({
      libraryId: normalizedLibraryId,
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.PROFILE_NOT_FOUND,
      ok: false,
      issue: {
        riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.PROFILE_NOT_FOUND,
        message: 'A persisted library profile is required before library-derived evidence can be used.',
      },
      libraryProfileRead: true,
    });
  }

  const profileEvidence = buildPolicyLibraryProfileEvidence(profile);
  const profileEvidenceAudit = buildPolicyLibraryProfileEvidenceAudit(profileEvidence);
  const profileFreshness = buildPolicyLibraryProfileFreshness({
    profile,
    now,
    maximumAgeMs,
  });

  if (!profileEvidenceAudit.ok) {
    return buildLoaderResult({
      libraryId: normalizedLibraryId,
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.INVALID_PROFILE_EVIDENCE,
      ok: false,
      issue: {
        riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.INVALID_PROFILE_EVIDENCE,
        message: 'Stored library profile did not produce a safe bounded evidence result.',
      },
      profileEvidence,
      profileEvidenceAudit,
      profileFreshness,
      libraryProfileRead: true,
    });
  }

  const evidenceBoundary = buildBoundedPolicyEvidenceProjection({
    evidenceInput: {
      libraryProfile: profileEvidence.libraryProfile,
      profileFreshness,
    },
  });
  const boundaryAudit = buildPolicyEvidenceBoundaryAudit(evidenceBoundary);

  if (!evidenceBoundary.ok || !boundaryAudit.ok) {
    return buildLoaderResult({
      libraryId: normalizedLibraryId,
      statusId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.EVIDENCE_BOUNDARY_BLOCKED,
      ok: false,
      issue: {
        riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.EVIDENCE_BOUNDARY_BLOCKED,
        message: 'Bounded library profile evidence did not pass the policy evidence boundary.',
      },
      profileEvidence,
      profileFreshness,
      evidenceBoundary,
      evidenceBoundaryAudit: boundaryAudit,
      libraryProfileRead: true,
    });
  }

  return buildLoaderResult({
    libraryId: normalizedLibraryId,
    statusId: profileFreshness.stale
      ? POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.READY_WITH_STALE_PROFILE
      : POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.READY,
    ok: true,
    profileEvidence,
    profileEvidenceAudit,
    profileFreshness,
    evidenceBoundary,
    evidenceBoundaryAudit: boundaryAudit,
    libraryProfileRead: true,
  });
}

function buildPolicyLibraryProfileEvidenceLoaderAudit(result = {}) {
  const issues = [];
  const statusId = result.statusId || null;
  const readyStatuses = new Set([
    POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.READY,
    POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.READY_WITH_STALE_PROFILE,
  ]);
  const sideEffects = asPlainObject(result.sideEffects);

  if (result.ok === true && !readyStatuses.has(statusId)) {
    issues.push({
      riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.INVALID_PROFILE_EVIDENCE,
      message: 'Ready library profile evidence must use a ready status.',
    });
  }

  if (result.ok === true && result.profileEvidenceAudit?.ok !== true) {
    issues.push({
      riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.READY_WITHOUT_PROFILE_EVIDENCE_AUDIT,
      message: 'Ready library profile evidence must include a successful profile-evidence audit.',
    });
  }

  if (result.ok === true && (
    result.evidenceBoundary?.ok !== true ||
    result.evidenceBoundaryAudit?.ok !== true
  )) {
    issues.push({
      riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.READY_WITHOUT_BOUNDARY_AUDIT,
      message: 'Ready library profile evidence must include a successful evidence boundary result.',
    });
  }

  if (result.ok === true && result.statusId === POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS.READY &&
      result.profileFreshness?.stale === true) {
    issues.push({
      riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.READY_WITHOUT_BOUNDARY_AUDIT,
      message: 'A stale profile cannot be reported as fully current evidence.',
    });
  }

  [
    'liveMediaServerLookupPerformed',
    'liveProviderLookupPerformed',
    'providerQuotaRead',
    'policyStorageMutated',
  ].forEach(sideEffectId => {
    if (sideEffects[sideEffectId] === true) {
      issues.push({
        riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Library profile evidence loading must not perform live lookups, quota reads, or storage writes.',
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
  POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_RISK_IDS,
  POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_STATUS_IDS,
  POLICY_LIBRARY_PROFILE_EVIDENCE_LOADER_VERSION,
  POLICY_LIBRARY_PROFILE_FRESHNESS_MAX_AGE_MS,
  buildPolicyLibraryProfileEvidenceLoaderAudit,
  buildPolicyLibraryProfileFreshness,
  loadPolicyLibraryProfileEvidence,
};
