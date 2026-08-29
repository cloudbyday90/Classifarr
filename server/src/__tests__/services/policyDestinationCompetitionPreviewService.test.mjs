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
  PolicyDestinationCompetitionPreviewNotFoundError,
  PolicyDestinationCompetitionPreviewService,
} from '../../services/policyDestinationCompetitionPreviewService.mjs';

const persistedPolicy = {
  id: 17,
  library_id: 23,
  library_media_type: 'movie',
};

describe('PolicyDestinationCompetitionPreviewService', () => {
  test('uses a batch-attached anonymous competitor set and returns booleans only to the preview builder', async () => {
    const loadContext = jest.fn().mockResolvedValue(persistedPolicy);
    const loadCompetitors = jest.fn().mockResolvedValue([{ id: 24, library_id: 31 }]);
    const loadItems = jest.fn().mockResolvedValue([
      { title: 'alone' },
      { title: 'shared' },
      { title: 'competitor only' },
    ]);
    const attachNativeIntents = jest.fn().mockResolvedValue([{ id: 24, library_id: 31 }]);
    const buildDraftContract = jest.fn().mockReturnValue({ kind: 'proposed' });
    const buildCurrentContract = jest.fn().mockReturnValue({ kind: 'competitor' });
    const buildPolicy = jest.fn(({ contract }) => ({ kind: contract.kind }));
    const projectItem = jest.fn(row => ({ title: row.title }));
    const evaluate = jest.fn((policy, item) => ({
      eligible: (policy.kind === 'proposed' && ['alone', 'shared'].includes(item.title)) ||
        (policy.kind === 'competitor' && ['shared', 'competitor only'].includes(item.title)),
    }));
    const buildPreview = jest.fn(input => input);
    const service = new PolicyDestinationCompetitionPreviewService({
      db: { query: jest.fn() },
      now: () => new Date('2026-08-29T12:00:00.000Z'),
      loadContext,
      loadCompetitors,
      loadItems,
      attachNativeIntents,
      buildDraftContract,
      buildCurrentContract,
      buildPolicy,
      evaluate,
      projectItem,
      buildPreview,
    });

    await service.preview({ policyId: 17, draft: { schema_version: 1 } });

    expect(loadCompetitors).toHaveBeenCalledWith({
      db: expect.any(Object),
      policyId: 17,
      mediaType: 'movie',
      maximumCompetitors: 25,
    });
    expect(attachNativeIntents).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      policies: [{ id: 24, library_id: 31 }],
    });
    expect(buildPreview).toHaveBeenCalledWith(expect.objectContaining({
      proposedEligibility: [true, true, false],
      competitorEligibility: [false, true, true],
      activeCompetitorPolicyCount: 1,
      maximumCompetitorPolicies: 25,
    }));
    expect(evaluate).toHaveBeenCalledTimes(6);
  });

  test('does not load historic records or competitors when the policy is absent', async () => {
    const loadItems = jest.fn();
    const loadCompetitors = jest.fn();
    const service = new PolicyDestinationCompetitionPreviewService({
      db: { query: jest.fn() },
      loadContext: async () => null,
      loadItems,
      loadCompetitors,
    });

    await expect(service.preview({ policyId: 99, draft: {} }))
      .rejects.toBeInstanceOf(PolicyDestinationCompetitionPreviewNotFoundError);
    expect(loadItems).not.toHaveBeenCalled();
    expect(loadCompetitors).not.toHaveBeenCalled();
  });
});
