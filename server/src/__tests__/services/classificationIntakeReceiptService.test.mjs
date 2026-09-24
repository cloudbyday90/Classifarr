/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { ClassificationIntakeReceiptService } from '../../services/classificationIntakeReceiptService.mjs';
import { buildClassificationIntakeComparison } from '../../services/classificationIntakeComparison.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';

test('captures only bounded matching original decisions and keeps capture failures advisory', async () => {
  const repository = { upsert: jest.fn().mockResolvedValue(true) };
  const service = new ClassificationIntakeReceiptService({ repository });
  const capture = buildClassificationDestinationDecision({ metadata: { media_type: 'tv', tmdb_id: 42 },
    method: 'ai_analysis', status: 'completed', libraryId: 2 });
  expect(await service.recordClassification(7, 11, null, capture)).toBe(true);
  expect(repository.upsert.mock.calls[0][0][6]).toEqual({ classificationId: 11, capture });
  expect(await service.record({ taskId: 7, classificationId: 11, decisionContext: { classificationId: 12, capture } })).toBe(false);
  expect(await service.recordClassification(7, 11, null, { ...capture, title: 'private' })).toBe(true);
  expect(repository.upsert.mock.calls[1][0][6]).toBeNull();
});

test('accepts only fixed comparison diagnostics, not arbitrary provider or media text', async () => {
  const repository = { upsert: jest.fn().mockResolvedValue(true) };
  const service = new ClassificationIntakeReceiptService({ repository });
  expect(await service.record({ taskId: 7, classificationId: 11,
    comparison: { statusId: 'not_captured', reasonId: 'retrieval_unavailable' },
    title: 'Private title', payload: { api_key: 'secret' } })).toBe(true);
  expect(repository.upsert).toHaveBeenCalledWith([
    7, null, 11, 'not_captured', 'retrieval_unavailable', null, null,
  ]);
  expect(await service.record({ taskId: 7, classificationId: 11,
    comparison: { statusId: 'not_captured', reasonId: 'private endpoint token' } })).toBe(false);
  expect(await service.record({ taskId: 7, classificationId: 11,
    comparison: { statusId: 'captured', reasonId: 'private endpoint token' } })).toBe(false);
  expect(await service.record({ taskId: 7, classificationId: 11, comparison: false })).toBe(false);
  expect(repository.upsert).toHaveBeenCalledTimes(1);
});

test('normalizes failure code and rejects malformed task, transition and attempt identities', async () => {
  const repository = { upsert: jest.fn().mockResolvedValue(true) };
  const service = new ClassificationIntakeReceiptService({ repository });
  expect(await service.recordTerminal(8, 'failed', 2, 'provider url=https://private')).toBe(true);
  expect(repository.upsert).toHaveBeenCalledWith([
    8, 2, null, null, null, 'task_processing_failed', null,
  ]);
  expect(await service.record({ taskId: '8', transition: 'queued' })).toBe(false);
  expect(await service.record({ taskId: 8, transition: 'routed' })).toBe(false);
  expect(await service.record({ taskId: 8, attempts: -1 })).toBe(false);
  expect(repository.upsert).toHaveBeenCalledTimes(1);
});

test('receipt failures stay advisory and log only fixed, rate-limited codes', async () => {
  const logger = { warn: jest.fn() };
  const repository = { upsert: jest.fn().mockRejectedValue(new Error('secret value')) };
  const service = new ClassificationIntakeReceiptService({ repository, logger, now: () => 100000 });
  expect(await service.recordQueued(1)).toBe(false);
  expect(await service.recordQueued(2)).toBe(false);
  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('secret value');
  expect(logger.warn).toHaveBeenCalledWith('Classification intake receipt could not be recorded',
    { reasonCode: 'receipt_write_failed', suppressedWarnings: 0 });
});

test('reconciliation and expiry are independent and bounded by repository policy', async () => {
  const repository = { reconcile: jest.fn().mockRejectedValue(new Error('private')),
    reconcileClassificationLinks: jest.fn().mockResolvedValue(2),
    prune: jest.fn().mockResolvedValue(3) };
  const logger = { warn: jest.fn() };
  const service = new ClassificationIntakeReceiptService({ repository, logger, now: () => 100000 });
  expect(await service.reconcileAndPrune()).toEqual({ reconciled: 0, linked: 2, pruned: 3 });
  expect(logger.warn).toHaveBeenCalledWith(expect.any(String),
    expect.objectContaining({ reasonCode: 'receipt_reconcile_failed' }));
});

test('comparison projection does not interpret absent evidence as a routing grant', () => {
  expect(buildClassificationIntakeComparison({ mediaType: 'movie' }))
    .toEqual({ statusId: 'not_captured', reasonId: 'no_policy_result' });
  expect(buildClassificationIntakeComparison({ mediaType: 'audio', result: { policyResult: {} } }))
    .toEqual({ statusId: 'not_captured', reasonId: 'not_applicable_media' });
  expect(buildClassificationIntakeComparison({ mediaType: 'tv', result: {
    policyResult: { inventoryRankingShadowReasonId: 'retrieval_mismatch' },
  } })).toEqual({ statusId: 'not_captured', reasonId: 'retrieval_mismatch' });
  expect(buildClassificationIntakeComparison({ mediaType: 'movie', capture: {} }))
    .toEqual({ statusId: 'captured', reasonId: null });
});
