/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { types } from 'node:util';
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { recoveryField as field, recoveryItemIdentity, recoveryRows } from './policyRecoverySuggestionContract.mjs';
import { policyEvaluationPayloadBytes, freezePolicyEvaluationValue } from './policyEvaluationCaptureContract.mjs';
import { validFrozenPolicyPurposeEvidence } from './policyPurposeMatchEvidence.mjs';
import { CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';
import { POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS, POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS,
  POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS } from './policyCandidateEvidenceCardCore.mjs';
import { POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_SOURCE_IDS,
  POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS } from './policyRuntimeQuestionScoreExplanation.mjs';

export const CURRENT_POLICY_REVIEW_VERSION = 'policy.current_review.v1';
export const CURRENT_POLICY_REVIEW_BYTES = 65536;
export const CURRENT_POLICY_REVIEW_FACTS = Object.freeze(['similar_items', 'observed_profile',
  'observed_profile_difference', 'learned_pattern', 'prior_outcomes']);
export const unknownReviewPurpose = () => ({ version: 'policy.purpose_match_evidence.v1', origin: 'unverified',
  declaredMatch: 'not_evaluated', runtimeEligible: null, specificity: 'not_evaluated' });
const numeric = (value, max = 100) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const id = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
const exact = (value, keys) => value && !Array.isArray(value) && typeof value === 'object' &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const nullableScore = value => value === null || numeric(value);

/** Bounded own-data inspection before any producer/validator reads an object. No coercion or hooks. */
export function cloneReviewData(value, depth = 0, budget = { values: 8192 }) {
  if (--budget.values < 0 || depth > 12) throw new Error('current_policy_review_invalid');
  if (value === null || typeof value === 'boolean' || typeof value === 'string' && value.length <= 2048 ||
      typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || types.isProxy(value)) throw new Error('current_policy_review_invalid');
  if (Array.isArray(value)) return recoveryRows(value, 64).map(row => cloneReviewData(row, depth + 1, budget));
  // field() checks the prototype as well as every own descriptor.
  const keys = Object.keys(value);
  if (keys.length > 64) throw new Error('current_policy_review_invalid');
  return Object.fromEntries(keys.map(key => {
    if (key.length > 128) throw new Error('current_policy_review_invalid');
    return [key, cloneReviewData(field(value, key), depth + 1, budget)];
  }));
}

function validCard(card) {
  const sources = Object.values(POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS);
  return exact(card, ['version', 'status_id', 'sources', 'purpose_evidence']) &&
    card.version === 'policy.candidate_evidence_card.v2' && Object.values(POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS).includes(card.status_id) &&
    Array.isArray(card.sources) && card.sources.length === 5 && card.sources.every((row, index) =>
      exact(row, ['source_id', 'state_id']) && row.source_id === sources[index] &&
      Object.values(POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS).includes(row.state_id)) &&
    (validFrozenPolicyPurposeEvidence(card.purpose_evidence) ||
      exact(card.purpose_evidence, Object.keys(unknownReviewPurpose())) &&
      Object.entries(unknownReviewPurpose()).every(([key, value]) => card.purpose_evidence[key] === value));
}

function validExplanation(value, candidateScore) {
  if (value === null) return true;
  return exact(value, ['version', 'score', 'base_score', 'agreement_multiplier_percent', 'components', 'calibration']) &&
    value.version === 'policy.runtime_question_score_explanation.v1' && value.score === Math.round(candidateScore) &&
    numeric(value.base_score, 100.3) && numeric(value.agreement_multiplier_percent, 130) && value.agreement_multiplier_percent >= 100 &&
    Array.isArray(value.components) && value.components.length >= 1 && value.components.length <= 6 &&
    new Set(value.components.map(row => row.source_id)).size === value.components.length && value.components.every(row =>
      exact(row, ['source_id', 'evidence_score', 'normalized_weight_percent', 'weighted_contribution']) &&
      Object.values(POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_SOURCE_IDS).includes(row.source_id) &&
      [row.evidence_score, row.normalized_weight_percent, row.weighted_contribution].every(number => numeric(number))) &&
    exact(value.calibration, ['status_id', 'pre_safety_score']) && nullableScore(value.calibration.pre_safety_score) &&
    Object.values(POLICY_RUNTIME_QUESTION_SCORE_EXPLANATION_CALIBRATION_STATUS_IDS).includes(value.calibration.status_id);
}

/** Only a closed, row/item-bound current view can replace the legacy review source. */
export function readCurrentPolicyReviewFrame(value, classification) {
  try {
    const frame = cloneReviewData(value);
    if (!exact(frame, ['version', 'classification_id', 'identity_key', 'method', 'status', 'policy']) ||
        frame.version !== CURRENT_POLICY_REVIEW_VERSION || !canonicalDatabaseBigintId(frame.classification_id) ||
        frame.classification_id !== canonicalDatabaseBigintId(field(classification, 'id') ?? field(classification, 'classification_id')) ||
        frame.identity_key !== recoveryItemIdentity(classification) || !frame.identity_key ||
        !CLASSIFIER_CAPTURE_METHODS.includes(frame.method) || frame.method !== field(classification, 'method') ||
        policyEvaluationPayloadBytes(frame) > CURRENT_POLICY_REVIEW_BYTES) return null;
    if (frame.status === 'evidence_gap') return frame.policy === null ? freezePolicyEvaluationValue(frame) : null;
    const policy = frame.policy;
    if (frame.status !== 'recorded' || !exact(policy, ['action', 'confidence', 'thresholds', 'ranked']) ||
        policy.action !== 'prompt_confirm' || !numeric(policy.confidence) ||
        !exact(policy.thresholds, ['auto_classify', 'prompt', 'prompt_select']) ||
        !Object.values(policy.thresholds).every(nullableScore) || !Array.isArray(policy.ranked) ||
        !policy.ranked.length || policy.ranked.length > 64) return null;
    const pairs = new Set();
    for (const [index, row] of policy.ranked.entries()) {
      if (!exact(row, ['policy_id', 'library_id', 'score', 'auto_classify_threshold', 'prompt_threshold', 'origin', 'revision', 'detail']) ||
          !id(row.policy_id) || !id(row.library_id) || !numeric(row.score) ||
          !nullableScore(row.auto_classify_threshold) || !nullableScore(row.prompt_threshold) ||
          !(row.origin === 'native_intent' && id(row.revision) || row.origin === 'compatibility_bridge' && row.revision === null) ||
          pairs.has(`${row.policy_id}:${row.library_id}`)) return null;
      pairs.add(`${row.policy_id}:${row.library_id}`);
      if (index >= 5) { if (row.detail !== null) return null; continue; }
      if (!exact(row.detail, ['card', 'explanation', 'facts']) || !validCard(row.detail.card) ||
          !validExplanation(row.detail.explanation, row.score) || !Array.isArray(row.detail.facts) ||
          new Set(row.detail.facts).size !== row.detail.facts.length ||
          !row.detail.facts.every(fact => CURRENT_POLICY_REVIEW_FACTS.includes(fact))) return null;
    }
    return freezePolicyEvaluationValue(frame);
  } catch { return null; }
}
