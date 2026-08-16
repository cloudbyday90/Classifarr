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
  PolicyPurposeCoveragePreflightNotFoundError,
  PolicyPurposeCoveragePreflightService,
} from '../../services/policyPurposeCoveragePreflightService.mjs';

describe('PolicyPurposeCoveragePreflightService', () => {
  test('derives a transient candidate, uses persisted scope, and returns the bounded result', async () => {
    const db = { query: jest.fn() };
    const candidate = { terms: [{ signalType: 'genres', termKey: 'family' }] };
    const context = { policy_id: 17, library_id: 18, library_media_type: 'movie' };
    const overlap = { shared_required_term_count: 1, overlapping_destination_count: 1 };
    const result = { advisory: true, draftRetained: false };
    const buildCandidate = jest.fn().mockReturnValue(candidate);
    const loadContext = jest.fn().mockResolvedValue(context);
    const loadOverlap = jest.fn().mockResolvedValue(overlap);
    const buildPreflight = jest.fn().mockReturnValue(result);
    const service = new PolicyPurposeCoveragePreflightService({
      db,
      now: () => '2026-08-16T12:00:00.000Z',
      buildCandidate,
      loadContext,
      loadOverlap,
      buildPreflight,
    });

    await expect(service.preflight({ policyId: 17, draft: { source: 'draft' } }))
      .resolves.toBe(result);

    expect(buildCandidate).toHaveBeenCalledWith({ source: 'draft' });
    expect(loadContext).toHaveBeenCalledWith({ db, policyId: 17 });
    expect(loadOverlap).toHaveBeenCalledWith({
      db,
      candidateTerms: candidate.terms,
      libraryId: 18,
      mediaType: 'movie',
    });
    expect(buildPreflight).toHaveBeenCalledWith({
      context,
      candidate,
      overlap,
      evaluatedAt: '2026-08-16T12:00:00.000Z',
    });
  });

  test('does not evaluate overlap when the persisted policy context is absent', async () => {
    const loadOverlap = jest.fn();
    const service = new PolicyPurposeCoveragePreflightService({
      db: { query: jest.fn() },
      buildCandidate: () => ({ terms: [] }),
      loadContext: async () => null,
      loadOverlap,
    });

    await expect(service.preflight({ policyId: 99, draft: {} }))
      .rejects.toBeInstanceOf(PolicyPurposeCoveragePreflightNotFoundError);
    expect(loadOverlap).not.toHaveBeenCalled();
  });
});
