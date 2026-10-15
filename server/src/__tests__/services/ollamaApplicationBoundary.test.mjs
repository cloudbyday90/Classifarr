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
  for (let index = 0; index < files.length; index += 32) {
    await Promise.all(files.slice(index, index + 32).map(async file => {
      if (/\/api\/(?:generate|chat|embed(?:dings)?|tags|ps|show|version|pull|push|copy|delete)\b/.test(await readFile(join(root, file), 'utf8'))) matches.push(file);
    }));
  }
  expect(matches.sort()).toEqual([
    // historyContract validates operation labels only; it performs no provider transport.
    'ollamaGateway/client.mjs', 'ollamaGateway/contract.mjs', 'ollamaGateway/historyContract.mjs', 'ollamaGateway/transport.mjs',
    'services/embeddingProviderAdapters.mjs', 'services/healthCheckAiProvider.mjs',
    'services/localDescriptionBenchmarkClient.mjs', 'services/localStudyEmbeddingClient.mjs',
    'services/ollamaConnection.mjs', 'services/ollamaGatewayGenerationMethods.mjs',
    'services/ollamaGatewayProviderContext.mjs', 'services/ollamaGenerateRequest.mjs',
    'services/ollamaGeneration.mjs', 'services/ollamaModelWarming.mjs',
    // Diagnostic wrapper delegates to the owned gateway client; no direct provider/fallback transport.
    'services/ollamaTaskGatewayClient.mjs', 'utils/httpClient.mjs',
  ].sort());
});
