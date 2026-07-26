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
  buildPolicyAuthorizedOutcomeProjection,
  persistPolicyAuthorizedFinalOutcome,
  writePolicyAuthorizedExactItemMemory,
} from '../../services/policyAuthorizedOutcomeExecutionEffects.mjs';

function command(overrides = {}) {
  return {
    sourceId: 'manual_classification_change',
    authorization: { actorId: 'operator-7' },
    currentState: { classificationId: 42 },
    finalOutcome: {
      status: 'resolved',
      destinationLibraryId: 8,
      destinationLibraryName: 'Animated Movies',
      route: null,
    },
    operations: {
      finalOutcome: { operationId: 'record_final_outcome' },
      learning: { operationId: 'write_exact_item_memory' },
    },
    ...overrides,
  };
}

function executionState(overrides = {}) {
  return {
    classification: { tmdbId: 872, mediaType: 'movie' },
    destination: { id: '8', name: 'Animated Movies' },
    ...overrides,
  };
}

describe('policyAuthorizedOutcomeExecutionEffects', () => {
  test('builds a compact final-outcome projection without intake payload fields', () => {
    const projection = buildPolicyAuthorizedOutcomeProjection(command());

    expect(projection).toEqual({
      type: 'resolved',
      source: 'manual_classification_change',
      actor: 'operator-7',
      final_library_id: '8',
      final_library_name: 'Animated Movies',
      routing: null,
    });
    expect(JSON.stringify(projection)).not.toContain('provider');
    expect(JSON.stringify(projection)).not.toContain('question');
  });

  test('requires the outcome projection writer to report success', async () => {
    const client = { query: async () => ({ rows: [] }) };
    const outcomeService = {
      recordOutcome: async () => ({ updated: true }),
    };

    const result = await persistPolicyAuthorizedFinalOutcome({
      client,
      command: command(),
      outcomeService,
    });

    expect(result).toEqual(expect.objectContaining({
      persisted: true,
      reasonId: 'authorized_outcome_execution_final_outcome_persisted',
    }));
    await expect(persistPolicyAuthorizedFinalOutcome({
      client,
      command: command(),
      outcomeService: { recordOutcome: async () => ({ updated: false }) },
    })).rejects.toThrow('projection was not persisted');
  });

  test('writes only locked exact-item correlation and treats an existing exact item as a safe no-op', async () => {
    const client = { query: async () => ({ rows: [] }) };
    const calls = [];
    const evidenceService = {
      rememberExactMatch: async input => {
        calls.push(input);
        return null;
      },
    };

    const result = await writePolicyAuthorizedExactItemMemory({
      client,
      command: command(),
      executionState: executionState(),
      evidenceService,
    });

    expect(result).toEqual(expect.objectContaining({
      persisted: false,
      reasonId: 'authorized_outcome_execution_exact_item_memory_already_present',
    }));
    expect(calls[0]).toEqual(expect.objectContaining({
      tmdbId: '872',
      mediaType: 'movie',
      libraryId: '8',
      createdBy: 'operator-7',
      client,
      conflictMode: 'do_nothing',
    }));
    expect(calls[0]).not.toHaveProperty('payload');
  });
});
