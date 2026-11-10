/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { holdOllamaGenerationConfiguration, readOllamaGenerationConfiguration } from '../../services/ollamaGenerationConfigurationSnapshot.mjs';

test('opaque generation handles retain one exact configuration without exposing or accepting copied fields', async () => {
  const config = { host: '127.0.0.1', port: 11434, baseUrl: 'http://127.0.0.1:11434', model: 'synthetic:latest' };
  const get = jest.fn(async () => config), token = await holdOllamaGenerationConfiguration(get);
  const saved = { ...config }; config.baseUrl = 'http://127.0.0.1:9';
  expect(get).toHaveBeenCalledTimes(1);
  expect(readOllamaGenerationConfiguration(token)).toEqual(saved);
  expect(Object.isFrozen(readOllamaGenerationConfiguration(token))).toBe(true);
  expect(JSON.stringify(token)).toBe('{}');
  expect(readOllamaGenerationConfiguration({ ...token })).toBeNull();
  expect(readOllamaGenerationConfiguration({ ...saved })).toBeNull();
});
