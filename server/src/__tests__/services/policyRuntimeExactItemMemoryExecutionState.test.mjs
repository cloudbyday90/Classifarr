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
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS,
  buildPolicyRuntimeExactItemMemorySourceEventId,
  lockPolicyRuntimeExactItemMemoryExecutionState,
} from '../../services/policyRuntimeExactItemMemoryExecutionState.mjs';

const fingerprint = 'a'.repeat(22);

function classificationRow(overrides = {}) {
  return {
    id: '42',
    tmdb_id: '872',
    media_type: 'movie',
    status: 'completed',
    library_id: '8',
    library_name: 'Animated Movies',
    metadata: {
      classification_details: {
        outcome_link: {
          type: 'resolved',
          source: 'policy_question',
          final_library_id: '8',
          final_library_name: 'Animated Movies',
          runtime_question_answer: {
            contract_version: 'policy.runtime_question_answer.v1',
            contract_fingerprint: fingerprint,
            action_id: 'confirm_destination',
            destination_library_id: 8,
          },
        },
      },
    },
    ...overrides,
  };
}

function destinationRow(overrides = {}) {
  return {
    id: '8',
    name: 'Animated Movies',
    media_type: 'movie',
    is_active: true,
    ...overrides,
  };
}

function createClient({ classification = classificationRow(), destination = destinationRow() } = {}) {
  return {
    query: jest.fn()
      .mockResolvedValueOnce({ rows: [classification] })
      .mockResolvedValueOnce({ rows: [destination] }),
  };
}

describe('policyRuntimeExactItemMemoryExecutionState', () => {
  test('locks and derives every command reference from the completed runtime resolution', async () => {
    const client = createClient();

    const result = await lockPolicyRuntimeExactItemMemoryExecutionState({
      client,
      classificationId: 42,
    });

    expect(result).toMatchObject({
      ok: true,
      classification: { id: '42', tmdbId: '872', mediaType: 'movie' },
      destination: { id: '8', name: 'Animated Movies', mediaType: 'movie', active: true },
      resolution: {
        contractFingerprint: fingerprint,
        sourceEventId: buildPolicyRuntimeExactItemMemorySourceEventId({
          classificationId: 42,
          contractFingerprint: fingerprint,
        }),
      },
      currentState: { locked: true, classificationId: '42', destinationLibraryId: '8' },
    });
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[1][0]).toContain('FOR UPDATE');
  });

  test('rejects an outcome that is not the recorded policy-question resolution', async () => {
    const client = createClient({
      classification: classificationRow({
        metadata: { classification_details: { outcome_link: { type: 'corrected', source: 'api_correction' } } },
      }),
    });

    const result = await lockPolicyRuntimeExactItemMemoryExecutionState({ client, classificationId: 42 });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reasonId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.FINAL_OUTCOME_NOT_RUNTIME_RESOLUTION,
    }));
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  test('rejects stale outcome destination state before loading a destination', async () => {
    const client = createClient({
      classification: classificationRow({ library_id: '9', library_name: 'Other Movies' }),
    });

    const result = await lockPolicyRuntimeExactItemMemoryExecutionState({ client, classificationId: 42 });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reasonId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.FINAL_OUTCOME_DESTINATION_MISMATCH,
    }));
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  test('rejects an altered source-event identity without touching the writer', async () => {
    const client = createClient();

    const result = await lockPolicyRuntimeExactItemMemoryExecutionState({
      client,
      intake: {
        finalOutcome: {
          itemId: 42,
          destinationLibraryId: 8,
          destinationLibraryName: 'Animated Movies',
        },
        sourceEventId: 'runtime_exact_item_memory:42:substituted',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reasonId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.SOURCE_EVENT_IDENTITY_MISMATCH,
    }));
  });
});
