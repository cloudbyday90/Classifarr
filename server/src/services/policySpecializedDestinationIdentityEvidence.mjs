/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { evaluatePresetSignals } from './policyEngineSignalScoring.mjs';
import { isNativePolicyRuntimeAuthority } from './policyEngineRuntimeAuthority.mjs';
import {
  hasAffirmativeSignalConstraints,
  normalizeSignalConfig,
  resolveSignalSemantics,
  SIGNAL_SEMANTICS,
} from '../utils/policySignals.mjs';
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { keywordMatchesTerm } from './policyEngineUtils.mjs';

export const SPECIALIZED_DESTINATION_IDENTITY_EVIDENCE_VERSION = 1;

export const SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS = Object.freeze({
  POSITIVE_SPECIALIZED_EVIDENCE: 'positive_specialized_evidence',
  BROAD_COMPATIBILITY_OVERLAP: 'broad_compatibility_overlap',
  INSUFFICIENT_SPECIALIZED_EVIDENCE: 'insufficient_specialized_evidence',
  NOT_APPLICABLE: 'not_applicable',
});

const CONTENT_BEARING_IDENTITY_SIGNAL_TYPES = new Set(['genres', 'keywords', 'studios']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizedTerms(config = {}) {
  return [
    ...asArray(config.require_all),
    ...asArray(config.require_any),
  ]
    .map((term) => String(term || '').trim().toLowerCase())
    .filter(Boolean);
}

function hasRequiredTerms(config = {}) {
  return asArray(config.require_all).length > 0 || asArray(config.require_any).length > 0;
}

function searchableItemText(item = {}) {
  return [item.overview, item.title]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .toLowerCase();
}

function matchesConfiguredTerm(signalType, term, item = {}) {
  if (signalType === 'genres') {
    return normalizeMetadataListLower(item.genres).includes(term);
  }

  if (signalType === 'keywords') {
    return keywordMatchesTerm(
      term,
      normalizeMetadataListLower(item.keywords),
      searchableItemText(item),
    );
  }

  if (signalType === 'studios') {
    const studios = normalizeMetadataListLower(item.studios);
    const productionCompanies = studios.length > 0
      ? studios
      : normalizeMetadataListLower(item.production_companies);
    return productionCompanies
      .some((studio) => studio.includes(term));
  }

  return false;
}

function isValidatedNativePurposePolicy(policy = {}) {
  const contract = asObject(policy.policy_intent_contract);
  return isNativePolicyRuntimeAuthority(policy) &&
    policy?.policy_runtime_authority?.validationOk === true &&
    contract.source === 'native_intent' &&
    contract.validation?.valid === true;
}

function matchedPurposeIdentityTerms(policy = {}, item = {}) {
  if (!isValidatedNativePurposePolicy(policy)) {
    return [];
  }

  return asArray(policy.policy_intent_contract?.purpose).flatMap((rule) => {
    const signalType = String(rule?.signal_type || '').trim().toLowerCase();
    const config = normalizeSignalConfig(rule?.values) || {};
    const semantics = resolveSignalSemantics(signalType, {
      ...config,
      ...(rule?.semantics ? { semantics: rule.semantics } : {}),
    });

    // A required content signal can distinguish a declared destination. A
    // preference, media type, range, language, or certification is useful
    // context but cannot establish destination identity by itself.
    if (
      semantics !== SIGNAL_SEMANTICS.IDENTITY ||
      !CONTENT_BEARING_IDENTITY_SIGNAL_TYPES.has(signalType) ||
      !hasAffirmativeSignalConstraints(config, signalType) ||
      !hasRequiredTerms(config) ||
      evaluatePresetSignals({ [signalType]: config }, item) <= 50
    ) {
      return [];
    }

    return normalizedTerms(config)
      .filter((term) => matchesConfiguredTerm(signalType, term, item))
      .map((term) => ({
        key: `${signalType}:${term}`,
        signalType,
      }));
  });
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function identityEvidenceSummary({
  policy,
  matches,
  sharedMatchKeys,
  consideredCandidateCount,
}) {
  if (!isValidatedNativePurposePolicy(policy)) {
    return {
      schema_version: SPECIALIZED_DESTINATION_IDENTITY_EVIDENCE_VERSION,
      status_id: SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.NOT_APPLICABLE,
      current_evaluation: true,
      contract_validated: false,
      considered_candidate_count: consideredCandidateCount,
      matched_signal_count: 0,
      unique_signal_count: 0,
      shared_signal_count: 0,
      signal_types: [],
    };
  }

  const matchedKeys = uniqueSorted(matches.map((match) => match.key));
  const uniqueKeys = matchedKeys.filter((key) => !sharedMatchKeys.has(key));
  const sharedKeys = matchedKeys.filter((key) => sharedMatchKeys.has(key));
  const statusId = uniqueKeys.length > 0
    ? SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.POSITIVE_SPECIALIZED_EVIDENCE
    : matchedKeys.length > 0
      ? SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.BROAD_COMPATIBILITY_OVERLAP
      : SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.INSUFFICIENT_SPECIALIZED_EVIDENCE;

  return {
    schema_version: SPECIALIZED_DESTINATION_IDENTITY_EVIDENCE_VERSION,
    status_id: statusId,
    current_evaluation: true,
    contract_validated: true,
    considered_candidate_count: consideredCandidateCount,
    matched_signal_count: matchedKeys.length,
    unique_signal_count: uniqueKeys.length,
    shared_signal_count: sharedKeys.length,
    signal_types: uniqueSorted(matches.map((match) => match.signalType)),
  };
}

function withWeakIdentityEvidence(candidate, identityEvidence) {
  const diagnostics = asObject(candidate.candidate_diagnostics);
  const suppressionReasons = uniqueSorted([
    ...asArray(diagnostics.suppression_reasons),
    'weak_primary_evidence',
    identityEvidence.status_id,
  ]);

  return {
    ...candidate,
    candidate_diagnostics: {
      ...diagnostics,
      primary_viability: 'compatibility_only',
      evidence_class: identityEvidence.status_id,
      primary_anchor_eligible: false,
      suppression_reasons: suppressionReasons,
      identity_evidence: identityEvidence,
    },
  };
}

function withStrongIdentityEvidence(candidate, identityEvidence) {
  const diagnostics = asObject(candidate.candidate_diagnostics);
  return {
    ...candidate,
    candidate_diagnostics: {
      ...diagnostics,
      primary_viability: 'identity_evidence',
      evidence_class: 'specialized_identity',
      primary_anchor_eligible: true,
      suppression_reasons: asArray(diagnostics.suppression_reasons)
        .filter((reason) => reason !== 'weak_primary_evidence'),
      identity_evidence: identityEvidence,
    },
  };
}

/**
 * Projects current cross-candidate identity evidence into the candidate
 * diagnostics used by calibration and ranking. Matching terms are used only
 * in-memory for comparison and are never included in the returned projection.
 */
export function applySpecializedDestinationIdentityEvidence({
  evaluations = [],
  policies = [],
  item = {},
} = {}) {
  const policyById = new Map(asArray(policies).map((policy) => [Number(policy?.id), policy]));
  const candidates = asArray(evaluations)
    .filter((candidate) => Number(candidate?.score) > 0)
    .map((candidate) => ({
      candidate,
      policy: policyById.get(Number(candidate?.policy_id)) || null,
    }));

  const matchesByPolicyId = new Map(candidates.map(({ candidate, policy }) => [
    Number(candidate?.policy_id),
    matchedPurposeIdentityTerms(policy, item),
  ]));
  const matchCounts = new Map();
  for (const matches of matchesByPolicyId.values()) {
    for (const key of new Set(matches.map((match) => match.key))) {
      matchCounts.set(key, (matchCounts.get(key) || 0) + 1);
    }
  }

  return asArray(evaluations).map((candidate) => {
    const policy = policyById.get(Number(candidate?.policy_id)) || null;
    const matches = matchesByPolicyId.get(Number(candidate?.policy_id)) || [];
    const sharedMatchKeys = new Set(matches
      .map((match) => match.key)
      .filter((key) => (matchCounts.get(key) || 0) > 1));
    const identityEvidence = identityEvidenceSummary({
      policy,
      matches,
      sharedMatchKeys,
      consideredCandidateCount: candidates.length,
    });
    const existingDiagnostics = asObject(candidate.candidate_diagnostics);

    // Specialization may only refine a viable candidate. A current policy
    // constraint conflict or an existing hard profile exclusion remains a
    // higher-priority routing block.
    if (
      existingDiagnostics.evidence_class === 'negative_conflict' ||
      existingDiagnostics.profile_hard_excluded === true
    ) {
      return {
        ...candidate,
        candidate_diagnostics: {
          ...existingDiagnostics,
          identity_evidence: identityEvidence,
        },
      };
    }

    if (identityEvidence.status_id === SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.POSITIVE_SPECIALIZED_EVIDENCE) {
      return withStrongIdentityEvidence(candidate, identityEvidence);
    }

    if (
      identityEvidence.status_id === SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.BROAD_COMPATIBILITY_OVERLAP ||
      identityEvidence.status_id === SPECIALIZED_DESTINATION_IDENTITY_STATUS_IDS.INSUFFICIENT_SPECIALIZED_EVIDENCE
    ) {
      return withWeakIdentityEvidence(candidate, identityEvidence);
    }

    return {
      ...candidate,
      candidate_diagnostics: {
        ...asObject(candidate.candidate_diagnostics),
        identity_evidence: identityEvidence,
      },
    };
  });
}
