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
  POLICY_RUNTIME_QUESTION_NORMALIZATION_VERSION,
} from './policyRuntimeQuestionNormalizer.mjs';
import { buildPolicyRuntimeReviewReference } from './policyRuntimeReviewReference.mjs';

const POLICY_RUNTIME_QUESTION_RECOMMENDATION_PRESENTATION_VERSION =
  'policy.runtime_question_recommendation_presentation.v2';

const POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS = Object.freeze({
  LEADING_CANDIDATE_AVAILABLE: 'leading_candidate_available',
  MANUAL_DESTINATION_SELECTION_REQUIRED: 'manual_destination_selection_required',
});

const AUTOMATION_STOP_REASON_BY_UNCERTAINTY_TYPE = Object.freeze({
  contract_violation: 'The classification decision was incomplete, so it cannot automate.',
  hard_constraint_conflict: 'A declared hard limit conflicts with a possible destination.',
  language_conflict: 'Language evidence conflicts with the current destination candidates.',
  manual_selection_needed: 'Classifarr does not have enough current evidence to select a destination automatically.',
  missing_identity_evidence: 'A score alone does not establish destination identity automatically.',
  profile_only_support: 'Observed library contents can support a match, but cannot define the destination by themselves.',
  rag_only_support: 'Similar-item evidence can support a match, but cannot define the destination by itself.',
  routing_gap: 'The destination cannot route automatically until its routing configuration is ready.',
  stale_profile: 'The observed library profile is stale and must be refreshed before automation.',
  weak_overlap: 'The leading candidate overlaps with another candidate on evidence that cannot automate.',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeString(value, maximumLength = 160) {
  if (typeof value !== 'string') return null;

  const normalized = value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized && normalized.length <= maximumLength ? normalized : null;
}

function normalizeCandidateDestination(value) {
  const source = asObject(value);
  const libraryId = normalizePositiveInteger(source.library_id ?? source.libraryId ?? source.id);
  const libraryName = normalizeString(source.library_name ?? source.libraryName ?? source.name);

  return libraryId && libraryName
    ? { library_id: libraryId, library_name: libraryName }
    : null;
}

function uniqueCandidateDestinations(destinations = []) {
  const seen = new Set();

  return asArray(destinations)
    .map(normalizeCandidateDestination)
    .filter(destination => {
      if (!destination || seen.has(destination.library_id)) return false;
      seen.add(destination.library_id);
      return true;
    });
}

function getAutomationStopReason(uncertaintyType) {
  const reasonId = normalizeString(uncertaintyType, 80) || 'manual_selection_needed';

  return {
    reason_id: reasonId,
    message: AUTOMATION_STOP_REASON_BY_UNCERTAINTY_TYPE[reasonId] ||
      AUTOMATION_STOP_REASON_BY_UNCERTAINTY_TYPE.manual_selection_needed,
  };
}

function isNormalizedRuntimeQuestion(question) {
  const normalization = asObject(question?.meta?.runtime_question_normalization);
  return normalization.version === POLICY_RUNTIME_QUESTION_NORMALIZATION_VERSION;
}

function buildPolicyRuntimeQuestionRecommendationPresentation({
  question = null,
  classification = {},
  reviewReference = null,
  candidateDestinations = [],
} = {}) {
  if (!isNormalizedRuntimeQuestion(question)) return null;

  const destinations = uniqueCandidateDestinations(candidateDestinations);
  const uncertaintyType = asObject(question?.meta?.runtime_question_normalization).uncertainty_type;
  const reference = reviewReference || buildPolicyRuntimeReviewReference({ classification, question, candidateDestinations });
  const policyDestination = reference.policyReference ? {
    ...reference.policyReference.destination, evidence_score: Math.round(reference.policyReference.candidate.score),
  } : null;
  const leadingDestination = reference.primaryDestination ? policyDestination : null;
  const reasons = {
    advisory_disagreement: 'Policy and AI comparison point to different destinations. Choose the destination for this item.',
    invalid_advisory_proposal: 'The AI comparison could not be bound to this review. Choose a destination using the policy evidence.',
    policy_tie: 'The leading policy scores are tied. Choose the destination for this item.',
    policy_reference_unavailable: 'Destination-specific policy evidence is unavailable or inconsistent. Choose a destination or retry classification.',
    no_positive_evidence: 'No candidate has positive policy support. Choose a destination or retry classification.',
  };

  return {
    version: POLICY_RUNTIME_QUESTION_RECOMMENDATION_PRESENTATION_VERSION,
    status_id: leadingDestination
      ? POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS.LEADING_CANDIDATE_AVAILABLE
      : POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS.MANUAL_DESTINATION_SELECTION_REQUIRED,
    leading_destination: leadingDestination,
    policy_destination: policyDestination,
    advisory_destination: reference.advisoryDestination,
    why_not_automatic: reference.reason ? { reason_id: reference.reason, message: reasons[reference.reason] } : getAutomationStopReason(uncertaintyType),
    alternative_candidate_count: leadingDestination
      ? Math.max(0, destinations.length - 1)
      : destinations.length,
  };
}

export {
  POLICY_RUNTIME_QUESTION_RECOMMENDATION_PRESENTATION_VERSION,
  POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS,
  buildPolicyRuntimeQuestionRecommendationPresentation,
};
