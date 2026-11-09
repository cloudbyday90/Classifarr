/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  policyDecisionAction,
} from '../utils/policyDecisionAuthority.mjs';
import {
  buildClassificationRouteSafetyProjection,
  evaluateClassificationRouteSafety,
} from './classificationRouteSafetyGate.mjs';
import {
  buildCandidateBoundVerificationPresentation,
} from './classificationCandidateBoundVerificationPresentation.mjs';
import {
  buildPolicyRuntimeQuestionScoreExplanation,
} from './policyRuntimeQuestionScoreExplanation.mjs';
import {
  buildPolicyCandidateEvidenceCard,
} from './policyCandidateEvidenceCard.mjs';
import { buildPolicyRuntimeReviewReference } from './policyRuntimeReviewReference.mjs';
import { hasLegacyPolicyReviewHistoricalHold } from './policyRuntimeQuestionHistoricalSafety.mjs';
import { isPolicyRuntimeQuestionPersistenceEnvelope } from './policyRuntimeQuestionPersistenceContract.mjs';
import { readPolicyPurposeMatchPresentation } from './policyPurposeMatchEvidence.mjs';
import {
  buildPolicyCandidateContrastiveEvidenceProjection,
} from './policyCandidateContrastiveEvidence.mjs';
import {
  buildPolicyLibraryEvidenceProfile,
} from './policyLibraryEvidenceProfile.mjs';

export const POLICY_RUNTIME_QUESTION_DECISION_PRESENTATION_VERSION =
  'policy.runtime_question_decision_presentation.v1';

export const POLICY_RUNTIME_QUESTION_DECISION_STATUS_IDS = Object.freeze({
  HISTORICAL_ROUTE_SAFETY_DETAILS_UNAVAILABLE: 'historical_route_safety_details_unavailable',
});

