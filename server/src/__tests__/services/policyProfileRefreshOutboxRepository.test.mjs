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
  enqueuePolicyProfileRefresh,
} from '../../services/policyProfileRefreshOutboxRepository.mjs';

function record() {
  return {
    sourceId: 'discord_pending_answer',
    sourceEventId: 'classification:42:discord:991',
    classificationId: '42',
    libraryId: '8',
    learningOperationId: 'write_compatibility_evidence',
    learningTierId: 'compatibility_evidence',
    candidateKey: 'studio:pixar',
    refreshReasonId: 'profile_refresh_required',
    sourceSystem: 'policy_authorized_profile_refresh',
  };
}

function row(overrides = {}) {
  return {
    id: '91',
    source_id: 'discord_pending_answer',
    source_event_id: 'classification:42:discord:991',
    classification_id: '42',
    library_id: '8',
    learning_operation_id: 'write_compatibility_evidence',
    learning_tier_id: 'compatibility_evidence',
    candidate_key: 'studio:pixar',
    refresh_reason_id: 'profile_refresh_required',
    created_at: '2026-07-26T12:00:00.000Z',
    ...overrides,
  };
}

describe('policyProfileRefreshOutboxRepository', () => {
  test('uses a parameterized source-event upsert for a new row', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [row()] }) };

    const result = await enqueuePolicyProfileRefresh({ client, record: record() });

    expect(result).toMatchObject({ replayed: false, outbox: { id: '91', libraryId: '8' } });
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0][0]).toContain(
      'ON CONFLICT (source_id, source_event_id) DO NOTHING',
    );
    expect(client.query.mock.calls[0][1]).toEqual([
      'discord_pending_answer',
      'classification:42:discord:991',
      '42',
      '8',
      'write_compatibility_evidence',
      'compatibility_evidence',
      'studio:pixar',
      'profile_refresh_required',
      'policy_authorized_profile_refresh',
    ]);
  });

  test('returns the existing compact row when the authorized source event already has one', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [row()] }),
    };

    const result = await enqueuePolicyProfileRefresh({ client, record: record() });

    expect(result).toMatchObject({ replayed: true, outbox: { id: '91' } });
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[1][1]).toEqual([
      'discord_pending_answer',
      'classification:42:discord:991',
    ]);
  });
});
