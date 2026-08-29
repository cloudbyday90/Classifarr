/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  buildOllamaVerificationRuntimeMismatchSummary,
} from '../../services/ollamaVerificationRuntimeMismatchSummary.mjs';
import {
  loadOllamaVerificationRuntimeMismatchSummary,
} from '../../services/ollamaVerificationRuntimeMismatchSummaryRepository.mjs';
import {
  createOllamaVerificationRuntimeMismatchSummaryService,
} from '../../services/ollamaVerificationRuntimeMismatchSummaryService.mjs';

describe('ollamaVerificationRuntimeMismatchSummary', () => {
  test('projects only the exact aggregate count and observation timestamp', () => {
    const summary = buildOllamaVerificationRuntimeMismatchSummary({
      model_digest_mismatch_count: '00042',
      last_model_digest_mismatch_at: '2026-08-29T12:34:56.000Z',
      model: 'private-model-name',
      model_digest: 'a'.repeat(64),
      host: 'private-host.local',
      error: 'private provider failure',
    });

    expect(summary).toEqual({
      version: 'ollama.verification_runtime_mismatch_summary.v1',
      modelDigestMismatchCount: '42',
      lastObservedAt: '2026-08-29T12:34:56.000Z',
    });
    expect(JSON.stringify(summary)).not.toContain('private-');
    expect(JSON.stringify(summary)).not.toContain('a'.repeat(64));
  });

  test('drops invalid aggregate values instead of forwarding database fields', () => {
    const summary = buildOllamaVerificationRuntimeMismatchSummary({
      model_digest_mismatch_count: '-7',
      last_model_digest_mismatch_at: 'not-a-timestamp',
      model: 'not-allowed',
    });

    expect(summary).toEqual({
      version: 'ollama.verification_runtime_mismatch_summary.v1',
      modelDigestMismatchCount: '0',
      lastObservedAt: null,
    });
  });

  test('uses fixed parameterized dimensions and never selects model identity', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          model_digest_mismatch_count: '3',
          last_model_digest_mismatch_at: '2026-08-29T12:34:56.000Z',
        }],
      }),
    };

    const row = await loadOllamaVerificationRuntimeMismatchSummary(database);

    expect(row).toEqual(expect.objectContaining({ model_digest_mismatch_count: '3' }));
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE(SUM(model_digest_mismatch_count), 0)::text'),
      ['ollama', 'verification'],
    );
    expect(database.query.mock.calls[0][0]).not.toContain('SELECT model');
  });

  test('coalesces concurrent reads and bounds the sanitized cache lifetime', async () => {
    let nowMs = 10_000;
    const loadSummary = jest.fn()
      .mockResolvedValueOnce({ model_digest_mismatch_count: '2', last_model_digest_mismatch_at: null })
      .mockResolvedValueOnce({ model_digest_mismatch_count: '3', last_model_digest_mismatch_at: null });
    const service = createOllamaVerificationRuntimeMismatchSummaryService({
      database: {},
      loadSummary,
      cacheTtlMs: 30_000,
      now: () => nowMs,
    });

    const [first, concurrent] = await Promise.all([
      service.getSummary(),
      service.getSummary(),
    ]);
    expect(first.modelDigestMismatchCount).toBe('2');
    expect(concurrent).toBe(first);
    expect(loadSummary).toHaveBeenCalledTimes(1);

    nowMs = 39_999;
    await service.getSummary();
    expect(loadSummary).toHaveBeenCalledTimes(1);

    nowMs = 40_000;
    const refreshed = await service.getSummary();
    expect(refreshed.modelDigestMismatchCount).toBe('3');
    expect(loadSummary).toHaveBeenCalledTimes(2);
  });

  test('does not cache a failed database read', async () => {
    const loadSummary = jest.fn()
      .mockRejectedValueOnce(new Error('temporary database issue'))
      .mockResolvedValueOnce({ model_digest_mismatch_count: '1', last_model_digest_mismatch_at: null });
    const service = createOllamaVerificationRuntimeMismatchSummaryService({
      database: {},
      loadSummary,
      now: () => 1_000,
    });

    await expect(service.getSummary()).rejects.toThrow('temporary database issue');
    await expect(service.getSummary()).resolves.toEqual(expect.objectContaining({
      modelDigestMismatchCount: '1',
    }));
    expect(loadSummary).toHaveBeenCalledTimes(2);
  });
});
