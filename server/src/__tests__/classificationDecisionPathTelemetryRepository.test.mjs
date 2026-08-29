/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  loadClassificationDecisionPathTelemetry,
} from '../services/classificationDecisionPathTelemetryRepository.mjs';

describe('classificationDecisionPathTelemetryRepository', () => {
  test('queries four fixed aggregate counters over a bounded range', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          deterministic_policy_count: '6',
          ai_classification_attempt_count: '3',
          ai_unavailable_retry_count: '1',
          strict_verification_abstention_count: '2',
        }],
      }),
    };
    const start = new Date('2026-08-28T12:00:00.000Z');
    const end = new Date('2026-08-29T12:00:00.000Z');

    const row = await loadClassificationDecisionPathTelemetry(db, { start, end });

    expect(row).toEqual({
      deterministic_policy_count: '6',
      ai_classification_attempt_count: '3',
      ai_unavailable_retry_count: '1',
      strict_verification_abstention_count: '2',
    });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('COUNT(*) FILTER');
    expect(sql).toContain("method = 'queued_for_retry'");
    expect(sql).toContain("status_id}' = 'abstained'");
    expect(sql).not.toContain('title');
    expect(sql).not.toContain('library');
    expect(sql).not.toContain('provider');
    expect(sql).not.toContain('model');
    expect(sql).not.toContain('prompt');
    expect(sql).not.toContain('response');
    expect(params).toEqual([
      start.toISOString(),
      end.toISOString(),
      'classification.deterministic_ai_mode.v1',
      'classification.candidate_bound_verification.v1',
    ]);
  });

  test('fails before issuing a malformed aggregate query', async () => {
    const db = { query: jest.fn() };

    await expect(loadClassificationDecisionPathTelemetry(db, {
      start: new Date('2026-08-29T12:00:00.000Z'),
      end: new Date('2026-08-28T12:00:00.000Z'),
    })).rejects.toThrow('valid aggregate observation range');

    expect(db.query).not.toHaveBeenCalled();
  });
});
