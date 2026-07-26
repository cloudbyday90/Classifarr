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
  buildPolicyManualCorrectionOutcomeProjection,
  persistPolicyManualCorrectionFinalOutcome,
} from '../../services/policyManualCorrectionExecutionEffects.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
} from '../../services/policyAuthorizedOutcomePersistenceVocabulary.mjs';

function command() {
  return {
    authorization: { actorId: 'operator-7' },
    currentState: { classificationId: '42' },
    finalOutcome: {
      destinationLibraryId: '8',
      destinationLibraryName: 'Animated Movies',
    },
    operations: {
      finalOutcome: {
        operationId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.RECORD_FINAL_OUTCOME,
      },
    },
  };
}

describe('policyManualCorrectionExecutionEffects', () => {
  test('projects the source-specific corrected outcome without retaining intake data', () => {
    expect(buildPolicyManualCorrectionOutcomeProjection(command())).toEqual({
      type: 'corrected',
      source: 'api_correction',
      actor: 'operator-7',
      final_library_id: '8',
      final_library_name: 'Animated Movies',
    });
  });

  test('persists only an authorized final-outcome projection through the transaction client', async () => {
    const client = { query: jest.fn() };
    const outcomeService = {
      recordOutcome: jest.fn().mockResolvedValue({ updated: true }),
    };

    const result = await persistPolicyManualCorrectionFinalOutcome({
      client,
      command: command(),
      outcomeService,
    });

    expect(outcomeService.recordOutcome).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({ type: 'corrected', source: 'api_correction' }),
      { client },
    );
    expect(result).toMatchObject({ persisted: true });
  });
});