const MAX_EVIDENCE_FACTS = 4;
const HISTORICAL_ROUTE_SAFETY_UNAVAILABLE = Object.freeze({
  id: POLICY_RUNTIME_QUESTION_DECISION_STATUS_IDS.HISTORICAL_ROUTE_SAFETY_DETAILS_UNAVAILABLE,
  label: 'Historical routing details unavailable',
  message: 'This historical pending decision did not retain the route-safety state that prevented automatic routing. Retry Classification to evaluate the current policy before confirming.',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function boundedString(value, maximumLength = 160) {
  if (typeof value !== 'string') return null;

  const normalized = value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized && normalized.length <= maximumLength ? normalized : null;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function score(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
}

// PostgreSQL numeric columns can arrive as strings. This value may only block
// missing historical safety evidence; it never supplies a named display score.
function historicGlobalScore(value) {
  const parts = typeof value === 'string' && value.length <= 32 ? value.split('.') : [];
  const numericString = parts.length >= 1 && parts.length <= 2 && parts.every(part => /^\d+$/.test(part));
  return numericString ? score(Number(value)) : score(value);
}

function metadata(value) {
  if (typeof value === 'string') {
    try {
      return asObject(JSON.parse(value));
    } catch (_error) {
      return {};
    }
  }
  return asObject(value);
}

function buildEvidenceFacts({ classification, sourceMetadata, candidate, destinationName }) {
  const diagnostics = asObject(candidate?.candidate_diagnostics || candidate?.candidateDiagnostics);
  const positiveSources = asObject(diagnostics.positive_sources || diagnostics.positiveSources);
  const ragEvidence = asObject(diagnostics.rag_evidence_quality || diagnostics.ragEvidenceQuality);
  const facts = [];
  const purpose = readPolicyPurposeMatchPresentation({ classification, sourceMetadata, candidate });
  const label = purpose.origin === 'profile_derived' ? `Purpose inferred from library observations provides context for ${destinationName}.` :
    purpose.origin === 'mixed' ? `Mixed purpose origins were retained for ${destinationName}; a declared-subset match ${purpose.declaredMatch === 'matched' ? 'was established' : 'is not established'}.` :
      purpose.origin === 'declared_native' ? purpose.declaredMatch === 'matched' && purpose.runtimeEligible === true && purpose.specificity === 'positive_specialized_evidence'
        ? `A matched declared purpose distinguishes ${destinationName} from the other destinations.`
        : `Declared purpose was retained for ${destinationName}, but specialized matching support is not established.` :
        `Purpose origin and declared-rule matching evidence are unavailable for ${destinationName}.`;
  facts.push({ id: `purpose_${purpose.origin}`, label });
  if (positiveSources.rag === true || asArray(ragEvidence.matches).length > 0) {
    facts.push({
      id: 'similar_items',
      label: `Similar items already associated with ${destinationName} support this match.`,
    });
  }
  if (positiveSources.profile === true) {
    facts.push({
      id: 'observed_profile',
      label: `Observed contents of ${destinationName} support this match.`,
    });
  }
  if (diagnostics.profile_observed_absence_advisory === true) {
    facts.push({
      id: 'observed_profile_difference',
      label: `Observed library history differs; it does not change the retained policy decision for ${destinationName}.`,
    });
  }
  if (positiveSources.pattern === true) {
    facts.push({
      id: 'learned_pattern',
      label: `A confirmed classification pattern supports ${destinationName}.`,
    });
  }
  if (positiveSources.history === true) {
    facts.push({
      id: 'prior_outcomes',
      label: `Prior confirmed outcomes support ${destinationName}.`,
    });
  }

  return facts.slice(0, MAX_EVIDENCE_FACTS);
}

function buildDeterministicDecision({ classification, question, candidateDestinations, reviewReference }) {
  const sourceMetadata = metadata(classification?.metadata);
  const policyResult = asObject(sourceMetadata.policyResult);
  const details = asObject(sourceMetadata.classification_details);
  const thresholds = asObject(policyResult.thresholds);
  const native = isPolicyRuntimeQuestionPersistenceEnvelope(question);
  const leadingDestination = native ? candidateDestinations.length === 1 ? candidateDestinations[0] : null
    : reviewReference.policyReference?.destination ?? null;
  const destinationName = leadingDestination?.library_name || 'the retained policy decision';
  const candidate = reviewReference.policyReference?.candidate ?? null;
  const decisionScore = candidate ? score(candidate.score) : null;
  const reviewThreshold = candidate ? score(candidate.prompt_threshold) ?? score(thresholds.prompt) : null;
  const automaticThreshold = candidate ? score(candidate.auto_classify_threshold) ?? score(thresholds.auto_classify) : null;
  const action = policyDecisionAction(policyResult);
  const persistedRouteSafety = buildClassificationRouteSafetyProjection(details.route_safety);
  const routeSafety = persistedRouteSafety ||
    buildClassificationRouteSafetyProjection(evaluateClassificationRouteSafety({
      result: {
        method: classification?.method,
        confidence: classification?.confidence,
        library: leadingDestination,
        policyResult,
      },
      policyResult,
    }));
  const primarySafetyGate = routeSafety?.primary_gate || null;
  let displaySafetyGate = !persistedRouteSafety &&
    primarySafetyGate?.id === 'policy_threshold_unavailable'
    ? null
    : primarySafetyGate;
  const legacyHistoricalHold = hasLegacyPolicyReviewHistoricalHold({ classification, question, candidateDestinations, policyResult, persistedRouteSafety });
  const lacksHistoricRouteSafetyDetails = legacyHistoricalHold || !displaySafetyGate &&
    ((decisionScore !== null && automaticThreshold !== null && decisionScore >= automaticThreshold) ||
      (!candidate && reviewReference.hasUnboundAutomaticScore === true) ||
      (!candidate && historicGlobalScore(policyResult.confidence ?? classification.confidence) !== null &&
        score(thresholds.auto_classify) !== null &&
        historicGlobalScore(policyResult.confidence ?? classification.confidence) >= score(thresholds.auto_classify)));

  if (lacksHistoricRouteSafetyDetails) {
    displaySafetyGate = HISTORICAL_ROUTE_SAFETY_UNAVAILABLE;
  }

  let statusId = 'manual_selection_required';
  let message = 'The current policy result requires a destination decision.';
  if (displaySafetyGate?.id === HISTORICAL_ROUTE_SAFETY_UNAVAILABLE.id) {
    statusId = POLICY_RUNTIME_QUESTION_DECISION_STATUS_IDS.HISTORICAL_ROUTE_SAFETY_DETAILS_UNAVAILABLE;
    message = HISTORICAL_ROUTE_SAFETY_UNAVAILABLE.message;
  } else if (displaySafetyGate?.id === 'policy_destination_selection_required' || action === 'prompt_select') {
    statusId = 'destination_selection_required';
    message = displaySafetyGate?.message ||
      `${destinationName} is a viable destination, but the policy evaluation did not establish a unique destination. Choose the destination to use for this item.`;
  } else if (
    displaySafetyGate?.id === 'policy_confirmation_required' ||
    displaySafetyGate?.id === 'policy_score_below_automatic_threshold' ||
    action === 'prompt_confirm'
  ) {
    statusId = 'confirmation_required';
    message = displaySafetyGate?.message ||
      `${destinationName} meets the confirmation threshold but requires your confirmation before it can route.`;
  } else if (displaySafetyGate) {
    statusId = decisionScore !== null && automaticThreshold !== null && decisionScore >= automaticThreshold
      ? 'automatic_threshold_blocked'
      : 'automatic_route_blocked';
    message = decisionScore !== null && automaticThreshold !== null && decisionScore >= automaticThreshold
      ? `${destinationName} meets the automatic policy threshold, but automatic routing remains blocked because ${displaySafetyGate.message}`
      : displaySafetyGate.message;
  } else if (decisionScore !== null && reviewThreshold !== null && decisionScore >= reviewThreshold) {
    statusId = 'confirmation_required';
    message = `${destinationName} meets the confirmation threshold but not the automatic threshold.`;
  } else if (decisionScore !== null) {
    statusId = 'below_review_threshold';
    message = `${destinationName} does not meet the policy confirmation threshold.`;
  }

  return {
    status_id: statusId,
    destination: leadingDestination,
    score: decisionScore,
    review_threshold: reviewThreshold,
    automatic_threshold: automaticThreshold,
    message,
    evidence: candidate ? buildEvidenceFacts({ classification, sourceMetadata, candidate, destinationName }) : [],
    candidate_evidence_card: candidate ? buildPolicyCandidateEvidenceCard({
      classification,
      candidate,
      sourceMetadata,
    }) : null,
    candidate_contrastive_evidence: candidate ? buildPolicyCandidateContrastiveEvidenceProjection(
      details.candidate_contrastive_evidence,
    ) : null,
    library_evidence_profile: candidate ? buildPolicyLibraryEvidenceProfile({
      classification,
      question,
      candidateDestinations: [leadingDestination, ...reviewReference.rankedDestinations.filter(destination => destination.library_id !== leadingDestination?.library_id)],
      sourceMetadata,
    }) : null,
    score_explanation: buildPolicyRuntimeQuestionScoreExplanation({
      candidate,
      displayedScore: decisionScore,
    }),
    safety_gate: displaySafetyGate,
    additional_safety_gates: displaySafetyGate ? routeSafety?.blocking_gates?.slice(1) || [] : [],
  };
}

function buildAiAdvisory({ classification }) {
  const sourceMetadata = metadata(classification?.metadata);
  const details = asObject(sourceMetadata.classification_details);
  const advisory = asObject(details.ai_advisory);

  if (advisory.version === 'classification.ai_advisory.v1') {
    return {
      status_id: 'historic_advisory_not_retained',
      message: 'This legacy advisory does not retain a bound candidate comparison. Review the policy evidence and choose the destination.',
      proposed_destination: null,
    };
  }

  const reason = boundedString(classification?.reason, 280) || '';
  if (reason.toLowerCase().includes('ai disagreed')) {
    return {
      status_id: 'historic_advisory_not_retained',
      message: 'A previous model rerun did not confirm the deterministic candidate. That older runtime did not retain a safe structured alternative, so it cannot be reconstructed from this record.',
      proposed_destination: null,
    };
  }

  if (classification?.method === 'ai_verified') {
    return {
      status_id: 'advisory_unavailable',
      message: 'This record does not retain a bound AI comparison. Review the policy evidence and choose the destination.',
      proposed_destination: null,
    };
  }

  return null;
}

function buildCandidateBoundVerification({ classification }) {
  const sourceMetadata = metadata(classification?.metadata);
  const details = asObject(sourceMetadata.classification_details);

  return buildCandidateBoundVerificationPresentation(
    details.candidate_bound_verification,
  );
}

/**
 * Safe, server-derived explanation for an operator decision. It deliberately
 * excludes prompts, raw model output, provider credentials, and free-form
 * model rationales while preserving the deterministic inputs and normalized
 * advisory outcome needed to understand why the item is awaiting review.
 */
export function buildPolicyRuntimeQuestionDecisionPresentation({
  classification = {},
  question = null,
  candidateDestinations = [],
  reviewReference = null,
} = {}) {
  const destinations = asArray(candidateDestinations)
    .map((destination) => ({
      library_id: positiveInteger(destination?.library_id),
      library_name: boundedString(destination?.library_name),
    }))
    .filter((destination) => destination.library_id && destination.library_name);
  const reference = reviewReference || buildPolicyRuntimeReviewReference({ classification, question, candidateDestinations: destinations });
  const deterministic = buildDeterministicDecision({
    reviewReference: reference,
    classification,
    question: asObject(question),
    candidateDestinations: destinations,
  });

  return {
    version: POLICY_RUNTIME_QUESTION_DECISION_PRESENTATION_VERSION,
    deterministic,
    ai_advisory: buildAiAdvisory({
      classification,
    }),
    candidate_bound_verification: buildCandidateBoundVerification({
      classification,
    }),
    candidate_adjudication: reference.adjudication,
  };
}
