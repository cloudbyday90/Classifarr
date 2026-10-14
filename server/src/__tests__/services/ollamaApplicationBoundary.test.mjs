/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

test('new literal Ollama HTTP call sites require explicit boundary review', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const files = (await readdir(root, { recursive: true })).map(path => path.replaceAll('\\', '/'))
    .filter(path => path.endsWith('.mjs') && !path.startsWith('__tests__/'));
  const matches = [];
  for (const file of files) {
    if (/\/api\/(?:generate|chat|embed(?:dings)?|tags|ps|show|version|pull|push|copy|delete)\b/.test(await readFile(join(root, file), 'utf8'))) matches.push(file);
  }
  expect(matches.sort()).toEqual([
    'ollamaGateway/client.mjs', 'ollamaGateway/contract.mjs', 'ollamaGateway/transport.mjs',
    'services/embeddingProviderAdapters.mjs', 'services/healthCheckAiProvider.mjs',
    'services/localDescriptionBenchmarkClient.mjs', 'services/localStudyEmbeddingClient.mjs',
    'services/ollamaConnection.mjs', 'services/ollamaGatewayGenerationMethods.mjs',
    'services/ollamaGatewayProviderContext.mjs', 'services/ollamaGenerateRequest.mjs',
    'services/ollamaGeneration.mjs', 'services/ollamaModelWarming.mjs', 'utils/httpClient.mjs',
  ].sort());
});
