/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildContractViolationWhyUncertain } from './aiResponseParserResults.mjs';

/** Choice order is presentation only; no choice establishes a primary destination. */
function choiceOptions(libraries, matchedOptions = []) {
  const pool = Array.isArray(libraries) ? libraries : [], known = new Map(), seen = new Set(), ordered = [];
  for (const library of pool) if (!known.has(library.id)) known.set(library.id, library);
  const append = library => {
    if (library && !seen.has(library.id)) { seen.add(library.id); ordered.push(library); }
  };
  for (const option of Array.isArray(matchedOptions) ? matchedOptions : []) append(known.get(option.library_id));
  for (const library of pool) append(library);
  return ordered.slice(0, 4).map(library => ({ label: library.name, value: `library_${library.id}`,
    library_id: library.id, library_name: library.name }));
}

export function createUnresolvedClassifyFallback(libraries, metadata, options = {}) {
  return {
    library: null, confidence: 50, reason: 'AI could not determine classification - manual review needed',
    parse_failure_reason: options.parseFailureReason || 'unknown_parse_failure', needs_clarification: true,
    clarification: {
      problem_summary: 'Unable to auto-classify',
      why_uncertain: 'The AI classification returned an unexpected format. Manual review is recommended.',
      question: `Which library should "${metadata?.title || 'this item'}" be added to?`,
      options: choiceOptions(libraries),
    },
    libraries, format: 'fallback',
  };
}

export function createUnresolvedClassifyClarification(context, policyQuestion) {
  return {
    library: null, confidence: context.signalContext?.confidence || 55,
    reason: `Needs clarification: ${policyQuestion.problem_summary}`, needs_clarification: true,
    clarification: policyQuestion, pending_reason: policyQuestion.problem_summary,
    policy_question: policyQuestion, libraries: context.libraries, format: 'clarify',
  };
}

/** The parser supplies its existing clock value; this projection does not mint proof. */
export function createUnresolvedClassifyContractViolation(context, details, generatedAt) {
  const { libraries, metadata, signalContext } = context;
  if (!Array.isArray(libraries) || libraries.length === 0) return null;
  const matchedOptions = Array.isArray(details.matchedOptions) ? details.matchedOptions : [];
  const violationReason = details.violationReason || 'no_format_matched';
  const confidence = Number.isFinite(Number(signalContext?.confidence))
    ? Math.min(95, Math.max(50, Number(signalContext.confidence))) : 50;
  const policyQuestion = {
    problem_summary: 'AI response contract violation',
    why_uncertain: buildContractViolationWhyUncertain({ violationReason, targetLibrary: null }),
    question: `The AI returned an invalid classification response. Which library should "${metadata?.title || 'this item'}" be added to?`,
    options: choiceOptions(libraries, matchedOptions), generated_at: generatedAt,
    signal_breakdown: signalContext?.breakdown || [], calculated_confidence: signalContext?.confidence || null,
    meta: {
      suggested_library_id: null, suggested_library_name: null, parser_mode: 'classify',
      violation_reason: violationReason, validation_errors: details.validationErrors || null,
      requested_options: Array.isArray(details.requestedOptions) ? details.requestedOptions : [],
      matched_option_count: matchedOptions.length,
    },
  };
  return {
    library: null, confidence, reason: 'Needs clarification: AI response contract violation',
    needs_clarification: true, clarification: policyQuestion, pending_reason: 'AI response contract violation',
    policy_question: policyQuestion, validation_errors: details.validationErrors || null,
    libraries, format: 'contract_violation',
  };
}
