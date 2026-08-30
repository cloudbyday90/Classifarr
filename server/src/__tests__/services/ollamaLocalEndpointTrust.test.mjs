/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import { isTrustedLocalOllamaEndpoint } from '../../services/ollamaLocalEndpointTrust.mjs';

describe('isTrustedLocalOllamaEndpoint', () => {
  test.each([
    'ollama',
    'http://ollama:11434',
    'localhost',
    'http://127.0.0.1:11434',
    '10.0.0.8',
    '172.16.0.8',
    '192.168.50.95',
    'http://[::1]:11434',
    '[fd12::8]',
  ])('accepts a syntactically trusted local endpoint: %s', (host) => {
    expect(isTrustedLocalOllamaEndpoint(host)).toBe(true);
  });

  test.each([
    '172.32.0.8',
    '8.8.8.8',
    'ollama.example.test',
    'https://ollama.example.test',
    'http://localhost:11434/api/generate',
    'http://admin@192.168.50.95:11434',
    '',
    null,
  ])('rejects an endpoint that is not provably local: %s', (host) => {
    expect(isTrustedLocalOllamaEndpoint(host)).toBe(false);
  });
});
