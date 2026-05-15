/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  normalizeOllamaHost,
  normalizeOllamaPort,
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
});
