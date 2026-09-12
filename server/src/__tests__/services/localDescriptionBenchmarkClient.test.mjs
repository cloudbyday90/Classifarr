/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, test } from '@jest/globals';
import { createServer } from 'node:http';
import { createLocalDescriptionBenchmarkClient } from '../../services/localDescriptionBenchmarkClient.mjs';
import { candidateAdjudicationResponseSchema } from '../../services/aiResponseSchema.mjs';

let server, config, mode, requests;
const identity = { model: 'local:latest', digest: 'a'.repeat(64), contextLength: 32768 };
beforeEach(async () => {
  mode = 'normal'; requests = [];
  server = createServer(async (request, response) => {
    let text = '';
    for await (const chunk of request) text += chunk;
    const body = text ? JSON.parse(text) : null;
    requests.push({ path: request.url, body });
    if (mode === 'redirect') { response.writeHead(307, { Location: '/private' }); response.end(); return; }
    if (mode === 'oversized') { response.end('x'.repeat(1024 * 1024 + 1)); return; }
    if (mode === 'error') { response.writeHead(500); response.end('PRIVATE error'); return; }
    if (mode === 'malformed') { response.end('not json'); return; }
    const model = mode === 'reasoning' ? 'qwen3:latest' : 'local:latest';
    if (request.url === '/api/tags') response.end(JSON.stringify({ models: [{ name: model, digest: mode === 'changed' ? 'b'.repeat(64) : identity.digest,
      ...(mode === 'remote' ? { remote_host: 'https://example.com' } : {}) }] }));
    else if (request.url === '/api/show') response.end(JSON.stringify({ capabilities: mode === 'no_completion' ? [] : ['completion'],
      model_info: { 'general.architecture': 'test', 'test.context_length': 32768 } }));
    else response.end(JSON.stringify({ model: mode === 'wrong_model' ? 'other' : model, response: '{"candidate":1}',
      done: mode !== 'unfinished', done_reason: mode === 'output_limit' ? 'length' : 'stop',
      prompt_eval_count: mode === 'bad_usage' ? -1 : 100, eval_count: 5 }));
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  config = { primary_provider: 'ollama', ollama_host: '127.0.0.1', ollama_port: server.address().port, ollama_model: 'local' };
});
afterEach(async () => { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); });

test('uses saved installed local model, fixed inference controls and explicit usage without raw logging', async () => {
  const client = createLocalDescriptionBenchmarkClient(config);
  expect(await client.inspect()).toEqual(identity);
  const result = await client.generate({ prompt: 'Private synopsis', count: 3, context: 32768, identity });
  expect(result).toMatchObject({ response: '{"candidate":1}', promptTokens: 100, outputTokens: 5, inputTruncation: 'unknown', contextLimitSuspected: false });
  expect(requests.find(request => request.path === '/api/generate').body).toMatchObject({ stream: false, think: false,
    options: { temperature: 0, seed: 42, num_ctx: 32768, num_predict: 64 } });
});

test.each(['redirect', 'oversized', 'error', 'malformed', 'remote', 'no_completion', 'changed', 'wrong_model', 'unfinished', 'bad_usage'])('rejects %s', async value => {
  mode = value;
  await expect(createLocalDescriptionBenchmarkClient(config).generate({ prompt: 'Private synopsis', count: 3, context: 32768, identity })).rejects.toThrow();
  expect(requests.some(request => request.path === '/private')).toBe(false);
});

test('enforces endpoint/model/input budgets before sending private content', async () => {
  for (const invalid of [{ primary_provider: 'openai' }, { ollama_host: 'https://example.com' }, { ollama_model: 'local-cloud' }]) {
    expect(() => createLocalDescriptionBenchmarkClient({ ...config, ...invalid })).toThrow();
  }
  for (const invalid of [{ prompt: 'x'.repeat(100000) }, { context: 65536 }, { count: 5 }]) {
    await expect(createLocalDescriptionBenchmarkClient(config).generate({ prompt: 'Private synopsis', count: 3, context: 32768, identity, ...invalid })).rejects.toThrow('context_budget');
  }
  expect(requests).toHaveLength(0);
});

test('reports output limit separately from valid completion', async () => {
  mode = 'output_limit';
  expect(await createLocalDescriptionBenchmarkClient(config).generate({ prompt: 'Private synopsis', count: 3, context: 32768, identity })).toMatchObject({ outputLimitReached: true });
});

test('adjudication replay uses the production schema and counts only generation requests', async () => {
  let calls = 0;
  const client = createLocalDescriptionBenchmarkClient(config);
  await client.generate({ prompt: 'Private synopsis', count: 3, context: 32768, identity,
    responseContract: 'adjudication', onGenerationCall: () => calls++ });
  expect(calls).toBe(1);
  expect(requests.find(request => request.path === '/api/generate').body).toMatchObject({
    format: candidateAdjudicationResponseSchema, options: { num_predict: 256 } });
  await expect(client.generate({ prompt: 'Private', count: 3, context: 32768, identity, responseContract: 'unrestricted' })).rejects.toThrow('response_contract');
  mode = 'changed';
  await expect(client.generate({ prompt: 'Private', count: 3, context: 32768, identity,
    responseContract: 'adjudication', onGenerationCall: () => calls++ })).rejects.toThrow('model_changed');
  expect(calls).toBe(1);
});

test('adjudication replay follows production reasoning-model grammar bypass', async () => {
  mode = 'reasoning';
  const client = createLocalDescriptionBenchmarkClient({ ...config, ollama_model: 'qwen3' });
  await client.generate({ prompt: 'Private synopsis', count: 3, context: 32768,
    identity: { ...identity, model: 'qwen3:latest' }, responseContract: 'adjudication' });
  expect(requests.find(request => request.path === '/api/generate').body).not.toHaveProperty('format');
});

test('adjudication provider grammar is bounded to the actual two candidates', async () => {
  await createLocalDescriptionBenchmarkClient(config).generate({ prompt: 'Private synopsis', count: 2, context: 32768,
    identity, responseContract: 'adjudication' });
  expect(requests.find(request => request.path === '/api/generate').body.format.properties.library_number.anyOf)
    .toEqual([{ type: 'integer', minimum: 1, maximum: 2 }, { type: 'null' }]);
});
