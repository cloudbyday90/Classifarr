/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLD_DEFAULTS,
  WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLDS_SETTING_KEY,
  WebSearchProviderGuardrailThresholdService,
  normalizeWebSearchProviderGuardrailThresholds,
} from '../../services/webSearchProviderGuardrailThresholds.mjs';

describe('webSearchProviderGuardrailThresholds', () => {
  test('normalizes missing and unsafe values to bounded defaults', () => {
    expect(normalizeWebSearchProviderGuardrailThresholds({
      enabled: 'no',
      lowSampleMultiplier: 100,
      recentHealthLookbackCount: -5,
      selectionChangeSeverity: 'loud',
      lowSampleSeverity: 'disabled',
      healthIssueSeverity: 'critical',
      cooldownSeverity: 'disabled',
      noProviderSeverity: 'warning',
    })).toEqual({
      ...WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLD_DEFAULTS,
      enabled: false,
      lowSampleMultiplier: 5,
      recentHealthLookbackCount: 0,
      lowSampleSeverity: 'disabled',
      healthIssueSeverity: 'critical',
      cooldownSeverity: 'disabled',
      noProviderSeverity: 'warning',
    });
  });

  test('loads persisted JSON from settings storage', async () => {
    const db = {
      query: jest.fn(async () => ({
        rows: [{
          value: JSON.stringify({
            enabled: true,
            lowSampleMultiplier: 1.5,
            recentHealthLookbackCount: 8,
            selectionChangeSeverity: 'warning',
          }),
          updated_at: '2026-06-25T06:00:00.000Z',
        }],
      })),
    };
    const service = new WebSearchProviderGuardrailThresholdService({ db });

    await expect(service.getThresholds()).resolves.toEqual(expect.objectContaining({
      enabled: true,
      lowSampleMultiplier: 1.5,
      recentHealthLookbackCount: 8,
      selectionChangeSeverity: 'warning',
      updatedAt: '2026-06-25T06:00:00.000Z',
    }));
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM settings'), [
      WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLDS_SETTING_KEY,
    ]);
  });

  test('updates settings using normalized persisted payloads', async () => {
    const db = {
      query: jest.fn(async (_sql, params) => ({
        rows: [{
          value: params[1],
          updated_at: '2026-06-25T06:05:00.000Z',
        }],
      })),
    };
    const service = new WebSearchProviderGuardrailThresholdService({ db });

    const saved = await service.updateThresholds({
      enabled: true,
      lowSampleMultiplier: 2,
      recentHealthLookbackCount: 12,
      selectionChangeSeverity: 'warning',
      noProviderSeverity: 'critical',
    });

    expect(saved).toEqual(expect.objectContaining({
      lowSampleMultiplier: 2,
      recentHealthLookbackCount: 12,
      selectionChangeSeverity: 'warning',
      noProviderSeverity: 'critical',
      updatedAt: '2026-06-25T06:05:00.000Z',
    }));
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (key) DO UPDATE'), [
      WEB_SEARCH_PROVIDER_GUARDRAIL_THRESHOLDS_SETTING_KEY,
      expect.stringContaining('"lowSampleMultiplier":2'),
    ]);
  });
});
