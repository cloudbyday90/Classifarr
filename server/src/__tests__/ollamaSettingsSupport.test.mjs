/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  normalizeOllamaHost,
  normalizeOllamaPort,
  sendOllamaSettingsErrorResponse,
} from '../routes/helpers/ollamaSettingsSupport.mjs';

describe('ollamaSettingsSupport', () => {
  test('normalizes Ollama host values for partial updates', () => {
    expect(normalizeOllamaHost(undefined)).toBeUndefined();
    expect(normalizeOllamaHost(null)).toBe('');
    expect(normalizeOllamaHost('  host.docker.internal  ')).toBe('host.docker.internal');
  });

  test('normalizes Ollama port values for partial updates', () => {
    expect(normalizeOllamaPort(undefined)).toBeUndefined();
    expect(normalizeOllamaPort('11434')).toBe(11434);
    expect(normalizeOllamaPort('bad-port')).toBeNull();
    expect(normalizeOllamaPort(0)).toBeNull();
  });

  test('applies the shared Ollama error response shape', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    sendOllamaSettingsErrorResponse(res, new Error('ollama failed'));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'ollama failed' });
  });
});
