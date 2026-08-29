/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  buildOllamaVerificationCapabilityOutcomeHistory,
  isOllamaVerificationCapabilityOutcomeStatusId,
} from '../../services/ollamaVerificationCapabilityOutcomeHistory.mjs';
import {
  loadOllamaVerificationCapabilityOutcomeHistory,
  recordOllamaVerificationCapabilityOutcomeHistory,
} from '../../services/ollamaVerificationCapabilityOutcomeHistoryRepository.mjs';
import {
  createOllamaVerificationCapabilityOutcomeHistoryService,
} from '../../services/ollamaVerificationCapabilityOutcomeHistoryService.mjs';

describe('ollamaVerificationCapabilityOutcomeHistory', () => {
  test('projects only fixed aggregate outcomes and identifies intermittent results', () => {
    const history = buildOllamaVerificationCapabilityOutcomeHistory([
      {
        status_id: 'verification_ready',
        outcome_count: '0004',
        last_observed_at: '2026-08-29T12:34:56.000Z',
        model: 'private-model-name',
        host: 'private-host.local',
        response: 'private model output',
      },
      {
        status_id: 'classification_only',
        outcome_count: '2',
        last_observed_at: '2026-08-29T13:34:56.000Z',
        error: 'private provider failure',
      },
      {
        status_id: 'unexpected',
        outcome_count: '999',
        last_observed_at: '2026-08-29T14:34:56.000Z',
      },
    ]);

    expect(history).toEqual({
      version: 'ollama.verification_capability_outcome_history.v1',
      windowDays: 30,
      totalTests: '6',
      signal: expect.objectContaining({ id: 'intermittent', label: 'Mixed test outcomes' }),
      outcomes: [
        {
          statusId: 'verification_ready',
          label: 'Strict verification ready',
          count: '4',
          lastObservedAt: '2026-08-29T12:34:56.000Z',
        },
        {
          statusId: 'classification_only',
          label: 'Classification only',
          count: '2',
          lastObservedAt: '2026-08-29T13:34:56.000Z',
        },
        {
          statusId: 'unavailable',
          label: 'Provider unavailable',
          count: '0',
          lastObservedAt: null,
        },
      ],
    });
    expect(JSON.stringify(history)).not.toContain('private-');
  });

  test('uses fixed status allow-list and emits safe empty history for invalid data', () => {
    expect(isOllamaVerificationCapabilityOutcomeStatusId('verification_ready')).toBe(true);
    expect(isOllamaVerificationCapabilityOutcomeStatusId('model_changed')).toBe(false);

    expect(buildOllamaVerificationCapabilityOutcomeHistory([{
      status_id: 'verification_ready',
      outcome_count: '-2',
      last_observed_at: 'not-a-timestamp',
    }])).toEqual(expect.objectContaining({
      totalTests: '0',
      signal: expect.objectContaining({ id: 'no_tests' }),
    }));
  });

  test('records one fixed daily counter and prunes expired aggregates without caller-controlled dates', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await recordOllamaVerificationCapabilityOutcomeHistory(database, 'unavailable');

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE observed_on < CURRENT_DATE - 29'),
      ['unavailable'],
    );
    expect(database.query.mock.calls[0][0]).not.toContain('model');
    expect(database.query.mock.calls[0][0]).not.toContain('prompt');
    await expect(recordOllamaVerificationCapabilityOutcomeHistory(database, 'not_applicable'))
      .rejects.toThrow('status is invalid');
  });

  test('reads only the fixed bounded aggregate and never selects individual event data', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [{ status_id: 'verification_ready', outcome_count: '3', last_observed_at: null }],
      }),
    };

    await expect(loadOllamaVerificationCapabilityOutcomeHistory(database)).resolves.toEqual([
      { status_id: 'verification_ready', outcome_count: '3', last_observed_at: null },
    ]);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('GROUP BY status_id'));
    expect(database.query.mock.calls[0][0]).not.toContain('observed_on,');
    expect(database.query.mock.calls[0][0]).not.toContain('model');
  });

  test('keeps reading and projection independently injectable', async () => {
    const loadHistory = jest.fn().mockResolvedValue([
      { status_id: 'unavailable', outcome_count: '1', last_observed_at: null },
    ]);
    const service = createOllamaVerificationCapabilityOutcomeHistoryService({
      database: {},
      loadHistory,
    });

    await expect(service.getHistory()).resolves.toEqual(expect.objectContaining({
      totalTests: '1',
      signal: expect.objectContaining({ id: 'unavailable' }),
    }));
    expect(loadHistory).toHaveBeenCalledWith({});
  });
});
