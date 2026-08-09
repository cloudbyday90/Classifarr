/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_RUNTIME_QUESTION_DECISION_PRESENTATION_VERSION =
  'policy.runtime_question_decision_presentation.v1';

const MAX_EVIDENCE_FACTS = 4;

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
  const facts = [];

  if (nativeIntent.eligible === true && Number(nativeIntent?.rule_counts?.purpose || 0) > 0) {
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
  const thresholds = asObject(policyResult.thresholds);
  const leadingDestination = candidateDestinations[0] || null;
  const destinationName = leadingDestination?.library_name || 'the leading destination';
  const candidate = candidateForLeadingDestination(question, candidateDestinations);
  const decisionScore = score(classification?.confidence) ?? score(policyResult.confidence) ?? score(candidate?.score);
  const reviewThreshold = score(thresholds.prompt);
  const automaticThreshold = score(thresholds.auto_classify);

  let statusId = 'manual_selection_required';
  let message = 'The current policy result requires a destination decision.';
  if (decisionScore !== null && automaticThreshold !== null && decisionScore >= automaticThreshold) {
    statusId = 'automatic_threshold_met';
    message = `${destinationName} meets the automatic policy threshold, but another safety gate requires review.`;
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
  };
}
