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
  POLICY_INTENT_DRAFT_BUCKETS,
  validatePolicyIntentDraftRequest,
} from './policyIntentRequestValidator.mjs';
import {
  POLICY_PURPOSE_COVERAGE_STATUS_IDS,
  buildPolicyPurposeCoverage,
} from './policyPurposeCoverageReviewContract.mjs';

export const POLICY_PURPOSE_COVERAGE_PREFLIGHT_VERSION = 1;

const PURPOSE_SIGNAL_TYPES = Object.freeze(['genres', 'keywords', 'studios']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function toIsoTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function collectRequiredTerms(values = {}) {
  return ['require_all', 'require_any'].flatMap(key => asArray(values[key]))
    .map(asNonEmptyString)
    .filter(Boolean);
}

/**
 * Validates the untrusted draft before deriving only the terms that current
 * native runtime purpose evaluation treats as required identity evidence.
 * These terms remain transient and are never returned by the preflight API.
 */
export function buildPolicyPurposeCoveragePreflightCandidate(draft) {
  const validatedDraft = validatePolicyIntentDraftRequest(draft);
  const candidateTermsByKey = new Map();

  for (const preset of asArray(validatedDraft.presets)) {
    const identityEntries = asArray(preset?.buckets?.[POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]);
    for (const entry of identityEntries) {
      const signalType = asNonEmptyString(entry?.signal_type);
      if (!PURPOSE_SIGNAL_TYPES.includes(signalType)) continue;

      const metadata = asObject(entry?.metadata);
      if (metadata.semantics === 'compatibility') continue;

      for (const term of collectRequiredTerms(asObject(entry?.values))) {
        const termKey = term.toLowerCase();
        candidateTermsByKey.set(`${signalType}\u0000${termKey}`, { signalType, termKey });
      }
    }
  }

  const terms = [...candidateTermsByKey.values()];
  return {
    terms,
    requiredSignalTypeCount: new Set(terms.map(term => term.signalType)).size,
    requiredTermCount: terms.length,
  };
}

function buildGuidance(coverage = {}) {
  switch (coverage.statusId) {
    case POLICY_PURPOSE_COVERAGE_STATUS_IDS.MISSING_SPECIALIZED_COVERAGE:
      return {
        title: 'Review specialized purpose coverage before saving',
        description: 'This draft has no required genre, keyword, or studio purpose signal. Consider adding an explicit Belongs Here requirement, then run this advisory check again. Saving remains a separate server-validated action.',
      };
    case POLICY_PURPOSE_COVERAGE_STATUS_IDS.BROAD_OVERLAP_REVIEW_REQUIRED:
      return {
        title: 'Review shared purpose coverage before saving',
        description: 'Every proposed required content signal is shared with another active destination of the same media type. Consider a more specific declared purpose, then run this advisory check again. This check does not select a destination.',
      };
    default:
      return {
        title: 'Proposed purpose coverage is distinct',
        description: 'At least one proposed required content signal is not shared with another active destination of the same media type. This advisory result does not approve a save or validate semantic correctness.',
      };
  }
}

export function buildPolicyPurposeCoveragePreflight({
  context = {},
  candidate = {},
  overlap = {},
  evaluatedAt = new Date(),
} = {}) {
  const policyId = asPositiveInteger(context.policy_id);
  const libraryId = asPositiveInteger(context.library_id);
  if (!policyId || !libraryId) return null;

  const coverage = buildPolicyPurposeCoverage({
    required_signal_type_count: candidate.requiredSignalTypeCount,
    required_term_count: candidate.requiredTermCount,
    shared_required_term_count: asNonNegativeInteger(overlap.shared_required_term_count),
    overlapping_destination_count: asNonNegativeInteger(overlap.overlapping_destination_count),
  });

  return {
    version: `policy_purpose_coverage_preflight.v${POLICY_PURPOSE_COVERAGE_PREFLIGHT_VERSION}`,
    evaluatedAt: toIsoTimestamp(evaluatedAt) || new Date().toISOString(),
    policy: {
      id: policyId,
      name: asNonEmptyString(context.policy_name) || 'Unnamed policy',
    },
    library: {
      id: libraryId,
      name: asNonEmptyString(context.library_name) || 'Unnamed library',
      mediaType: asNonEmptyString(context.library_media_type),
    },
    coverage,
    guidance: buildGuidance(coverage),
    advisory: true,
    draftRetained: false,
    rawConfigurationExposed: false,
    routingAffected: false,
    providerAccessed: false,
    databaseWritten: false,
  };
}
