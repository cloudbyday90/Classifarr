/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildOllamaGenerateRequest } from '../../services/ollamaGenerateRequest.mjs';

describe('Ollama generate request builder', () => {
  test('places normal generation controls in Ollama runtime options', () => {
    expect(buildOllamaGenerateRequest({
      model: 'gemma4:e4b',
      prompt: 'Classify this media item.',
      stream: true,
      temperature: 0.3,
    })).toEqual({
      model: 'gemma4:e4b',
      prompt: 'Classify this media item.',
      stream: true,
      options: { temperature: 0.3 },
    });
  });

  test('uses deterministic runtime options for a structured-output request', () => {
    const format = {
      type: 'object',
      properties: { status: { type: 'string' } },
      required: ['status'],
    };

    expect(buildOllamaGenerateRequest({
      model: 'gemma4:e4b',
      prompt: 'Return JSON.',
      stream: false,
      temperature: 0.7,
      format,
    })).toEqual({
      model: 'gemma4:e4b',
      prompt: 'Return JSON.',
      stream: false,
      format,
      options: { temperature: 0 },
    });
  });
});
