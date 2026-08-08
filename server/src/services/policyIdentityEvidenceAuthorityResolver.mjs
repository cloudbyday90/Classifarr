/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';
import {
  normalizePolicyEvidenceEntry,
} from './policyEvidenceEntryNormalizer.mjs';
import {
  POLICY_EVIDENCE_SOURCE_IDS,
} from './policyEvidenceEngine.mjs';
import {
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';
import {
  policyIdentityEvidenceAuthorityRepository,
} from './policyIdentityEvidenceAuthorityRepository.mjs';

const POLICY_IDENTITY_EVIDENCE_AUTHORITY_VERSION =
  'policy.identity_evidence_authority.v1';

const POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS = Object.freeze({
  VERIFIED: 'verified',
  UNAVAILABLE: 'unavailable',
  AMBIGUOUS: 'ambiguous',
  INVALID_CANDIDATE: 'invalid_candidate',
});

const POLICY_IDENTITY_EVIDENCE_AUTHORITY_REASON_IDS = Object.freeze({
  INVALID_CANDIDATE: 'identity_authority_invalid_candidate',
  NO_INDEPENDENT_AUTHORITY: 'identity_authority_not_independently_verified',
  AMBIGUOUS_DECLARED_AUTHORITY: 'identity_authority_ambiguous_declared_intent',
  INVALID_OBSERVED_AUTHORITY: 'identity_authority_invalid_observed_projection',
});

const IDENTITY_SIGNAL_CONFIGURATIONS = Object.freeze([
  Object.freeze({
    nativeSignalType: 'genres',
    signalTypeIds: Object.freeze(['genre', 'genres']),
    keyPrefixes: Object.freeze(['genre', 'genres']),
  }),
  Object.freeze({
    nativeSignalType: 'keywords',
    signalTypeIds: Object.freeze(['keyword', 'keywords']),
    keyPrefixes: Object.freeze(['keyword', 'keywords']),
  }),
  Object.freeze({
    nativeSignalType: 'studios',
    signalTypeIds: Object.freeze(['studio', 'studios']),
    keyPrefixes: Object.freeze(['studio', 'studios']),
  }),
  Object.freeze({
    nativeSignalType: 'media_type',
    signalTypeIds: Object.freeze(['media_type', 'media-type']),
    keyPrefixes: Object.freeze(['media_type', 'media-type']),
  }),
]);

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

const IDENTITY_OPERATOR_VALUE_KEY_BY_ID = Object.freeze({
  require_all: 'require_all',
  require_any: 'require_any',
  prefer: 'prefer',
  include: 'include',
});

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getIdentitySignalConfiguration(signalType) {
  const normalizedSignalType = normalizeString(signalType, 80).toLowerCase();

  return IDENTITY_SIGNAL_CONFIGURATIONS.find(configuration =>
    configuration.signalTypeIds.includes(normalizedSignalType)
  ) || null;
}

function buildIdentityCandidate({ evidenceKey, signalType } = {}) {
  const configuration = getIdentitySignalConfiguration(signalType);
  const key = normalizeString(evidenceKey, 160);
  const normalizedEntry = normalizePolicyEvidenceEntry({
    key,
    label: key,
  });
  const [prefix, ...valueParts] = normalizedEntry?.key?.split(':') || [];
  const value = valueParts.join(':');

  if (!configuration || !normalizedEntry || key !== normalizedEntry.key ||
      !configuration.keyPrefixes.includes(prefix) || !value) {
    return null;
  }

  return {
    evidenceKey: normalizedEntry.key,
    value,
    nativeSignalType: configuration.nativeSignalType,
    signalType: normalizeString(signalType, 80).toLowerCase(),
  };
}

function listAffirmativeRuleValues(rule = {}) {
  const values = parseJsonObject(rule.values);
  const valueKey = IDENTITY_OPERATOR_VALUE_KEY_BY_ID[
    normalizeString(rule.operator, 50).toLowerCase()
  ];

  return (Array.isArray(values[valueKey]) ? values[valueKey] : [])
    .map(value => normalizeString(value, 120))
    .filter(Boolean);
}

function ruleMatchesCandidate(rule = {}, candidate = {}) {
  return listAffirmativeRuleValues(rule).some(value => {
    const normalizedEntry = normalizePolicyEvidenceEntry({
      key: `${candidate.evidenceKey.split(':', 1)[0]}:${value}`,
      label: value,
    });

    return normalizedEntry?.key === candidate.evidenceKey;
  });
}

function buildAuthorityResult({ statusId, reasonCodes = [], authority = null } = {}) {
  return {
    version: POLICY_IDENTITY_EVIDENCE_AUTHORITY_VERSION,
    statusId,
    ready: statusId === POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.VERIFIED,
    reasonCodes: [...new Set(reasonCodes.filter(Boolean))],
    authority,
  };
}

function buildDeclaredAuthority({ candidate, row }) {
  const policyId = normalizeIdentifier(row.policy_id ?? row.policyId);
  const intentId = normalizeIdentifier(row.intent_id ?? row.intentId);
  const intentVersion = Number(row.intent_version ?? row.intentVersion);

  if (!policyId || !intentId || !Number.isInteger(intentVersion) || intentVersion < 1) {
    return null;
  }

  return {
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    evidenceSourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    libraryId: normalizeIdentifier(row.library_id ?? row.libraryId),
    evidenceKey: candidate.evidenceKey,
    signalType: candidate.nativeSignalType,
    policyId,
    intentId,
    intentVersion,
    authorityReference: `native-intent:${intentId}:v${intentVersion}`,
    authorityFingerprint: null,
  };
}

function normalizeObservedIdentityAuthority({ authority = {}, candidate, libraryId } = {}) {
  const source = asObject(authority);
  const fingerprint = normalizeString(source.authorityFingerprint, 64);

  if (
    source.authoritySourceId !== AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS ||
    source.evidenceSourceId !== POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE ||
    normalizeIdentifier(source.libraryId) !== libraryId ||
    normalizeString(source.evidenceKey, 160) !== candidate.evidenceKey ||
    normalizeString(source.signalType, 80) !== candidate.nativeSignalType ||
    source.profileFreshnessState !== 'current' ||
    source.verified !== true ||
    !SHA256_FINGERPRINT_PATTERN.test(fingerprint)
  ) {
    return null;
  }

  return {
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    evidenceSourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    libraryId,
    evidenceKey: candidate.evidenceKey,
    signalType: candidate.nativeSignalType,
    policyId: null,
    intentId: null,
    intentVersion: null,
    authorityReference: `observed-identity:${fingerprint}`,
    authorityFingerprint: fingerprint,
  };
}

function normalizeDeclaredIdentityAuthority({ authority = {}, candidate, libraryId } = {}) {
  const source = asObject(authority);
  const declaredAuthority = buildDeclaredAuthority({ candidate, row: source });

  if (
    !declaredAuthority ||
    source.evidenceSourceId !== POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT ||
    declaredAuthority.libraryId !== libraryId ||
    normalizeString(source.evidenceKey, 160) !== candidate.evidenceKey ||
    normalizeString(source.signalType, 80).toLowerCase() !== candidate.nativeSignalType ||
    normalizeString(source.authorityReference, 160) !== declaredAuthority.authorityReference ||
    normalizeIdentifier(source.policyId) !== declaredAuthority.policyId ||
    normalizeIdentifier(source.intentId) !== declaredAuthority.intentId ||
    Number(source.intentVersion) !== declaredAuthority.intentVersion ||
    source.authorityFingerprint !== null
  ) {
    return null;
  }

  return declaredAuthority;
}

function normalizeVerifiedIdentityAuthority({ authorityResult = {}, candidate, libraryId } = {}) {
  const result = asObject(authorityResult);
  const authority = asObject(result.authority);

  if (result.ready !== true || result.statusId !==
      POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.VERIFIED) {
    return null;
  }

  if (authority.authoritySourceId === AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT) {
    return normalizeDeclaredIdentityAuthority({ authority, candidate, libraryId });
  }

  if (authority.authoritySourceId === AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS) {
    return normalizeObservedIdentityAuthority({ authority, candidate, libraryId });
  }

  return null;
}

class PolicyIdentityEvidenceAuthorityResolver {
  constructor({
    repository = policyIdentityEvidenceAuthorityRepository,
  } = {}) {
    this.repository = repository;
  }

  async resolveDeclared({ client, libraryId, candidate } = {}) {
    const normalizedLibraryId = normalizeIdentifier(libraryId);
    const normalizedCandidate = buildIdentityCandidate(candidate);
    if (!normalizedLibraryId || !normalizedCandidate) {
      return buildAuthorityResult({
        statusId: POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.INVALID_CANDIDATE,
        reasonCodes: [POLICY_IDENTITY_EVIDENCE_AUTHORITY_REASON_IDS.INVALID_CANDIDATE],
      });
    }

    const rows = await this.repository.listActiveDeclaredIdentityRules({
      client,
      libraryId: normalizedLibraryId,
      signalType: normalizedCandidate.nativeSignalType,
    });
    const matchedByIntentId = new Map();

    rows.filter(row => ruleMatchesCandidate(row, normalizedCandidate)).forEach(row => {
      const authority = buildDeclaredAuthority({ candidate: normalizedCandidate, row });
      if (authority && authority.libraryId === normalizedLibraryId) {
        matchedByIntentId.set(authority.intentId, authority);
      }
    });

    if (matchedByIntentId.size === 0) {
      return buildAuthorityResult({
        statusId: POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.UNAVAILABLE,
        reasonCodes: [POLICY_IDENTITY_EVIDENCE_AUTHORITY_REASON_IDS.NO_INDEPENDENT_AUTHORITY],
      });
    }

    if (matchedByIntentId.size > 1) {
      return buildAuthorityResult({
        statusId: POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.AMBIGUOUS,
        reasonCodes: [
          POLICY_IDENTITY_EVIDENCE_AUTHORITY_REASON_IDS.AMBIGUOUS_DECLARED_AUTHORITY,
        ],
      });
    }

    return buildAuthorityResult({
      statusId: POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.VERIFIED,
      authority: [...matchedByIntentId.values()][0],
    });
  }

  async resolve(input = {}) {
    return this.resolveDeclared(input);
  }
}

const policyIdentityEvidenceAuthorityResolver = new PolicyIdentityEvidenceAuthorityResolver();

export {
  POLICY_IDENTITY_EVIDENCE_AUTHORITY_REASON_IDS,
  POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS,
  POLICY_IDENTITY_EVIDENCE_AUTHORITY_VERSION,
  PolicyIdentityEvidenceAuthorityResolver,
  buildIdentityCandidate,
  normalizeVerifiedIdentityAuthority,
  policyIdentityEvidenceAuthorityResolver,
};
