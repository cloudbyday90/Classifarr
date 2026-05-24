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
  resolveSignalSemantics,
} from '../utils/policySignals.mjs';
import { isPositiveContribution } from './policyEngineUtils.mjs';

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
]);

function summarizePresetSemantics(presets = []) {
  let hasIdentitySignals = false;
  let hasCompatibilitySignals = false;

  for (const preset of presets) {
    for (const [signalType, rawConfig] of Object.entries(preset?.signals || {})) {
      const config = normalizeSignalConfig(rawConfig);
      if (!config || !hasAffirmativeSignalConstraints(config, signalType)) {
        continue;
      }

      if (resolveSignalSemantics(signalType, config) === SIGNAL_SEMANTICS.IDENTITY) {
        hasIdentitySignals = true;
      } else {
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

export function buildCandidateDiagnostics(policy, scores = {}, agreement = null) {
  const presetEvidenceMode = inferPresetEvidenceMode(policy, scores);
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

  let primaryViability = CANDIDATE_VIABILITY.NO_POSITIVE_EVIDENCE;
  if (presetEvidenceMode === SIGNAL_SEMANTICS.IDENTITY) {
    primaryViability = CANDIDATE_VIABILITY.IDENTITY_EVIDENCE;
  } else if (
    presetEvidenceMode === SIGNAL_SEMANTICS.COMPATIBILITY &&
    !positiveSources.profile &&
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

  return {
    primary_viability: primaryViability,
    positive_sources: positiveSources,
    drivers,
    agreement_boosted: (agreement?.multiplier || 1) > 1,
  };
}

export function isWeakCandidateViability(diagnostics) {
  const viability = diagnostics?.primary_viability || null;
  return WEAK_CANDIDATE_VIABILITY.has(viability);
}
