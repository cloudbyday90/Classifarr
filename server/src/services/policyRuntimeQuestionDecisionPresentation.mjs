/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  getPolicyDecisionCandidate,
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
  buildPolicyCandidateAdjudicationPresentation,
} from './policyCandidateAdjudicationPresentation.mjs';
import {
  buildPolicyRuntimeQuestionScoreExplanation,
} from './policyRuntimeQuestionScoreExplanation.mjs';
import {
  buildPolicyCandidateEvidenceCard,
} from './policyCandidateEvidenceCard.mjs';

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
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? Math.round(number) : null;
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

function candidateForLeadingDestination(question, candidateDestinations) {
  const candidates = asArray(question?.meta?.candidates);
  const leading = candidateDestinations[0] || null;
  if (!leading) return null;

  return candidates.find((candidate) => positiveInteger(candidate?.library_id) === leading.library_id) || null;
}

function buildEvidenceFacts({ candidate, destinationName }) {
  const diagnostics = asObject(candidate?.candidate_diagnostics || candidate?.candidateDiagnostics);
  const positiveSources = asObject(diagnostics.positive_sources || diagnostics.positiveSources);
  const nativeIntent = asObject(diagnostics.native_intent_runtime || diagnostics.nativeIntentRuntime);
  const ragEvidence = asObject(diagnostics.rag_evidence_quality || diagnostics.ragEvidenceQuality);
  const identityEvidence = asObject(diagnostics.identity_evidence || diagnostics.identityEvidence);
  const facts = [];

  if (identityEvidence.status_id === 'positive_specialized_evidence') {
    facts.push({
      id: 'specialized_declared_intent',
      label: `A current specialized declared policy signal distinguishes ${destinationName} from the other destinations.`,
    });
  } else if (identityEvidence.status_id === 'broad_compatibility_overlap') {
    facts.push({
      id: 'broad_compatibility_overlap',
      label: `The declared policy signals for ${destinationName} overlap with another current destination and cannot select it automatically.`,
    });
  } else if (identityEvidence.status_id === 'insufficient_specialized_evidence') {
    facts.push({
      id: 'insufficient_specialized_evidence',
      label: `No current specialized declared policy signal distinguishes ${destinationName} from the other destinations.`,
    });
  } else if (nativeIntent.eligible === true && Number(nativeIntent?.rule_counts?.purpose || 0) > 0) {
    facts.push({
      id: 'declared_intent',
      label: `Declared policy intent supports ${destinationName}.`,
    });
  }
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
      label: `Observed library history differs, but does not override the declared policy intent for ${destinationName}.`,
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

function buildDeterministicDecision({ classification, question, candidateDestinations }) {
  const sourceMetadata = metadata(classification?.metadata);
  const policyResult = asObject(sourceMetadata.policyResult);
  const details = asObject(sourceMetadata.classification_details);
  const thresholds = asObject(policyResult.thresholds);
  const leadingDestination = candidateDestinations[0] || null;
  const destinationName = leadingDestination?.library_name || 'the leading destination';
  const policyCandidate = getPolicyDecisionCandidate(policyResult, leadingDestination);
  const questionCandidate = candidateForLeadingDestination(question, candidateDestinations);
  const candidate = policyCandidate || questionCandidate;
  const decisionScore = score(policyCandidate?.score) ??
    score(policyResult.confidence) ??
    score(questionCandidate?.score) ??
    score(classification?.confidence);
  const reviewThreshold = score(policyCandidate?.prompt_threshold) ?? score(thresholds.prompt);
  const automaticThreshold = score(policyCandidate?.auto_classify_threshold) ?? score(thresholds.auto_classify);
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
  const lacksHistoricRouteSafetyDetails = !displaySafetyGate &&
    decisionScore !== null &&
    automaticThreshold !== null &&
    decisionScore >= automaticThreshold;

  if (lacksHistoricRouteSafetyDetails) {
    displaySafetyGate = HISTORICAL_ROUTE_SAFETY_UNAVAILABLE;
  }

  let statusId = 'manual_selection_required';
  let message = 'The current policy result requires a destination decision.';
  if (displaySafetyGate?.id === 'policy_destination_selection_required' || action === 'prompt_select') {
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
    if (displaySafetyGate.id === HISTORICAL_ROUTE_SAFETY_UNAVAILABLE.id) {
      statusId = POLICY_RUNTIME_QUESTION_DECISION_STATUS_IDS.HISTORICAL_ROUTE_SAFETY_DETAILS_UNAVAILABLE;
      message = `${destinationName} meets the automatic policy threshold, but the historic pending decision did not retain the state that prevented automatic routing. Retry Classification to evaluate the current policy before confirming.`;
    } else {
      statusId = decisionScore !== null && automaticThreshold !== null && decisionScore >= automaticThreshold
        ? 'automatic_threshold_blocked'
        : 'automatic_route_blocked';
      message = decisionScore !== null && automaticThreshold !== null && decisionScore >= automaticThreshold
        ? `${destinationName} meets the automatic policy threshold, but automatic routing remains blocked because ${displaySafetyGate.message}`
        : displaySafetyGate.message;
    }
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
    evidence: buildEvidenceFacts({ candidate, destinationName }),
    candidate_evidence_card: buildPolicyCandidateEvidenceCard({
      classification,
      candidate,
      sourceMetadata,
    }),
    score_explanation: buildPolicyRuntimeQuestionScoreExplanation({
      candidate,
      displayedScore: decisionScore,
    }),
    safety_gate: displaySafetyGate,
    additional_safety_gates: displaySafetyGate ? routeSafety?.blocking_gates?.slice(1) || [] : [],
  };
}

function buildAiAdvisory({ classification, destinationName }) {
  const sourceMetadata = metadata(classification?.metadata);
  const details = asObject(sourceMetadata.classification_details);
  const advisory = asObject(details.ai_advisory);

  if (advisory.version === 'classification.ai_advisory.v1') {
    const selectedDestination = asObject(advisory.proposed_destination);
    const selectedLibraryId = positiveInteger(selectedDestination.library_id);
    const selectedLibraryName = boundedString(selectedDestination.library_name);
    const statusId = boundedString(advisory.status_id, 80) || 'advisory_unavailable';

    return {
      status_id: statusId,
      message: boundedString(advisory.message, 280) ||
        'The model output was advisory and did not override the deterministic policy decision.',
      proposed_destination: selectedLibraryId && selectedLibraryName
        ? { library_id: selectedLibraryId, library_name: selectedLibraryName }
        : null,
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
      status_id: 'aligned_with_deterministic',
      message: `AI verification aligned with ${destinationName}. It remains advisory and did not determine the policy outcome.`,
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

function buildCandidateAdjudication({ classification }) {
  const sourceMetadata = metadata(classification?.metadata);
  const details = asObject(sourceMetadata.classification_details);

  return buildPolicyCandidateAdjudicationPresentation(
    details.candidate_adjudication,
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
} = {}) {
  const destinations = asArray(candidateDestinations)
    .map((destination) => ({
      library_id: positiveInteger(destination?.library_id),
      library_name: boundedString(destination?.library_name),
    }))
    .filter((destination) => destination.library_id && destination.library_name);
  const deterministic = buildDeterministicDecision({
    classification,
    question: asObject(question),
    candidateDestinations: destinations,
  });

  return {
    version: POLICY_RUNTIME_QUESTION_DECISION_PRESENTATION_VERSION,
    deterministic,
    ai_advisory: buildAiAdvisory({
      classification,
      destinationName: deterministic.destination?.library_name || 'the deterministic destination',
    }),
    candidate_bound_verification: buildCandidateBoundVerification({
      classification,
    }),
    candidate_adjudication: buildCandidateAdjudication({
      classification,
    }),
  };
}
