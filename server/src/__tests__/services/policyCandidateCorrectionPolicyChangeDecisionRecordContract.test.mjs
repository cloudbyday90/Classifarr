/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionPolicyChangeDecisionRecordReadModel,
  normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordExpectedRevision,
  normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordInput,
} from '../../services/policyCandidateCorrectionPolicyChangeDecisionRecordContract.mjs';

const HYPOTHESIS_ID = `pco_${'d'.repeat(32)}`;

function observationRow() {
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
    created_at: '2026-08-01T12:00:00.000Z',
    expires_at: '2026-09-29T00:00:00.000Z',
  };
}

function decisionRow() {
  return {
    observation_hypothesis_id: HYPOTHESIS_ID,
    decision_id: 'investigate_policy_evidence',
    rationale_id: 'outcome_unchanged_or_inconclusive',
    revision: 2,
    created_at: '2026-08-31T01:00:00.000Z',
    updated_at: '2026-08-31T02:00:00.000Z',
    expires_at: '2026-09-29T00:00:00.000Z',
    created_by_actor_id: 7,
  };
}

describe('policy-change decision record contract', () => {
  test('projects only a matching completed aggregate decision without internal actor or policy identity', () => {
    const result = buildPolicyCandidateCorrectionPolicyChangeDecisionRecordReadModel({
      observation: observationRow(),
      decisionRecord: decisionRow(),
      now: '2026-08-31T12:00:00.000Z',
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'decision_recorded',
      reviewAvailable: true,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
      decision: expect.objectContaining({ revision: 2 }),
    }));
    expect(JSON.stringify(result)).not.toContain('created_by_actor_id');
    expect(JSON.stringify(result)).not.toContain('policyId');
    expect(JSON.stringify(result)).not.toContain('sourceIntentVersion');
  });

  test('requires the current observation identity and shared expiry before exposing a saved decision', () => {
    const mismatchedDecision = {
      ...decisionRow(),
      observation_hypothesis_id: `pco_${'e'.repeat(32)}`,
    };

    expect(buildPolicyCandidateCorrectionPolicyChangeDecisionRecordReadModel({
      observation: observationRow(),
      decisionRecord: mismatchedDecision,
      now: '2026-08-31T12:00:00.000Z',
    })).toEqual(expect.objectContaining({ statusId: 'review_ready', decision: null }));
  });

  test('allows only fixed conclusion IDs and a positive optimistic-concurrency revision', () => {
    expect(normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordInput({
      decisionId: 'retain_current_policy',
      rationaleId: 'outcome_improved',
    })).toEqual({ decisionId: 'retain_current_policy', rationaleId: 'outcome_improved' });
    expect(normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordInput({
      decisionId: 'edit_policy',
      rationaleId: 'free_text',
    })).toBeNull();
    expect(normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordExpectedRevision(2)).toBe(2);
    expect(normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordExpectedRevision(0)).toBeNull();
  });
});
