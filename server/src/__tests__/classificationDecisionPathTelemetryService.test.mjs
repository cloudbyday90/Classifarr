/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createClassificationDecisionPathTelemetryService,
} from '../services/classificationDecisionPathTelemetryService.mjs';

describe('classificationDecisionPathTelemetryService', () => {
  test('skips reads when no classifications are queued and caches aggregate telemetry', async () => {
    let nowMs = Date.parse('2026-08-29T12:00:00.000Z');
    const database = { query: jest.fn() };
    const loadAggregate = jest.fn().mockResolvedValue({
      deterministic_policy_count: '3',
      ai_classification_attempt_count: '2',
      ai_unavailable_retry_count: '1',
      strict_verification_abstention_count: '0',
    });
    const service = createClassificationDecisionPathTelemetryService({
      database,
      loadAggregate,
      now: () => new Date(nowMs),
    });

    await expect(service.getTelemetry({ queueStats: { pending: 0 } })).resolves.toBeNull();
    expect(loadAggregate).not.toHaveBeenCalled();

    const first = await service.getTelemetry({ queueStats: { pending: 1 } });
    nowMs += 1_000;
    const second = await service.getTelemetry({ queueStats: { pending: 2 } });

    expect(loadAggregate).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 'classification.decision_path_telemetry.v1',
      counts: { deterministicPolicy: 3, aiClassificationAttempt: 2 },
    });
  });

  test('fails open and records only a local warning when aggregate telemetry is unavailable', async () => {
    const logger = { warn: jest.fn() };
    const service = createClassificationDecisionPathTelemetryService({
      database: { query: jest.fn() },
      loadAggregate: jest.fn().mockRejectedValue(new Error('database failure')),
      logger,
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });

    await expect(service.getTelemetry({ queueStats: { pending: 1 } })).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Queue decision-path telemetry could not read aggregate history',
      { error: 'database failure' },
    );
  });

  test('fails open when its local observation clock is invalid', async () => {
    const logger = { warn: jest.fn() };
    const loadAggregate = jest.fn();
    const service = createClassificationDecisionPathTelemetryService({
      database: { query: jest.fn() },
      loadAggregate,
      logger,
      now: () => new Date('invalid'),
    });

    await expect(service.getTelemetry({ queueStats: { pending: 1 } })).resolves.toBeNull();
    expect(loadAggregate).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Queue decision-path telemetry could not read aggregate history',
      { error: 'A valid observation time is required.' },
    );
  });
});
