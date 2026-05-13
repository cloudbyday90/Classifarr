/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createOllamaSettingsHandlers } from '../routes/helpers/ollamaSettingsHandlers.mjs';

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('ollamaSettingsHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('updateConfig returns persisted config when runtime refresh fails after commit', async () => {
    const persistedConfig = {
      id: 1,
      host: 'localhost',
      port: 11434,
      model: 'llama3.2',
      temperature: 0.3,
    };
    const db = {
      withTransaction: jest.fn(async () => ({ rows: [persistedConfig] })),
    };
    const logger = {
      warn: jest.fn(),
    };
    const ollamaService = {
      resetConfig: jest.fn(() => {
        throw new Error('reset failed');
      }),
    };
    const handlers = createOllamaSettingsHandlers({
      db,
      ollamaService,
      logger,
    });
    const res = createResponse();

    await handlers.updateConfig({ body: { host: 'localhost', port: 11434 } }, res);

    expect(res.json).toHaveBeenCalledWith(persistedConfig);
    expect(logger.warn).toHaveBeenCalledWith('Settings runtime refresh failed after config update', {
      context: 'ollama-settings',
      action: 'ollama-config',
      error: 'reset failed',
    });
  });
});