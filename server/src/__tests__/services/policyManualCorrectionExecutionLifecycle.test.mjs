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
  POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS,
  applyPolicyManualCorrectionLifecycle,
} from '../../services/policyManualCorrectionExecutionLifecycle.mjs';

function classification() {
  return {
    id: 42,
    library_id: 3,
    tmdb_id: 872,
    media_type: 'movie',
  };
}

function destination(overrides = {}) {
  return {
    id: 8,
    name: 'Animated Movies',
    media_type: 'movie',
    is_active: true,
    ...overrides,
  };
}

describe('policyManualCorrectionExecutionLifecycle', () => {
  test('locks, records, and transitions the manual correction in classification-first order', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [classification()] })
        .mockResolvedValueOnce({ rows: [destination()] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 991, classification_id: 42 }] }),
    };

    const result = await applyPolicyManualCorrectionLifecycle({
      client,
      classificationId: 42,
      destinationLibraryId: 8,
      actorId: 'operator-7',
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      sourceEventId: 'classification_correction:991',
      classification: expect.objectContaining({ id: '42', originalLibraryId: '3' }),
      destination: expect.objectContaining({ id: '8', name: 'Animated Movies' }),
    }));
    expect(client.query.mock.calls[0][0]).toContain('FROM classification_history');
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[1][0]).toContain('FROM libraries');
    expect(client.query.mock.calls[1][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[2][0]).toContain("status = 'corrected'");
    expect(client.query.mock.calls[3][0]).toContain('INSERT INTO classification_corrections');
  });

  test('rejects media-type drift before any lifecycle write', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [classification()] })
        .mockResolvedValueOnce({ rows: [destination({ media_type: 'tv' })] }),
    };

    const result = await applyPolicyManualCorrectionLifecycle({
      client,
      classificationId: 42,
      destinationLibraryId: 8,
      actorId: 'operator-7',
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reasonId: POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.DESTINATION_MEDIA_TYPE_MISMATCH,
    }));
    expect(client.query).toHaveBeenCalledTimes(2);
  });
});
