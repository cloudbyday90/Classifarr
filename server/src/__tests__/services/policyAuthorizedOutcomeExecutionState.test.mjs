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
  lockPolicyAuthorizedOutcomeExecutionState,
} from '../../services/policyAuthorizedOutcomeExecutionState.mjs';

function intake(overrides = {}) {
  return {
    sourceEventId: 'classification_correction:991',
    itemId: 42,
    finalOutcome: {
      itemId: 42,
      destinationLibraryId: 8,
      destinationLibraryName: 'Animated Movies',
    },
    ...overrides,
  };
}

function lockedClassification(overrides = {}) {
  return {
    id: 42,
    tmdb_id: 872,
    media_type: 'movie',
    status: 'awaiting_decision',
    library_id: 3,
    library_name: 'Movies',
    ...overrides,
  };
}

function lockedDestination(overrides = {}) {
  return {
    id: 8,
    name: 'Animated Movies',
    media_type: 'movie',
    is_active: true,
    ...overrides,
  };
}

describe('policyAuthorizedOutcomeExecutionState', () => {
  test('locks the classification before the revalidated destination', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [lockedClassification()] })
        .mockResolvedValueOnce({ rows: [lockedDestination()] }),
    };

    const result = await lockPolicyAuthorizedOutcomeExecutionState({ client, intake: intake() });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      classification: expect.objectContaining({
        id: '42',
        tmdbId: '872',
        mediaType: 'movie',
      }),
      destination: expect.objectContaining({
        id: '8',
        name: 'Animated Movies',
      }),
      currentState: expect.objectContaining({
        classificationId: '42',
        sourceEventId: 'classification_correction:991',
        destinationLibraryId: '8',
        destinationLibraryName: 'Animated Movies',
        locked: true,
      }),
    }));
    expect(client.query.mock.calls[0][0]).toContain('FROM classification_history');
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[1][0]).toContain('FROM libraries');
    expect(client.query.mock.calls[1][0]).toContain('FOR UPDATE');
  });

  test.each([
    ['inactive', lockedDestination({ is_active: false }), 'authorized_outcome_execution_destination_inactive'],
    ['media mismatch', lockedDestination({ media_type: 'tv' }), 'authorized_outcome_execution_destination_media_type_mismatch'],
    ['name mismatch', lockedDestination({ name: 'Renamed Animation' }), 'authorized_outcome_execution_destination_name_mismatch'],
  ])('blocks a %s destination before the receipt can be claimed', async (_label, destination, reasonId) => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [lockedClassification()] })
        .mockResolvedValueOnce({ rows: [destination] }),
    };

    const result = await lockPolicyAuthorizedOutcomeExecutionState({ client, intake: intake() });

    expect(result).toEqual(expect.objectContaining({ ok: false, reasonId }));
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  test('does not lock a destination when the classification does not exist', async () => {
    const client = {
      query: jest.fn().mockResolvedValueOnce({ rows: [] }),
    };

    const result = await lockPolicyAuthorizedOutcomeExecutionState({ client, intake: intake() });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reasonId: 'authorized_outcome_execution_classification_not_found',
    }));
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});
