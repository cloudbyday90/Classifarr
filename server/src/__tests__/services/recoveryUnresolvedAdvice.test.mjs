/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, () => {}]));
jest.unstable_mockModule('../../utils/logger.mjs', () => ({ createLogger: () => logger }));
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: async () => ({ rows: [], rowCount: 0 }) }));
const { buildAiUnavailableResult, resolveAiUnavailableResult } = await import('../../services/classificationPathServiceShared.mjs');
const { ensureDecisionQuestion } = await import('../../services/classificationRoutingServiceShared.mjs');
const { buildPendingRetryResult } = await import('../../services/classificationAiFailureUtils.mjs');
const { evaluateClassificationRouteSafety } = await import('../../services/classificationRouteSafetyGate.mjs');
const { buildPolicyRuntimeQuestionAnswerContract } = await import('../../services/policyRuntimeQuestionAnswerContract.mjs');
const { ClassificationService } = await import('../../services/classificationServiceCore.mjs');
const metadata = { title: 'Owned recovery item', tmdb_id: 884413, media_type: 'movie' };
const libraries = [{ id: 11, name: 'First arbitrary label', media_type: 'movie', is_active: true },
  { id: 22, name: 'Movies', media_type: 'movie', is_active: true }];
const args = (pool = libraries) => ({ isTransientAiAvailability: false, confidence: 65, suggestedLibrary: null,
  libraries: pool, signalContext: { confidence: 65 }, transientError: new Error('PRIVATE provider failure'),
  previousRetryCount: 2, maxRetries: 4, buildPendingRetryResult: jest.fn(buildPendingRetryResult),
  signalCalculationReason: 'Existing signal advice' });

for (const [name, pool] of [['original', libraries], ['reversed', [...libraries].reverse()],
  ['renamed', libraries.map(library => ({ ...library, name: 'Category-neutral ' + library.id }))],
  ['single', libraries.slice(0, 1)], ['empty', []]]) {
  test.each([50, 65, 99])('no-suggestion recovery is neutral with ' + name + ' pool and confidence %s', confidence => {
    const options = { ...args(pool), confidence };
    const result = buildAiUnavailableResult(options);
    expect(result).toMatchObject({ library: null, confidence: 50, method: 'fallback', libraries: pool,
      provider_recovery: { version: 'provider_recovery.v1', mode: 'review_required' } });
    expect(result.reason).toBe('AI unavailable - choose a destination for this item');
    expect(result.reason).not.toContain('PRIVATE');
    expect(options.buildPendingRetryResult).not.toHaveBeenCalled();
    expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(false);
    expect(ClassificationService.prototype.buildAutoRouteDecision.call({}, { result })).toEqual({ shouldRoute: false, reason: 'no_library' });
  });
}

test.each([[false, 49, 49], [false, undefined, 0], [true, 99, 99]])(
  'retry authority and exact producer arguments stay unchanged: transient=%s confidence=%s', (transient, confidence, normalized) => {
    const options = { ...args(), isTransientAiAvailability: transient, confidence };
    const before = Date.now(), result = buildAiUnavailableResult(options), after = Date.now();
    expect(options.buildPendingRetryResult).toHaveBeenCalledTimes(1);
    expect(options.buildPendingRetryResult).toHaveBeenCalledWith({ confidence: normalized, libraries,
      signalContext: options.signalContext, transientError: options.transientError, previousRetryCount: 2, maxRetries: 4 });
    expect(result).toMatchObject({ library: null, method: 'queued_for_retry', needs_retry: true, retry_count: 3, max_retries: 4,
      provider_recovery: { version: 'provider_recovery.v1', mode: 'retry_queued' } });
    expect(result.retry_after.getTime()).toBeGreaterThanOrEqual(before + 300000);
    expect(result.retry_after.getTime()).toBeLessThanOrEqual(after + 300000);
  });

test('existing signal-calculation advice remains separate and supplies no route permission', () => {
  const suggestedLibrary = { id: 999, name: 'Unbound retained advice' };
  const result = buildAiUnavailableResult({ ...args(), suggestedLibrary, signalCalculationResultFields: { preserved: 17 } });
  expect(result).toMatchObject({ library: suggestedLibrary, confidence: 65, method: 'signal_calculation',
    reason: 'Existing signal advice', preserved: 17 });
  expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(false);
});

test.each([null, { action: 'prompt_confirm', ranked: [{ library_id: 11, score: 70 }, { library_id: 22, score: 30 }] }])(
  'normalization rejects positional proof while retaining independent policy evidence: %j', async policyResult => {
    const result = await resolveAiUnavailableResult({ ...args(), metadata, policyResult, ensureDecisionQuestion });
    expect(result.library).toBeNull(); expect(result.needs_clarification).toBe(true);
    expect(result.route_safety).toMatchObject({ automatic_route_allowed: false,
      primary_gate: { id: 'provider_recovery_review_required' } });
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: { ...metadata,
      id: 44, status: 'awaiting_decision', metadata: { policyResult } }, question: result.policy_question });
    expect(contract.candidate_destinations.map(destination => destination.library_id)).toEqual([11, 22]);
    expect(contract.recommendation.leading_destination?.library_id ?? null).toBe(policyResult ? 11 : null);
  });

test('retry results still bypass question construction', async () => {
  const normalize = jest.fn();
  const result = await resolveAiUnavailableResult({ ...args(), isTransientAiAvailability: true, metadata, ensureDecisionQuestion: normalize });
  expect(result.needs_retry).toBe(true); expect(normalize).not.toHaveBeenCalled();
});
