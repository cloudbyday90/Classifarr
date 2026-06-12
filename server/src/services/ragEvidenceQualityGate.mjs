/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { FORMULA_CONFIDENCE_CAP } from './policyEngineUtils.mjs';

const TRUSTED_OUTCOME_STATUSES = new Set([
  'completed',
  'routed',
  'reclassified',
  'resolved',
  'verified',
]);

const TRUSTED_OUTCOME_METHODS = new Set([
  'manual_classification',
  'manual_correction',
  'source_library',
  'policy_auto',
  'policy_engine',
  'policy_confirm',
  'policy_recheck',
  'ai_verified',
]);

const DEFAULT_QUALITY_MULTIPLIERS = Object.freeze({
  missing_library_identity: 0.25,
  untrusted_outcome: 0.40,
  unknown_outcome: 0.70,
  profile_unknown: 0.80,
  profile_incompatible: 0.50,
  profile_hard_exclusion: 0,
});

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatus(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeLibraryId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function hasProfileHardExclusion(profileDiagnostics = null) {
  const exclusions = profileDiagnostics?.exclusions;
  if (!exclusions || typeof exclusions !== 'object') {
    return false;
  }

  return Object.values(exclusions).some((value) => Array.isArray(value) && value.length > 0);
}

function resolveProfileFinalScore(profileDiagnostics = null) {
  return toNumber(
    profileDiagnostics?.final_score
      ?? profileDiagnostics?.finalScore
      ?? profileDiagnostics?.profile_score
      ?? profileDiagnostics?.score,
    Number.NaN,
  );
}

export function assessProfileCompatibility(profileDiagnostics = null, multipliers = DEFAULT_QUALITY_MULTIPLIERS) {
  if (!profileDiagnostics || typeof profileDiagnostics !== 'object') {
    return {
      compatible: null,
      multiplier: 1,
      reason: 'profile_not_evaluated',
    };
  }

  if (hasProfileHardExclusion(profileDiagnostics)) {
    return {
      compatible: false,
      multiplier: multipliers.profile_hard_exclusion,
      reason: 'profile_hard_exclusion',
    };
  }

  if (profileDiagnostics.available === false) {
    return {
      compatible: null,
      multiplier: multipliers.profile_unknown,
      reason: profileDiagnostics.reason || 'profile_unavailable',
    };
  }

  const finalScore = resolveProfileFinalScore(profileDiagnostics);
  if (Number.isFinite(finalScore) && finalScore <= 0) {
    return {
      compatible: false,
      multiplier: multipliers.profile_incompatible,
      reason: 'profile_incompatible',
    };
  }

  return {
    compatible: true,
    multiplier: 1,
    reason: 'profile_compatible',
  };
}

export function assessRagEvidenceMatch(match = {}, { profileDiagnostics = null, multipliers = DEFAULT_QUALITY_MULTIPLIERS } = {}) {
  const libraryId = normalizeLibraryId(match.libraryId ?? match.library_id);
  const libraryName = normalizeString(match.libraryName ?? match.library_name);
  const status = normalizeStatus(match.status);
  const method = normalizeStatus(match.method);
  const similarity = Math.max(0, Math.min(1, toNumber(match.similarity, 0)));
  const qualityFactors = [];
  const reasons = [];

  if (!libraryId || !libraryName) {
    qualityFactors.push(multipliers.missing_library_identity);
    reasons.push('missing_library_identity');
  }

  if (status) {
    if (!TRUSTED_OUTCOME_STATUSES.has(status)) {
      qualityFactors.push(multipliers.untrusted_outcome);
      reasons.push('untrusted_outcome');
    }
  } else if (method && TRUSTED_OUTCOME_METHODS.has(method)) {
    // Older RAG rows may not include status, but trusted final methods still carry useful provenance.
  } else {
    qualityFactors.push(multipliers.unknown_outcome);
    reasons.push('unknown_outcome');
  }

  const profile = assessProfileCompatibility(profileDiagnostics, multipliers);
  if (profile.multiplier < 1) {
    qualityFactors.push(profile.multiplier);
    reasons.push(profile.reason);
  }

  const multiplier = qualityFactors.length > 0 ? Math.min(...qualityFactors) : 1;
  const adjustedSimilarity = similarity * multiplier;
  const qualityScore = Math.min(adjustedSimilarity * 100, FORMULA_CONFIDENCE_CAP);

  return {
    schema_version: 1,
    library_id: libraryId,
    library_name: libraryName || null,
    title: normalizeString(match.title).slice(0, 160) || null,
    status: status || null,
    method: method || null,
    similarity,
    adjusted_similarity: Math.round(adjustedSimilarity * 10000) / 10000,
    quality_score: Math.round(qualityScore * 100) / 100,
    quality_multiplier: multiplier,
    reasons,
    trusted_outcome: !reasons.includes('untrusted_outcome') && !reasons.includes('unknown_outcome'),
    known_library_identity: Boolean(libraryId && libraryName),
    profile_compatible: profile.compatible,
  };
}

export function scoreRagEvidenceForLibrary({ libraryId, matches = [], profileDiagnostics = null } = {}) {
  const normalizedLibraryId = normalizeLibraryId(libraryId);
  const libraryMatches = Array.isArray(matches)
    ? matches.filter((match) => normalizeLibraryId(match?.libraryId ?? match?.library_id) === normalizedLibraryId)
    : [];

  const assessedMatches = libraryMatches
    .map((match) => assessRagEvidenceMatch(match, { profileDiagnostics }))
    .sort((left, right) => right.quality_score - left.quality_score || right.similarity - left.similarity);

  const topMatch = assessedMatches[0] || null;
  const reasons = [...new Set(assessedMatches.flatMap((match) => match.reasons))];
  const score = topMatch?.quality_score || 0;

  return {
    score,
    diagnostics: {
      schema_version: 1,
      library_id: normalizedLibraryId,
      considered_count: libraryMatches.length,
      eligible_count: assessedMatches.filter((match) => match.quality_multiplier === 1).length,
      score,
      reasons,
      top_match: topMatch,
      matches: assessedMatches.slice(0, 5),
    },
  };
}
