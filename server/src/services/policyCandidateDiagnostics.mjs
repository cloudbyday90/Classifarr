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
  SIGNAL_SEMANTICS,
  hasAffirmativeSignalConstraints,
  normalizeSignalConfig,
  normalizeSignalSemantics,
  resolveSignalSemantics,
} from '../utils/policySignals.mjs';
import { isPositiveContribution } from './policyEngineUtils.mjs';
import { hasPolicyConstraintFailure } from './policyConstraintSemantics.mjs';

export const CANDIDATE_VIABILITY = Object.freeze({
  IDENTITY_EVIDENCE: 'identity_evidence',
  COMPATIBILITY_ONLY: 'compatibility_only',
  PROFILE_ONLY: 'profile_only',
  RAG_IMPROVED: 'rag_improved',
  MULTI_SOURCE_SUPPORT: 'multi_source_support',
  NO_POSITIVE_EVIDENCE: 'no_positive_evidence',
});

const WEAK_CANDIDATE_VIABILITY = new Set([
  CANDIDATE_VIABILITY.COMPATIBILITY_ONLY,
  CANDIDATE_VIABILITY.PROFILE_ONLY,
  CANDIDATE_VIABILITY.RAG_IMPROVED,
]);

const BROAD_GENRE_TERMS = new Set([
  'action',
  'adventure',
  'comedy',
  'drama',
  'family',
  'romance',
]);

function configuredTerms(config = {}) {
  return [
    ...(Array.isArray(config.require_all) ? config.require_all : []),
    ...(Array.isArray(config.require_any) ? config.require_any : []),
    ...(Array.isArray(config.prefer) ? config.prefer : []),
  ]
    .map((term) => String(term || '').trim().toLowerCase())
    .filter(Boolean);
}

function hasRequireConstraint(config = {}) {
  return (Array.isArray(config.require_all) && config.require_all.length > 0)
    || (Array.isArray(config.require_any) && config.require_any.length > 0);
}

function resolvePresetSignalEvidenceMode(signalType, rawConfig) {
  const config = normalizeSignalConfig(rawConfig);
  if (!config || !hasAffirmativeSignalConstraints(config, signalType)) {
    return null;
  }

  const explicit = normalizeSignalSemantics(config.semantics);
  if (explicit) {
    return explicit;
  }

  if (signalType === 'keywords' && !hasRequireConstraint(config)) {
    return SIGNAL_SEMANTICS.COMPATIBILITY;
  }

  if (signalType === 'genres') {
    const terms = configuredTerms(config);
    const broadOnly = terms.length > 0 && terms.every((term) => BROAD_GENRE_TERMS.has(term));
    if (broadOnly && !hasRequireConstraint({ require_all: config.require_all })) {
      return SIGNAL_SEMANTICS.COMPATIBILITY;
    }
  }

  return resolveSignalSemantics(signalType, config);
}

function summarizePresetSemantics(presets = []) {
  let hasIdentitySignals = false;
  let hasCompatibilitySignals = false;

  for (const preset of presets) {
    for (const [signalType, rawConfig] of Object.entries(preset?.signals || {})) {
      const evidenceMode = resolvePresetSignalEvidenceMode(signalType, rawConfig);
      if (evidenceMode === SIGNAL_SEMANTICS.IDENTITY) {
        hasIdentitySignals = true;
      } else if (evidenceMode === SIGNAL_SEMANTICS.COMPATIBILITY) {
        hasCompatibilitySignals = true;
      }
    }
  }

  return {
    hasIdentitySignals,
    hasCompatibilitySignals,
  };
}

export function inferPresetEvidenceMode(policy, scores = {}) {
  if (!isPositiveContribution(scores.preset)) {
    return null;
  }

  const semantics = summarizePresetSemantics(policy?.presets || []);
  if (semantics.hasIdentitySignals) {
    return SIGNAL_SEMANTICS.IDENTITY;
  }
  if (semantics.hasCompatibilitySignals || (policy?.presets?.length || 0) > 0) {
    return SIGNAL_SEMANTICS.COMPATIBILITY;
  }
  return null;
}

export function hasProfileHardExclusion(profileDiagnostics = null) {
  const exclusions = profileDiagnostics?.exclusions;
  if (!exclusions || typeof exclusions !== 'object') {
    return false;
  }

  return Object.values(exclusions).some((value) => Array.isArray(value) && value.length > 0);
}

