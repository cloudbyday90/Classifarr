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
  createMockLogger,
  createStandardDbMock,
} from './helpers/mockFactory.mjs';

const query = jest.fn();
const logger = createMockLogger();

jest.unstable_mockModule('../config/database.mjs', () => createStandardDbMock(query));
jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger: jest.fn(() => logger),
}));

const { getActivePolicies } = await import('../services/policyEngineQueries.mjs');

function policyRow(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    name: 'Animated Policy',
    enabled: true,
    priority: 1,
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    trust_patterns: true,
    trust_rag: true,
    trust_history: true,
    combination_mode: 'best_match',
    preset_weight: 1,
    profile_weight: 1,
    pattern_weight: 1,
    rag_weight: 1,
    history_weight: 1,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    ...overrides,
  };
}

function activeIntent(overrides = {}) {
  return {
    id: 501,
    policy_id: 14,
    library_id: 4,
    schema_version: 1,
    intent_version: 1,
    active: true,
    source: 'native_intent',
    inference_state: 'inferred',
    validation_status: 'valid',
    purpose_rule_count: 1,
    review_behavior: {},
    ...overrides,
  };
}

function rowsResult(rows = []) {
  return { rows };
}

function queryForNonAuthoritativeIntent(queryText) {
  if (queryText.includes('FROM library_policies lp')) {
    return rowsResult([policyRow()]);
  }

  if (queryText.includes('ranked_active_intents')) {
    return rowsResult([activeIntent({
      source: 'empty',
      inference_state: 'empty',
      validation_status: 'valid',
      purpose_rule_count: 0,
    })]);
  }

  if (queryText.includes('FROM policy_presets pp')) {
    return rowsResult([{
      policy_id: 14,
      id: 7,
      key: 'animation',
      name: 'Animation',
      signals: { genres: { require_any: ['Animation'] } },
      weight: 1,
      custom_signals: { keywords: { require_any: ['anime'] } },
    }]);
  }

  throw new Error(`Unexpected database query: ${queryText}`);
}

describe('policyEngineQueries native authority recovery', () => {
  beforeEach(() => {
    query.mockReset();
    Object.values(logger).forEach((method) => method.mockReset());
  });

  test('loads compatibility presets for a single non-authoritative active intent', async () => {
    query.mockImplementation(queryForNonAuthoritativeIntent);

    const policies = await getActivePolicies();

    expect(policies).toHaveLength(1);
    expect(policies[0]).toEqual(expect.objectContaining({
      presets: [expect.objectContaining({ id: 7 })],
      policy_runtime_authority: expect.objectContaining({
        sourceId: 'compatibility_bridge',
        statusId: 'compatibility_bridge_fallback',
        dependsOnCustomSignals: true,
      }),
    }));
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2][0]).toContain('FROM policy_presets pp');
  });

  test('does not load compatibility presets for ambiguous native authority', async () => {
    query.mockImplementation((queryText) => {
      if (queryText.includes('FROM library_policies lp')) {
        return rowsResult([policyRow()]);
      }

      if (queryText.includes('ranked_active_intents')) {
        return rowsResult([
          activeIntent(),
          activeIntent({ id: 502, intent_version: 2 }),
        ]);
      }

      throw new Error(`Unexpected database query: ${queryText}`);
    });

    const policies = await getActivePolicies();

    expect(policies).toHaveLength(1);
    expect(policies[0]).toEqual(expect.objectContaining({
      presets: [],
      policy_runtime_authority: expect.objectContaining({
        sourceId: 'native_intent',
        statusId: 'native_intent_authority_conflict',
        validationOk: false,
        dependsOnCustomSignals: false,
      }),
    }));
    expect(query).toHaveBeenCalledTimes(2);
  });
});
