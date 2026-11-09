/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test } from '@jest/globals';
import { buildPolicyRuntimeReviewReference } from '../../services/policyRuntimeReviewReference.mjs';
import { buildPolicyRuntimeQuestionAnswerContract } from '../../services/policyRuntimeQuestionAnswerContract.mjs';
import { normalizePolicyRuntimeQuestion } from '../../services/policyRuntimeQuestionNormalizer.mjs';

const destinations = [{ library_id: 7, library_name: 'Comedy' }, { library_id: 8, library_name: 'Movies' }];
const ranked = [{ library_id: 8, policy_id: 18, score: 18, prompt_threshold: 60, auto_classify_threshold: 85 },
  { library_id: 7, policy_id: 17, score: 37, prompt_threshold: 60, auto_classify_threshold: 85 }];
const proposal = { version: 'policy.candidate_adjudication.v1', status_id: 'proposed', candidate_count: 2,
  proposed_destination: { library_id: 8, library_name: 'Foreign label' } };
function input(advice = proposal, rows = ranked) {
  return { candidateDestinations: destinations, question: { meta: { candidates: rows } },
    classification: { id: 44, media_type: 'movie', confidence: 99, metadata: {
      policyResult: { ranked: rows, thresholds: { prompt: 60, auto_classify: 85 } },
      classification_details: { candidate_adjudication: advice } } } };
}
describe('shared pending review reference', () => {
  test('retains the actual highest policy candidate while withholding an opposed primary offer', () => {
    const reference = buildPolicyRuntimeReviewReference(input());
    expect(reference).toMatchObject({ policyReference: { destination: destinations[0], candidate: ranked[1] },
      primaryDestination: null, advisoryDestination: destinations[1], reason: 'advisory_disagreement' });
    expect(JSON.stringify(reference.adjudication)).not.toContain('Foreign label');
    expect(buildPolicyRuntimeReviewReference({ ...input(), candidateDestinations: [...destinations].reverse() })).toEqual(reference);
  });
  test.each([null, { ...proposal, version: 'future' }, { ...proposal, status_id: 'abstained' },
    { ...proposal, status_id: 'rejected' }])('unavailable advice cannot choose or veto a policy candidate: %j', advice => {
    const reference = buildPolicyRuntimeReviewReference(input(advice));
    expect(reference.primaryDestination).toEqual(destinations[0]);
    expect(reference.advisoryDestination).toBeNull();
  });
  test('absent and legacy prose do not supply advisory proof', () => {
    const value = input(null);
    value.classification.metadata.classification_details = { ai_advisory: { proposed_destination: destinations[1] } };
    expect(buildPolicyRuntimeReviewReference(value).primaryDestination).toEqual(destinations[0]);
  });
  test.each([{ ...proposal, candidate_count: 0 }, { ...proposal, proposed_destination: { library_id: 99, library_name: 'Never display' } },
    { ...proposal, proposed_destination: { library_id: [8], library_name: 'Never coerce' } },
    { ...proposal, proposed_destination: { library_id: { toString: 'invalid', valueOf: null }, library_name: 'Never coerce' } },
    { ...proposal, proposed_destination: null }])('rejects a malformed/unbound current proposal: %j', advice => {
    const reference = buildPolicyRuntimeReviewReference(input(advice));
    expect(reference).toMatchObject({ primaryDestination: null, advisoryDestination: null, adjudication: null, reason: 'invalid_advisory_proposal' });
  });
  test('aligned advice leaves the policy candidate available without promoting the model', () => {
    expect(buildPolicyRuntimeReviewReference(input({ ...proposal, proposed_destination: destinations[0] })))
      .toMatchObject({ primaryDestination: destinations[0], reason: null });
  });
  test.each([null, '', undefined, NaN, Infinity, -1, 101])('missing/invalid score %s never falls back to history confidence', bad => {
    expect(buildPolicyRuntimeReviewReference(input(null, [{ library_id: 7, score: bad }])))
      .toMatchObject({ policyReference: null, primaryDestination: null, reason: 'policy_reference_unavailable' });
  });
  test('rounded ties require selection; only a coherent retained top can identify technical evidence', () => {
    const value = input(null, [{ library_id: 7, policy_id: 17, score: 37.1 }, { library_id: 8, policy_id: 18, score: 37.2 }]);
    expect(buildPolicyRuntimeReviewReference(value)).toMatchObject({ policyReference: null, primaryDestination: null, reason: 'policy_tie' });
    value.classification.metadata.policyResult.topCandidate = value.question.meta.candidates[1];
    expect(buildPolicyRuntimeReviewReference(value)).toMatchObject({ policyReference: { destination: destinations[1] }, primaryDestination: null, reason: 'policy_tie' });
    value.classification.metadata.policyResult.topCandidate = { library_id: 8, score: 37.2 };
    expect(buildPolicyRuntimeReviewReference(value).policyReference).toBeNull();
    value.classification.metadata.policyResult.topCandidate = { ...value.question.meta.candidates[1], policy_id: 99 };
    expect(buildPolicyRuntimeReviewReference(value).policyReference).toBeNull();
  });
  test.each(['duplicate', 'wrong_top', 'overflow'])('incoherent %s evidence cannot establish a primary reference', kind => {
    const value = input(null);
    if (kind === 'duplicate') value.classification.metadata.policyResult.ranked = [...ranked, ranked[1]];
    if (kind === 'wrong_top') value.classification.metadata.policyResult.topCandidate = ranked[0];
    if (kind === 'overflow') value.classification.metadata.policyResult.ranked = Array(65).fill(ranked[0]);
    expect(buildPolicyRuntimeReviewReference(value)).toMatchObject({ policyReference: null, primaryDestination: null });
  });
  test('answer summary, score, thresholds and fingerprint use one reference while explicit choices retain their meaning', () => {
    const value = input();
    const question = normalizePolicyRuntimeQuestion({ metadata: { media_type: 'movie' },
      libraries: destinations.map(destination => ({ id: destination.library_id, name: destination.library_name, media_type: 'movie', is_active: true })),
      policyResult: { ranked } });
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: value.classification, question });
    expect(contract.recommendation).toMatchObject({ version: 'policy.runtime_question_recommendation_presentation.v2', leading_destination: null,
      policy_destination: { ...destinations[0], evidence_score: 37 }, advisory_destination: destinations[1] });
    expect(contract.decision_summary.deterministic).toMatchObject({ destination: destinations[0], score: 37, review_threshold: 60, automatic_threshold: 85 });
    expect(contract.allowed_actions.find(action => action.id === 'confirm_destination')).toMatchObject({ available: true, destination_scope: 'candidate_destinations' });
    const withoutAdvice = buildPolicyRuntimeQuestionAnswerContract({ classification: input(null).classification, question });
    expect(withoutAdvice.fingerprint).not.toBe(contract.fingerprint);
  });
  test('unbound high historic evidence still blocks all resolution actions without inventing a destination', () => {
    const value = input(null, [{ library_id: 7, score: 90 }, { library_id: 8, score: 90 }]);
    value.classification.confidence = 90;
    value.classification.method = 'signal_calculation';
    value.classification.metadata.policyResult.action = 'auto_classify';
    const question = normalizePolicyRuntimeQuestion({ metadata: { media_type: 'movie' },
      libraries: destinations.map(destination => ({ id: destination.library_id, name: destination.library_name, media_type: 'movie', is_active: true })),
      policyResult: value.classification.metadata.policyResult });
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: value.classification, question });
    expect(contract.decision_summary.deterministic).toMatchObject({ destination: null, score: null, safety_gate: { id: 'historical_route_safety_details_unavailable' } });
    expect(contract.allowed_actions.filter(action => action.destination_required).every(action => !action.available)).toBe(true);
  });
  test('invalid candidate binding cannot remove historic high-score refusal when only per-candidate thresholds survive', () => {
    const value = input(null, [{ library_id: 7, score: 90, auto_classify_threshold: 85 },
      { library_id: 7, score: 90, auto_classify_threshold: 85 }, { library_id: 8, score: 90, auto_classify_threshold: 85 }]);
    delete value.classification.metadata.policyResult.thresholds;
    value.classification.method = 'signal_calculation';
    value.classification.confidence = null;
    const question = normalizePolicyRuntimeQuestion({ metadata: { media_type: 'movie' },
      libraries: destinations.map(destination => ({ id: destination.library_id, name: destination.library_name, media_type: 'movie', is_active: true })),
      policyResult: value.classification.metadata.policyResult });
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: value.classification, question });
    expect(contract.decision_summary.deterministic).toMatchObject({ destination: null, score: null,
      safety_gate: { id: 'historical_route_safety_details_unavailable' } });
    expect(contract.freshness.status).toBe('stale');
  });
  test.each(['global_policy', 'global_policy_string', 'other_candidate'])('separates legacy historic proof from a known policy gate (%s)', source => {
    const historical = source !== 'other_candidate';
    const rows = historical ? [{ library_id: 7, score: 75 }, { library_id: 8, score: 60 }]
      : [{ library_id: 7, score: 85 }, { library_id: 8, score: 90, auto_classify_threshold: 95 }];
    const value = input(null, rows);
    value.classification.method = 'signal_calculation';
    value.classification.metadata.policyResult.action = 'auto_classify';
    if (historical) {
      value.classification.metadata.policyResult.confidence = source === 'global_policy_string' ? '90.00' : 90;
      value.classification.metadata.policyResult.ranked = [];
    }
    const question = normalizePolicyRuntimeQuestion({ metadata: { media_type: 'movie' },
      libraries: destinations.map(destination => ({ id: destination.library_id, name: destination.library_name, media_type: 'movie', is_active: true })),
      policyResult: { ranked: rows } });
    question.options.sort((left, right) => left.library_id - right.library_id);
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: value.classification, question });
    expect(contract.decision_summary.deterministic).toMatchObject({ score: historical ? 75 : 90,
      safety_gate: { id: historical ? 'historical_route_safety_details_unavailable' : 'policy_score_below_automatic_threshold' } });
    expect(contract.freshness.status).toBe(historical ? 'stale' : 'current');
  });
  test('manual history confidence alone cannot invent a hold when a lower candidate score is bound', () => {
    const value = input(null, [{ library_id: 7, score: 75 }]);
    value.classification.method = 'signal_calculation';
    value.classification.confidence = 100;
    value.classification.metadata.policyResult.ranked = [];
    const question = normalizePolicyRuntimeQuestion({ metadata: { media_type: 'movie' },
      libraries: destinations.map(destination => ({ id: destination.library_id, name: destination.library_name, media_type: 'movie', is_active: true })),
      policyResult: { ranked: [{ library_id: 7, score: 75 }] } });
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: value.classification, question });
    expect(contract.decision_summary.deterministic.score).toBe(75);
    expect(contract.freshness.status).toBe('current');
  });
});
