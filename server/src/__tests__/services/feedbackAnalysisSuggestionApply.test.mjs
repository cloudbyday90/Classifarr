/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

import {
  createLoggerModuleMock,
  createNamedMockModule,
} from '../helpers/mockFactory.mjs';

const client = {
  query: jest.fn(),
};
const database = {
  withTransaction: jest.fn(async (work) => work(client)),
};
const logger = createLoggerModuleMock();

jest.unstable_mockModule(
  '../../config/database.mjs',
  () => createNamedMockModule('pool', database)
);
jest.unstable_mockModule('../../utils/logger.mjs', () => logger.module);

const { applySuggestion } = await import('../../services/feedbackAnalysisSuggestionApply.mjs');

describe('feedbackAnalysisSuggestionApply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database.withTransaction.mockImplementation(async (work) => work(client));
  });

  test('does not apply a legacy tuning suggestion to a policy with active native intent', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 18,
          policy_id: 44,
          suggestion_type: 'adjust_threshold',
          suggestion_config: {
            threshold_type: 'auto_classify',
            recommended: 90,
          },
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 44,
          library_id: 6,
          native_intent_active: true,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 18, policy_id: 44, status: 'pending',
        suggestion_type: 'adjust_threshold', suggestion_config: { threshold_type: 'auto_classify', recommended: 90 } }] });

    await expect(applySuggestion(18, 7)).rejects.toMatchObject({
      statusCode: 409,
      code: 'POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED',
    });

    expect(client.query).toHaveBeenCalledTimes(4);
    expect(client.query.mock.calls.some(([sql]) => (
      /UPDATE library_policies/i.test(sql)
    ))).toBe(false);
  });
});
