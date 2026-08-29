/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import {
  createOllamaVerificationSavedConfigurationClient,
} from '../../services/ollamaVerificationSavedConfigurationClient.mjs';

test('saved compatibility transport rejects malformed or credential-bearing saved targets', () => {
  expect(() => createOllamaVerificationSavedConfigurationClient({
    configuration: { ollama_host: 'http://user:secret@ollama.local' },
  })).toThrow('Saved Ollama configuration has no valid local host.');

  expect(() => createOllamaVerificationSavedConfigurationClient({
    configuration: { ollama_host: 'https://ollama.local' },
  })).toThrow('Saved Ollama configuration has no valid local host.');

  expect(() => createOllamaVerificationSavedConfigurationClient({
    configuration: { ollama_host: 'ollama.local/path' },
  })).toThrow('Saved Ollama configuration has no valid local host.');
});
