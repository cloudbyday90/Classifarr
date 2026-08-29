/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildClassificationDecisionPathTelemetry,
  buildClassificationDecisionPathTelemetryWindow,
} from '../services/classificationDecisionPathTelemetry.mjs';

describe('classificationDecisionPathTelemetry', () => {
  test('builds a fixed rolling aggregate window', () => {
    const window = buildClassificationDecisionPathTelemetryWindow({
      now: new Date('2026-08-29T12:30:00.000Z'),
    });

    expect(window).toEqual({
      hours: 24,
      start: new Date('2026-08-28T12:30:00.000Z'),
      end: new Date('2026-08-29T12:30:00.000Z'),
    });
  });

  test('returns only fixed non-identifying counters', () => {
    const telemetry = buildClassificationDecisionPathTelemetry({
      aggregate: {
        deterministic_policy_count: '7',
        ai_classification_attempt_count: '4',
        ai_unavailable_retry_count: '2',
        strict_verification_abstention_count: '1',
        title: 'Private title',
        provider: 'private-provider',
        model: 'private-model',
        prompt: 'private-prompt',
        response: 'private-response',
      },
      window: { hours: 24 },
    });

    expect(telemetry).toEqual({
      version: 'classification.decision_path_telemetry.v1',
      window: { hours: 24 },
      counts: {
        deterministicPolicy: 7,
        aiClassificationAttempt: 4,
        aiUnavailableRetry: 2,
        strictVerificationAbstention: 1,
      },
    });
    expect(JSON.stringify(telemetry)).not.toContain('Private title');
    expect(JSON.stringify(telemetry)).not.toContain('private-provider');
    expect(JSON.stringify(telemetry)).not.toContain('private-model');
    expect(JSON.stringify(telemetry)).not.toContain('private-prompt');
    expect(JSON.stringify(telemetry)).not.toContain('private-response');
  });

  test('rejects an invalid window and normalizes invalid counts to zero', () => {
    expect(() => buildClassificationDecisionPathTelemetryWindow({ now: 'not-a-date' }))
      .toThrow('valid observation time');
    expect(() => buildClassificationDecisionPathTelemetry({ window: { hours: 169 } }))
      .toThrow('bounded telemetry window');

    expect(buildClassificationDecisionPathTelemetry({
      aggregate: { deterministic_policy_count: -1 },
      window: { hours: 24 },
    }).counts).toEqual({
      deterministicPolicy: 0,
      aiClassificationAttempt: 0,
      aiUnavailableRetry: 0,
      strictVerificationAbstention: 0,
    });
  });
});
