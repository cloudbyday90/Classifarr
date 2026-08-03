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
} from '../../services/policyRuntimeExactItemMemoryExecutionState.mjs';
import {
  lockPolicyRuntimeDestinationEvidenceExecutionState,
} from '../../services/policyRuntimeDestinationEvidenceExecutionState.mjs';
import {
  buildPolicyRuntimeDestinationEvidenceSourceEventId,
} from '../../services/policyRuntimeDestinationEvidenceSourceEvent.mjs';

const fingerprint = 'a'.repeat(22);

function classificationRow(overrides = {}) {
  return {
    id: '42',
    tmdb_id: '872',
    media_type: 'movie',
    status: 'completed',
    library_id: '8',
    library_name: 'Anime Movies',
    genre_names: [],
    primary_studio_name: 'Studio Ghibli',
    metadata: {
      classification_details: {
        outcome_link: {
          type: 'resolved',
          source: 'policy_question',
          final_library_id: '8',
          final_library_name: 'Anime Movies',
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

function destinationRow() {
  return { id: '8', name: 'Anime Movies', media_type: 'movie', is_active: true };
}

function intake(overrides = {}) {
  const sourceEventId = buildPolicyRuntimeDestinationEvidenceSourceEventId({
    classificationId: 42,
    contractFingerprint: fingerprint,
    tierId: 'identity_evidence',
    candidateKey: 'studio:studio_ghibli',
  });

  return {
    answerOutcomeId: 'add_identity_evidence',
    sourceEventId,
    candidate: { key: 'studio:studio_ghibli' },
    finalOutcome: {
      itemId: 42,
      destinationLibraryId: 8,
      destinationLibraryName: 'Anime Movies',
    },
    ...overrides,
  };
}

function createClient() {
  return {
    query: jest.fn()
      .mockResolvedValueOnce({ rows: [classificationRow()] })
      .mockResolvedValueOnce({ rows: [destinationRow()] }),
  };
}

describe('policyRuntimeDestinationEvidenceExecutionState', () => {
  test('accepts only the derived receipt event and exposes it as the locked state identity', async () => {
    const client = createClient();
    const result = await lockPolicyRuntimeDestinationEvidenceExecutionState({
      client,
      intake: intake(),
    });

    expect(result).toMatchObject({
      ok: true,
      currentState: {
        locked: true,
        classificationId: '42',
        sourceEventId: intake().sourceEventId,
      },
    });
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  test('blocks a substituted candidate receipt identity before persistence can run', async () => {
    const client = createClient();
    const result = await lockPolicyRuntimeDestinationEvidenceExecutionState({
      client,
      intake: intake({ sourceEventId: 'runtime_destination_evidence:42:substituted' }),
    });

    expect(result).toMatchObject({
      ok: false,
      reasonId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.SOURCE_EVENT_IDENTITY_MISMATCH,
    });
  });
});
