/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import {
  PolicyCohortSimulationNotFoundError,
  PolicyCohortSimulationService,
} from '../../services/policyCohortSimulationService.mjs';

const persistedPolicy = {
  id: 17,
  library_id: 23,
  library_name: 'Movies',
  library_media_type: 'movie',
};

describe('PolicyCohortSimulationService', () => {
  test('compares current and proposed deterministic eligibility for a bounded in-memory cohort', async () => {
    const loadContext = jest.fn().mockResolvedValue(persistedPolicy);
    const loadItems = jest.fn().mockResolvedValue([
      { id: 1, title: 'Enter' },
      { id: 2, title: 'Leave' },
    ]);
    const buildCurrentContract = jest.fn().mockReturnValue({ kind: 'current', validation: { valid: true } });
    const buildDraftContract = jest.fn().mockReturnValue({ kind: 'proposed', validation: { valid: true } });
    const buildPolicy = jest.fn(({ contract }) => ({ kind: contract.kind }));
    const evaluate = jest.fn((policy, item) => ({
      eligible: (policy.kind === 'current' && item.title === 'Leave')
        || (policy.kind === 'proposed' && item.title === 'Enter'),
      statusId: 'native_intent_runtime_purpose_not_matched',
    }));
    const projectItem = jest.fn(row => ({ title: row.title }));
    const buildSimulation = jest.fn(input => input);
    const attachNativeIntent = jest.fn().mockResolvedValue(persistedPolicy);
    const service = new PolicyCohortSimulationService({
      db: { query: jest.fn() },
      now: () => new Date('2026-08-29T12:00:00.000Z'),
      loadContext,
      loadItems,
      attachNativeIntent,
      buildCurrentContract,
      buildDraftContract,
      buildPolicy,
      evaluate,
      projectItem,
      buildSimulation,
    });

    const result = await service.simulate({ policyId: 17, draft: { schema_version: 1 } });

    expect(loadItems).toHaveBeenCalledWith(expect.objectContaining({
      mediaType: 'movie',
      maximumItems: 100,
      cutoff: new Date('2026-05-31T12:00:00.000Z'),
    }));
    expect(result).toMatchObject({
      context: { policy: persistedPolicy },
      sample: {
        windowDays: 90,
        maximumItems: 100,
        evaluatedItemCount: 2,
      },
      baselineOutcomes: ['purpose_not_matched', 'eligible'],
      proposedOutcomes: ['eligible', 'purpose_not_matched'],
    });
    expect(evaluate).toHaveBeenCalledTimes(4);
    expect(projectItem).toHaveBeenCalledTimes(2);
  });

  test('does not load or evaluate historic records when the persisted policy is absent', async () => {
    const loadItems = jest.fn();
    const service = new PolicyCohortSimulationService({
      db: { query: jest.fn() },
      loadContext: async () => null,
      loadItems,
    });

    await expect(service.simulate({ policyId: 99, draft: {} }))
      .rejects.toBeInstanceOf(PolicyCohortSimulationNotFoundError);
    expect(loadItems).not.toHaveBeenCalled();
  });
});
