/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  createHeldOutSemanticStudyCohortPlanner,
  HELD_OUT_SEMANTIC_STUDY_COHORT_STATUS_IDS,
  HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA,
} from '../../services/heldOutSemanticStudyCohortPlanner.mjs';

function candidates(perStratum = 7) {
  let id = 1;
  return HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA.flatMap((stratum) => Array.from(
    { length: perStratum },
    () => ({
      metadata: {
        media_type: id % 2 ? 'movie' : 'tv',
        title: `Private title ${id}`,
        tmdb_id: id++,
      },
      stratum,
    }),
  ));
}

describe('held-out semantic study cohort planner', () => {
  test('freezes a balanced 28-case broad-policy cohort before semantic retrieval', async () => {
    const preparation = { prepare: jest.fn(async () => ({ valid: true })) };
    const planner = createHeldOutSemanticStudyCohortPlanner({ preparation });
    const plan = await planner.plan({
      candidates: candidates(),
      policies: [{}],
      selectionSecret: Buffer.alloc(32, 7),
    });

    expect(plan.receipt.statusId).toBe(HELD_OUT_SEMANTIC_STUDY_COHORT_STATUS_IDS.COMPLETE);
    expect(plan.receipt).toMatchObject({
      automaticRoutingEligibility: false,
      independentLabelsAvailable: false,
      policyChangeEligibility: false,
      semanticSelection: false,
      selectedByStratum: {
        documentary: 7,
        'genre-overlap': 7,
        ordinary: 7,
        reality: 7,
      },
    });
    expect(plan.request.cases).toHaveLength(28);
    expect(plan.request.cases.every((entry) => /^fixture_[a-f0-9]{64}$/u.test(entry.fixtureId))).toBe(true);
    expect(plan.request.cases.every((entry) => /^snapshot_[a-f0-9]{64}$/u.test(entry.snapshotId))).toBe(true);
    expect(JSON.stringify(plan.receipt)).not.toMatch(/Private|tmdb|libraryId/u);
    expect(preparation.prepare).toHaveBeenCalledTimes(28);
    expect(preparation.prepare.mock.calls.every(([, options]) => options === undefined)).toBe(true);
  });

  test('does not return a partial cohort when one required stratum lacks eligible comparisons', async () => {
    const preparation = { prepare: jest.fn(async (value) => ({
      valid: value.metadata.tmdb_id % 7 !== 0,
    })) };
    const planner = createHeldOutSemanticStudyCohortPlanner({ preparation });
    const plan = await planner.plan({
      candidates: candidates(7),
      policies: [{}],
      selectionSecret: Buffer.alloc(32, 9),
    });

    expect(plan.request).toBeNull();
    expect(plan.receipt.statusId).toBe(HELD_OUT_SEMANTIC_STUDY_COHORT_STATUS_IDS.INSUFFICIENT_ELIGIBLE_CASES);
    expect(plan.receipt.selectedByStratum).toEqual({
      documentary: 0,
      'genre-overlap': 0,
      ordinary: 0,
      reality: 0,
    });
  });

  test('rejects duplicate identities before exposing any request', async () => {
    const source = candidates();
    source[1].metadata = { ...source[1].metadata, ...source[0].metadata };
    const planner = createHeldOutSemanticStudyCohortPlanner({
      preparation: { prepare: jest.fn(async () => ({ valid: true })) },
    });
    const plan = await planner.plan({
      candidates: source,
      policies: [{}],
      selectionSecret: Buffer.alloc(32, 4),
    });

    expect(plan.request).toBeNull();
    expect(plan.receipt.statusId).toBe(HELD_OUT_SEMANTIC_STUDY_COHORT_STATUS_IDS.INVALID_CANDIDATE_SOURCE);
  });
});
