/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import { createPolicyCandidateConsensusService } from '../../services/policyCandidateConsensusService.mjs';
import { hasCandidateConsensusReceipt } from '../../services/policyCandidateConsensusReceipt.mjs';
import { evaluateClassificationRouteSafety } from '../../services/classificationRouteSafetyGate.mjs';
import { ClassificationService } from '../../services/classificationServiceCore.mjs';
import { consensusDependencies, consensusFixture } from '../fixtures/policyCandidateConsensusFixture.mjs';

async function admitted(now = Date.now()) {
  const input = consensusFixture();
  const result = await createPolicyCandidateConsensusService({ ...consensusDependencies(input), now: () => now }).resolve(input);
  return { input, result, now };
}

describe('in-memory consensus routing authority', () => {
  test('survives server object spreads, never persisted JSON or a forged method label', async () => {
    const { result } = await admitted();
    expect(hasCandidateConsensusReceipt({ ...result })).toBe(true);
    expect(hasCandidateConsensusReceipt(JSON.parse(JSON.stringify(result)))).toBe(false);
    expect(hasCandidateConsensusReceipt({ method: 'library_consensus_auto', confidence: 99 })).toBe(false);
    expect(hasCandidateConsensusReceipt(null)).toBe(false);
  });

  test.each([
    ['expired', (r, n) => ({ now: n + 60001 })],
    ['future', (r, n) => ({ now: n - 1 })],
    ['invalid clock', () => ({ now: NaN })],
    ['wrong identity', () => ({ metadata: { tmdb_id: 1000, media_type: 'movie' } })],
    ['wrong media', () => ({ metadata: { tmdb_id: 999, media_type: 'tv' } })],
    ['changed destination', r => { r.library = { ...r.library, id: 3 }; return {}; }],
    ['changed policy', r => { r.policyResult.ranked[1].score = 90; return {}; }],
    ['changed score', r => { r.confidence = 99; return {}; }],
    ['changed proposal', r => { r.candidate_adjudication.proposedDestination.library_id = 3; return {}; }],
    ['changed status', r => { r.candidate_adjudication.statusId = 'abstained'; return {}; }],
    ['changed format', r => { r.format = 'fallback'; return {}; }],
    ['retry', r => { r.needs_retry = true; return {}; }],
    ['clarification', r => { r.needs_clarification = true; return {}; }],
  ])('rejects %s authority', async (_name, mutate) => {
    const { result, now } = await admitted();
    expect(hasCandidateConsensusReceipt(result, mutate(result, now))).toBe(false);
  });

  test('question construction and final route decision both accept valid server consensus', async () => {
    const { input, result } = await admitted();
    expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(true);
    expect(ClassificationService.prototype.buildAutoRouteDecision({ result, metadata: input.metadata }))
      .toEqual({ shouldRoute: true, reason: 'library_consensus' });
    expect(ClassificationService.prototype.buildAutoRouteDecision({ result }).shouldRoute).toBe(false);
  });

  test('retains administrator, provider-recovery and model-authority vetoes', async () => {
    const { input, result } = await admitted();
    expect(evaluateClassificationRouteSafety({ result, requireAllConfirmations: true }).automatic_route_allowed).toBe(false);
    expect(ClassificationService.prototype.buildAutoRouteDecision({ result, metadata: input.metadata, requireAllConfirmations: true }).shouldRoute).toBe(false);
    for (const extra of [{ provider_recovery: { version: 'provider_recovery.v1', mode: 'review_required' } },
      { ai_authority: { sideEffects: { canRoute: false } } }]) {
      const guarded = { ...result, ...extra };
      expect(evaluateClassificationRouteSafety({ result: guarded }).automatic_route_allowed).toBe(false);
      expect(ClassificationService.prototype.buildAutoRouteDecision({ result: guarded, metadata: input.metadata }).shouldRoute).toBe(false);
    }
  });

  test('calls Arr only with a valid, identity-bound receipt', async () => {
    const { input, result } = await admitted();
    const service = {
      resolvePolicyAutoThreshold: () => 85,
      buildAutoRouteDecision: ClassificationService.prototype.buildAutoRouteDecision,
      routeToArr: jest.fn(async () => ({ attempted: true, routed: true })),
      logger: { debug: jest.fn() },
      classificationRoutingMetadataPersistenceService: { persist: jest.fn() },
      db: { query: jest.fn(async () => ({ rowCount: 1 })) },
      ensureDecisionQuestion: jest.fn(async ({ result: pending }) => { pending.policy_question = { question: 'Choose a destination' }; }),
    };
    await ClassificationService.prototype.routeClassificationResult.call(service, 123, input.metadata, result, false);
    expect(service.routeToArr).toHaveBeenCalledWith(input.metadata, input.libraries[1]);
    expect(service.classificationRoutingMetadataPersistenceService.persist).toHaveBeenCalledWith({ classificationId: 123, routing: 'routed', status: 'routed' });
    service.routeToArr.mockClear();
    const denied = await ClassificationService.prototype.routeClassificationResult.call(service, 123, input.metadata, JSON.parse(JSON.stringify(result)), false);
    expect(denied.shouldRoute).toBe(false);
    expect(service.routeToArr).not.toHaveBeenCalled();
    expect(service.db.query).toHaveBeenCalledWith(expect.stringContaining("status = 'awaiting_decision'"),
      ['Fresh comparison required', JSON.stringify({ question: 'Choose a destination' }), 123, 'library_consensus_auto']);
  });
});
