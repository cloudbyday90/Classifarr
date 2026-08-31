/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  PolicyCandidateCorrectionPolicyChangeOutcomeObservationReceiptRequiredError,
  createPolicyCandidateCorrectionPolicyChangeOutcomeObservationService,
} from '../../services/policyCandidateCorrectionPolicyChangeOutcomeObservationService.mjs';

const HYPOTHESIS_ID = `pco_${'b'.repeat(32)}`;

function observationRow({ createdAt = '2026-08-01T12:00:00.000Z' } = {}) {
  return {
    hypothesis_id: HYPOTHESIS_ID,
    source_intent_version: 4,
    target_intent_version: 5,
    baseline_window_start_at: '2026-07-04T00:00:00.000Z',
    baseline_window_end_at: '2026-08-01T00:00:00.000Z',
    followup_window_start_at: '2026-08-02T00:00:00.000Z',
    followup_window_end_at: '2026-08-30T00:00:00.000Z',
    outcome_count: 0,
    confirmed_leader_outcome_count: 0,
    changed_to_candidate_outcome_count: 0,
    changed_outside_candidates_outcome_count: 0,
    routed_not_applicable_outcome_count: 0,
    created_at: createdAt,
    expires_at: '2026-09-29T00:00:00.000Z',
  };
}

function createHarness({ existingObservation = null, receipt = {
  id: 11,
  source_intent_version: 4,
  target_intent_version: 5,
} } = {}) {
  const client = { query: jest.fn() };
  const db = {
    query: jest.fn(),
    withTransaction: jest.fn(async callback => callback(client)),
  };
  const persistence = {
    acquireLock: jest.fn().mockResolvedValue(undefined),
    readObservation: jest.fn().mockResolvedValue(existingObservation),
    findRecentReceipt: jest.fn().mockResolvedValue(receipt),
    upsertObservation: jest.fn().mockResolvedValue(observationRow()),
  };
  const loadMetrics = jest.fn().mockResolvedValue([]);
  return {
    db,
    persistence,
    loadMetrics,
    service: createPolicyCandidateCorrectionPolicyChangeOutcomeObservationService({
      db,
      persistence,
      loadMetrics,
      randomHypothesisId: () => HYPOTHESIS_ID,
    }),
  };
}

describe('policy-change outcome observation service', () => {
  test('starts one receipt-bound aggregate observation without exposing receipt or policy identity', async () => {
    const { db, persistence, loadMetrics, service } = createHarness();

    const result = await service.startOutcomeObservation({
      actorId: 7,
      now: '2026-08-01T12:00:00.000Z',
    });

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(persistence.acquireLock).toHaveBeenCalledWith(expect.objectContaining({ client: expect.any(Object) }));
    expect(persistence.findRecentReceipt).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 7,
      notBefore: '2026-08-01T11:00:00.000Z',
      notAfter: '2026-08-01T12:00:00.000Z',
    }));
    expect(loadMetrics).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ days: 28 }));
    expect(persistence.upsertObservation).toHaveBeenCalledWith(expect.objectContaining({
      observation: expect.objectContaining({ sourceReceiptId: 11, actorId: 7 }),
    }));
    expect(result).toEqual(expect.objectContaining({ operationId: 'observation_started', statusId: 'observing' }));
    expect(JSON.stringify(result)).not.toContain('sourceReceiptId');
    expect(JSON.stringify(result)).not.toContain('policyId');
  });

  test('requires a recent approved native receipt instead of accepting a caller-selected policy', async () => {
    const { service } = createHarness({ receipt: null });

    await expect(service.startOutcomeObservation({ actorId: 7 }))
      .rejects.toBeInstanceOf(PolicyCandidateCorrectionPolicyChangeOutcomeObservationReceiptRequiredError);
  });

  test('uses the persisted fixed follow-up range for an available outcome', async () => {
    const { loadMetrics, service } = createHarness({ existingObservation: observationRow() });

    const result = await service.getOutcomeObservation({
      actorId: 7,
      now: '2026-08-31T00:00:00.000Z',
    });

    expect(result.statusId).toBe('outcome_available');
    expect(loadMetrics).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      start: new Date('2026-08-02T00:00:00.000Z'),
      end: new Date('2026-08-30T00:00:00.000Z'),
    }));
  });

  test('returns the completed fixed outcome when a duplicate start finds an active observation', async () => {
    const { loadMetrics, service } = createHarness({ existingObservation: observationRow() });

    const result = await service.startOutcomeObservation({
      actorId: 7,
      now: '2026-08-31T00:00:00.000Z',
    });

    expect(result).toEqual(expect.objectContaining({
      operationId: 'existing_observation',
      statusId: 'outcome_available',
      outcome: expect.objectContaining({ comparisonType: 'descriptive_only' }),
    }));
    expect(loadMetrics).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      start: new Date('2026-08-02T00:00:00.000Z'),
      end: new Date('2026-08-30T00:00:00.000Z'),
    }));
  });
});
