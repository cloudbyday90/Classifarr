/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { recoveryField as field, recoveryRows, recoveryDecisionSnapshot, recoveryItemIdentity } from './policyRecoverySuggestionContract.mjs';
import { holdPolicyEvaluationCapture, projectHeldPolicyEvaluationCapture } from './policyEvaluationCapture.mjs';
import { freezePolicyEvaluationValue } from './policyEvaluationCaptureContract.mjs';
import { composePolicyCandidateEvidenceCard } from './policyCandidateEvidenceCard.mjs';
import { buildPolicyRuntimeQuestionScoreExplanation } from './policyRuntimeQuestionScoreExplanation.mjs';
import { cloneReviewData, unknownReviewPurpose } from './currentPolicyReviewFrameContract.mjs';

const pick = (value, keys) => Object.fromEntries(keys.flatMap(key => {
  const entry = field(value, key);
  return entry === undefined ? [] : [[key, entry]];
}));

/** Freeze mechanics at evaluation completion, never later from a mutable raw diagnostic body. */
function detail(candidate, purpose, metadata) {
  try {
    const raw = field(candidate, 'candidate_diagnostics') ?? field(candidate, 'candidateDiagnostics') ?? {};
    const diagnostic = pick(raw, ['profile_observed_absence_advisory', 'profile_hard_excluded', 'primary_viability']);
    const positive = field(raw, 'positive_sources') ?? field(raw, 'positiveSources') ?? {};
    diagnostic.positive_sources = pick(positive, ['profile', 'rag', 'pattern', 'history']);
    diagnostic.suppression_reasons = recoveryRows(field(raw, 'suppression_reasons') ?? [], 64)
      .filter(reason => ['policy_constraint_conflict', 'profile_hard_exclusion'].includes(reason));
    const rag = field(raw, 'rag_evidence_quality') ?? {};
    const matches = field(rag, 'matches');
    if (matches !== undefined && recoveryRows(matches, 64).length) diagnostic.positive_sources.rag = true;
    diagnostic.score_calibration = pick(field(raw, 'score_calibration') ?? {}, ['applied', 'raw_score', 'calibrated_score', 'reason_code']);
    diagnostic.inventory_comparison = pick(field(raw, 'inventory_comparison') ?? {}, ['status_id']);
    const breakdown = recoveryRows(field(candidate, 'breakdown') ?? [], 64).map(row => pick(row, ['type', 'score', 'activeWeight']));
    const safe = cloneReviewData({ score: field(candidate, 'score'), candidate_diagnostics: diagnostic, breakdown });
    const facts = [];
    if (safe.candidate_diagnostics.positive_sources.rag === true) facts.push('similar_items');
    if (safe.candidate_diagnostics.positive_sources.profile === true) facts.push('observed_profile');
    if (diagnostic.profile_observed_absence_advisory === true) facts.push('observed_profile_difference');
    if (safe.candidate_diagnostics.positive_sources.pattern === true) facts.push('learned_pattern');
    if (safe.candidate_diagnostics.positive_sources.history === true) facts.push('prior_outcomes');
    return { card: composePolicyCandidateEvidenceCard({ classification: metadata, candidate: safe }, purpose),
      explanation: buildPolicyRuntimeQuestionScoreExplanation({ candidate: safe }), facts };
  } catch {
    return { card: composePolicyCandidateEvidenceCard({ classification: { media_type: metadata.media_type, tmdb_id: metadata.tmdb_id } }, purpose),
      explanation: null, facts: [] };
  }
}

export function captureCurrentPolicyReviewSeed(policyResult, metadata) {
  try {
    const numeric = recoveryDecisionSnapshot(policyResult), identity = recoveryItemIdentity(metadata);
    if (!identity) return null;
    const held = holdPolicyEvaluationCapture({ policyResult }, metadata);
    const capture = projectHeldPolicyEvaluationCapture(held, { policyResult }, metadata);
    const proven = capture?.reasonId === 'complete' && capture.payload?.version === 'policy_evaluation.v2'
      ? capture.payload.candidates : [];
    const candidates = recoveryRows(field(policyResult, 'ranked'), 64);
    const ranked = numeric.ranked.map((row, index) => ({ policy_id: row[0], library_id: row[1], score: row[2],
      auto_classify_threshold: row[3], prompt_threshold: row[4], origin: row[5][0], revision: row[5][3],
      detail: index >= 5 ? null : detail(candidates[index], proven.find(candidate => candidate.policyId === row[0] &&
        candidate.libraryId === row[1])?.purposeEvidence ?? unknownReviewPurpose(), metadata) }));
    return freezePolicyEvaluationValue({ identity, policy: { action: numeric.action, confidence: numeric.confidence,
      thresholds: Object.fromEntries(['auto_classify', 'prompt', 'prompt_select'].map((key, index) => [key, numeric.thresholds[index]])), ranked } });
  } catch { return null; }
}
