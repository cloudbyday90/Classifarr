/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  PolicyCandidateCorrectionPolicyChangeDecisionRecordOutcomeNotReadyError,
  PolicyCandidateCorrectionPolicyChangeDecisionRecordRevisionConflictError,
  createPolicyCandidateCorrectionPolicyChangeDecisionRecordService,
} from '../../services/policyCandidateCorrectionPolicyChangeDecisionRecordService.mjs';

const HYPOTHESIS_ID = `pco_${'f'.repeat(32)}`;

function observationRow({ followupEndAt = '2026-08-30T00:00:00.000Z' } = {}) {
  return {
    hypothesis_id: HYPOTHESIS_ID,
    source_intent_version: 4,
    target_intent_version: 5,
    baseline_window_start_at: '2026-07-04T00:00:00.000Z',
    baseline_window_end_at: '2026-08-01T00:00:00.000Z',
    followup_window_start_at: '2026-08-02T00:00:00.000Z',
    followup_window_end_at: followupEndAt,
    outcome_count: 0,
    confirmed_leader_outcome_count: 0,
    changed_to_candidate_outcome_count: 0,
    changed_outside_candidates_outcome_count: 0,
    routed_not_applicable_outcome_count: 0,
    created_at: '2026-08-01T12:00:00.000Z',
    expires_at: '2026-09-29T00:00:00.000Z',
  };
}

function decisionRow({ revision = 1, decisionId = 'retain_current_policy' } = {}) {
  return {
    observation_hypothesis_id: HYPOTHESIS_ID,
    decision_id: decisionId,
    rationale_id: 'outcome_improved',
    revision,
    created_at: '2026-08-31T01:00:00.000Z',
    updated_at: '2026-08-31T01:00:00.000Z',
    expires_at: '2026-09-29T00:00:00.000Z',
  };
}

function createHarness({
  observation = observationRow(),
  existingDecision = null,
  insertedDecision = decisionRow(),
  updatedDecision = decisionRow({ revision: 2, decisionId: 'investigate_policy_evidence' }),
} = {}) {
  const client = { query: jest.fn() };
  const db = {
    query: jest.fn(),
    withTransaction: jest.fn(async callback => callback(client)),
  };
  const persistence = {
    acquireObservationLock: jest.fn().mockResolvedValue(undefined),
    readObservation: jest.fn().mockResolvedValue(observation),
    readDecisionRecord: jest.fn().mockResolvedValue(existingDecision),
    insertDecisionRecord: jest.fn().mockResolvedValue(insertedDecision),
    updateDecisionRecord: jest.fn().mockResolvedValue(updatedDecision),
  };
  return {
    db,
    persistence,
    service: createPolicyCandidateCorrectionPolicyChangeDecisionRecordService({ db, persistence }),
  };
}

describe('policy-change decision record service', () => {
  test('records a fixed manual conclusion only after the bounded outcome has completed', async () => {
    const { db, persistence, service } = createHarness();

    const result = await service.createDecisionRecord({
      actorId: 7,
      decisionId: 'retain_current_policy',
      rationaleId: 'outcome_improved',
      now: '2026-08-31T12:00:00.000Z',
    });

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(persistence.acquireObservationLock).toHaveBeenCalledWith({ client: expect.any(Object) });
    expect(persistence.insertDecisionRecord).toHaveBeenCalledWith(expect.objectContaining({
      record: expect.objectContaining({
        observationHypothesisId: HYPOTHESIS_ID,
        actorId: 7,
        decisionId: 'retain_current_policy',
      }),
    }));
    expect(result).toEqual(expect.objectContaining({ statusId: 'decision_recorded' }));
    expect(JSON.stringify(result)).not.toContain('actorId');
    expect(JSON.stringify(result)).not.toContain('policyId');
  });

  test('fails closed before the server-owned outcome window completes', async () => {
    const { persistence, service } = createHarness({
      observation: observationRow({ followupEndAt: '2026-09-30T00:00:00.000Z' }),
    });

    await expect(service.createDecisionRecord({
      actorId: 7,
      decisionId: 'retain_current_policy',
      rationaleId: 'outcome_improved',
      now: '2026-08-31T12:00:00.000Z',
    })).rejects.toBeInstanceOf(PolicyCandidateCorrectionPolicyChangeDecisionRecordOutcomeNotReadyError);
    expect(persistence.insertDecisionRecord).not.toHaveBeenCalled();
  });

  test('rejects a stale revision without overwriting the existing conclusion', async () => {
    const { persistence, service } = createHarness({ existingDecision: decisionRow({ revision: 2 }) });

    await expect(service.reviseDecisionRecord({
      actorId: 7,
      decisionId: 'investigate_policy_evidence',
      rationaleId: 'outcome_unchanged_or_inconclusive',
      expectedRevision: 1,
      now: '2026-08-31T12:00:00.000Z',
    })).rejects.toBeInstanceOf(PolicyCandidateCorrectionPolicyChangeDecisionRecordRevisionConflictError);
    expect(persistence.updateDecisionRecord).not.toHaveBeenCalled();
  });

  test('revises a current conclusion through the compare-and-swap revision', async () => {
    const { persistence, service } = createHarness({ existingDecision: decisionRow({ revision: 1 }) });

    const result = await service.reviseDecisionRecord({
      actorId: 7,
      decisionId: 'investigate_policy_evidence',
      rationaleId: 'outcome_unchanged_or_inconclusive',
      expectedRevision: 1,
      now: '2026-08-31T12:00:00.000Z',
    });

    expect(persistence.updateDecisionRecord).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 1 }));
    expect(result.decision).toEqual(expect.objectContaining({
      decisionId: 'investigate_policy_evidence',
      revision: 2,
    }));
  });
});
