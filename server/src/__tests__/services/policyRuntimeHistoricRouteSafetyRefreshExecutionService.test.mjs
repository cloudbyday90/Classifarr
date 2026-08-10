/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  PolicyRuntimeHistoricRouteSafetyRefreshExecutionService,
} from '../../services/policyRuntimeHistoricRouteSafetyRefreshExecutionService.mjs';
import {
  normalizePolicyRuntimeQuestion,
} from '../../services/policyRuntimeQuestionNormalizer.mjs';

function historicClassification() {
  const policyQuestion = normalizePolicyRuntimeQuestion({
    metadata: { media_type: 'movie' },
    libraries: [{ id: 8, name: 'Movies', media_type: 'movie', is_active: true }],
    policyResult: {
      action: 'auto_classify',
      ranked: [{
        library_id: 8,
        score: 90,
        prompt_threshold: 60,
        auto_classify_threshold: 85,
      }],
    },
  });

  return {
    id: 42,
    status: 'awaiting_decision',
    title: 'Historic Example',
    year: 2026,
    media_type: 'movie',
    confidence: 90,
    method: 'signal_calculation',
    policy_question: JSON.stringify(policyQuestion),
    metadata: JSON.stringify({
      policyResult: {
        action: 'auto_classify',
        thresholds: { prompt: 60, auto_classify: 85 },
        ranked: [{
          library_id: 8,
          score: 90,
          prompt_threshold: 60,
          auto_classify_threshold: 85,
        }],
      },
    }),
  };
}

describe('PolicyRuntimeHistoricRouteSafetyRefreshExecutionService', () => {
  test('uses a server-only locked-row eligibility check and returns a bounded receipt', async () => {
    const classificationRetryService = {
      retryClassifications: jest.fn().mockResolvedValue({
        results: [
          {
            classificationId: 42,
            queued: true,
            taskId: 993,
            metadataEnrichmentQueued: true,
            metadata: { should_not: 'be exposed' },
          },
          {
            classificationId: 77,
            skipped: true,
            reasonCode: 'duplicate_pending_task',
            existingTaskId: 41,
          },
        ],
      }),
    };
    const service = new PolicyRuntimeHistoricRouteSafetyRefreshExecutionService({
      classificationRetryService,
      createReceipt: () => '2ea36ed7-87df-45a8-a9cd-5501f39724f1',
    });

    const result = await service.run({ classificationIds: [42, 77], actorId: 'user:17' });

    expect(result).toEqual({
      version: 'policy.runtime_historic_route_safety_refresh_execution.v1',
      mode: 'apply',
      retryReceipt: '2ea36ed7-87df-45a8-a9cd-5501f39724f1',
      records: [
        {
          classificationId: 42,
          resultStatusId: 'queued',
          reasonId: 'queued_for_current_runtime_evaluation',
        },
        {
          classificationId: 77,
          resultStatusId: 'skipped',
          reasonId: 'duplicate_pending_task',
        },
      ],
      summary: {
        requestedRecordCount: 2,
        queued: 1,
        skipped: 1,
        failed: 0,
      },
      sideEffects: {
        retryCommandsExecuted: true,
        classificationRowsMutated: true,
        metadataEnrichmentTasksQueued: 1,
        routesExecuted: false,
        learningWritten: false,
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('should_not');
    const command = classificationRetryService.retryClassifications.mock.calls[0][0];
    expect(command).toEqual(expect.objectContaining({
      classificationIds: [42, 77],
      actor: 'user:17',
      correlationId: '2ea36ed7-87df-45a8-a9cd-5501f39724f1',
      taskSource: 'historic_route_safety_refresh',
      metadataEnrichmentSource: 'historic_route_safety_refresh_followup',
      route: '/api/classification/pending/route-safety-refresh/retry',
    }));
    expect(typeof command.retryEligibilityCheck).toBe('function');
    expect(command.retryEligibilityCheck({
      classification: historicClassification(),
    })).toEqual({
      eligible: true,
      reasonCode: 'historical_route_safety_details_unavailable',
    });
    expect(command.retryEligibilityCheck({
      classification: { ...historicClassification(), policy_question: '{}' },
    })).toEqual({
      eligible: false,
      reasonCode: 'historic_route_safety_refresh_not_required',
    });
  });

  test('rejects duplicate, unbounded, and non-positive operator selections before retry execution', async () => {
    const classificationRetryService = { retryClassifications: jest.fn() };
    const service = new PolicyRuntimeHistoricRouteSafetyRefreshExecutionService({
      classificationRetryService,
    });

    for (const classificationIds of [[], [1, 1], [0], Array.from({ length: 51 }, (_, index) => index + 1)]) {
      await expect(service.run({ classificationIds })).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });
    }
    expect(classificationRetryService.retryClassifications).not.toHaveBeenCalled();
  });

  test('fails closed when the retry service does not return an item result', async () => {
    const classificationRetryService = {
      retryClassifications: jest.fn().mockResolvedValue({ results: [] }),
    };
    const service = new PolicyRuntimeHistoricRouteSafetyRefreshExecutionService({
      classificationRetryService,
      createReceipt: () => 'a5c7fdf3-6aad-44d7-911d-9d36e4b9a754',
    });

    const result = await service.run({ classificationIds: [81] });

    expect(result.records).toEqual([{
      classificationId: 81,
      resultStatusId: 'failed',
      reasonId: 'retry_failed',
    }]);
    expect(result.sideEffects.retryCommandsExecuted).toBe(false);
    expect(result.sideEffects.metadataEnrichmentTasksQueued).toBe(0);
  });
});