export function buildCandidateDiagnostics(policy, scores = {}, agreement = null, details = {}) {
  const presetEvidenceMode = inferPresetEvidenceMode(policy, scores);
  const profileHardExcluded = hasProfileHardExclusion(details.profileDiagnostics);
  const constraintDiagnostics = details.constraintDiagnostics || null;
  const policyConstraintFailed = hasPolicyConstraintFailure(constraintDiagnostics);
  const positiveSources = {
    preset: presetEvidenceMode,
    profile: isPositiveContribution(scores.profile),
    pattern: Boolean(policy?.trust_patterns) && isPositiveContribution(scores.pattern),
    rag: Boolean(policy?.trust_rag) && isPositiveContribution(scores.rag),
    history: Boolean(policy?.trust_history) && isPositiveContribution(scores.history),
  };

  const drivers = [];
  if (presetEvidenceMode === SIGNAL_SEMANTICS.IDENTITY) {
    drivers.push(CANDIDATE_VIABILITY.IDENTITY_EVIDENCE);
  } else if (presetEvidenceMode === SIGNAL_SEMANTICS.COMPATIBILITY) {
    drivers.push(CANDIDATE_VIABILITY.COMPATIBILITY_ONLY);
  }

  if (positiveSources.profile) {
    drivers.push('profile_supported');
  }
  if (positiveSources.pattern) {
    drivers.push('pattern_supported');
  }
  if (positiveSources.rag) {
    drivers.push(CANDIDATE_VIABILITY.RAG_IMPROVED);
  }
  if (positiveSources.history) {
    drivers.push('history_supported');
  }
  if ((agreement?.multiplier || 1) > 1) {
    drivers.push('agreement_boosted');
  }

  const positiveSourceCount = Object.values(positiveSources).filter(Boolean).length;
  const hasCorroboratingStrongSource = positiveSources.pattern || positiveSources.history || positiveSources.rag;

  let primaryViability = CANDIDATE_VIABILITY.NO_POSITIVE_EVIDENCE;
  if (presetEvidenceMode === SIGNAL_SEMANTICS.IDENTITY) {
    primaryViability = CANDIDATE_VIABILITY.IDENTITY_EVIDENCE;
  } else if (
    presetEvidenceMode === SIGNAL_SEMANTICS.COMPATIBILITY &&
    !positiveSources.pattern &&
    !positiveSources.rag &&
    !positiveSources.history
  ) {
    primaryViability = CANDIDATE_VIABILITY.COMPATIBILITY_ONLY;
  } else if (
    positiveSources.rag &&
    !positiveSources.profile &&
    !positiveSources.pattern &&
    !positiveSources.history &&
    !positiveSources.preset
  ) {
    primaryViability = CANDIDATE_VIABILITY.RAG_IMPROVED;
  } else if (
    positiveSources.profile &&
    !positiveSources.preset &&
    !positiveSources.pattern &&
    !positiveSources.rag &&
    !positiveSources.history
  ) {
    primaryViability = CANDIDATE_VIABILITY.PROFILE_ONLY;
  } else if (positiveSourceCount > 0) {
    primaryViability = CANDIDATE_VIABILITY.MULTI_SOURCE_SUPPORT;
  }

  const suppressionReasons = [];
  if (policyConstraintFailed) {
    suppressionReasons.push('policy_constraint_conflict');
  }
  if (profileHardExcluded) {
    suppressionReasons.push('profile_hard_exclusion');
  }
  if (WEAK_CANDIDATE_VIABILITY.has(primaryViability)) {
    suppressionReasons.push('weak_primary_evidence');
  }
  if (
    presetEvidenceMode === SIGNAL_SEMANTICS.COMPATIBILITY &&
    positiveSources.profile &&
    !hasCorroboratingStrongSource
  ) {
    suppressionReasons.push('compatibility_profile_only');
  }

  const primaryAnchorEligible = suppressionReasons.length === 0;
  const evidenceClass = policyConstraintFailed || profileHardExcluded
    ? 'negative_conflict'
    : primaryViability === CANDIDATE_VIABILITY.IDENTITY_EVIDENCE
      ? 'identity'
      : primaryViability === CANDIDATE_VIABILITY.MULTI_SOURCE_SUPPORT
        ? 'multi_source'
        : primaryViability === CANDIDATE_VIABILITY.COMPATIBILITY_ONLY
          ? 'compatibility'
          : primaryViability === CANDIDATE_VIABILITY.PROFILE_ONLY
            ? 'profile_only'
            : primaryViability === CANDIDATE_VIABILITY.RAG_IMPROVED
              ? 'rag_only'
              : 'none';

  return {
    primary_viability: primaryViability,
    evidence_class: evidenceClass,
    primary_anchor_eligible: primaryAnchorEligible,
    suppression_reasons: suppressionReasons,
    profile_hard_excluded: profileHardExcluded,
    positive_sources: positiveSources,
    drivers,
    agreement_boosted: (agreement?.multiplier || 1) > 1,
    profile_scoring: details.profileDiagnostics || null,
    rag_evidence_quality: details.ragDiagnostics || null,
    policy_constraints: constraintDiagnostics,
  };
}

export function isWeakCandidateViability(diagnostics) {
  const viability = diagnostics?.primary_viability || null;
  return diagnostics?.primary_anchor_eligible === false || WEAK_CANDIDATE_VIABILITY.has(viability);
}
