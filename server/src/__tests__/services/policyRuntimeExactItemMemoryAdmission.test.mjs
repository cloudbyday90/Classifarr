/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_STATUS_IDS,
  buildPolicyRuntimeExactItemMemoryAdmission,
} from '../../services/policyRuntimeExactItemMemoryAdmission.mjs';

function lockedState(overrides = {}) {
  return {
    ok: true,
    classification: { id: '42', tmdbId: '872', mediaType: 'movie' },
    destination: { id: '8', name: 'Animated Movies', mediaType: 'movie', active: true },
    resolution: {
      sourceEventId: `runtime_exact_item_memory:42:${'a'.repeat(22)}`,
    },
    currentState: {
      classificationId: '42',
      destinationLibraryId: '8',
      destinationLibraryName: 'Animated Movies',
      locked: true,
    },
    ...overrides,
  };
}

describe('policyRuntimeExactItemMemoryAdmission', () => {
  test('builds an exact-item-only operator confirmation from locked state', () => {
    const result = buildPolicyRuntimeExactItemMemoryAdmission({
      executionState: lockedState(),
      actorId: 'operator-7',
    });

    expect(result).toMatchObject({
      ok: true,
      statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_STATUS_IDS.READY,
      intake: {
        sourceId: 'operator_confirmation',
        sourceEventId: `runtime_exact_item_memory:42:${'a'.repeat(22)}`,
        actorId: 'operator-7',
        answerOutcomeId: 'remember_exact_item',
      },
      decision: {
        learning: {
          decisionId: 'candidate',
          tierId: 'exact_item_memory',
          canWriteLearning: true,
        },
        profileRefresh: { queue: false },
      },
      references: {
        classificationId: '42',
        tmdbId: '872',
        mediaType: 'movie',
        destinationLibraryId: '8',
      },
      audit: { ok: true },
    });
    expect(JSON.stringify(result.references)).not.toContain('Animated Movies');
  });

  test('fails closed when the locked state lacks an exact-item reference', () => {
    const result = buildPolicyRuntimeExactItemMemoryAdmission({
      executionState: lockedState({ classification: { id: '42', tmdbId: null, mediaType: 'movie' } }),
      actorId: 'operator-7',
    });

    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_STATUS_IDS.BLOCKED,
    });
  });
});
