/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { canonicalStudyModel, createLocalStudyEmbeddingClient, resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';

let server;
let config;
let mode;
let requests;
beforeEach(async () => {
  mode = 'normal';
  requests = [];
  server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ path: request.url, body: body ? JSON.parse(body) : null });
    response.setHeader('Content-Type', 'application/json');
    if (mode === 'redirect') { response.writeHead(307, { Location: '/private' }); response.end(); return; }
    if (mode === 'oversized') { response.end('x'.repeat(4 * 1024 * 1024 + 1)); return; }
    if (mode === 'error') { response.writeHead(500); response.end('{"error":"PRIVATE provider detail"}'); return; }
    if (mode === 'malformed') { response.end('not JSON'); return; }
    if (request.url === '/api/tags') {
      response.end(JSON.stringify({ models: [{ name: 'test:latest', digest: 'a'.repeat(64), ...(mode === 'remote' ? { remote_host: 'https://example.com' } : {}) }] }));
    } else if (request.url === '/api/show') {
      response.end(JSON.stringify({ capabilities: mode === 'no_embedding' ? ['completion'] : ['embedding'] }));
    } else if (request.url === '/api/embed') {
      const { input } = JSON.parse(body);
      response.end(JSON.stringify({ model: mode === 'different_model' ? 'other' : 'test',
        embeddings: mode === 'wrong_count' ? [] : input.map(() => mode === 'zero' ? [0, 0] : [3, 4]) }));
    } else { response.writeHead(404); response.end('{}'); }
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  config = { rag_enabled: true, embedding_provider_mode: 'same', primary_provider: 'ollama',
    ollama_host: '127.0.0.1', ollama_port: server.address().port, embedding_model: 'test' };
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise(resolve => { server.close(resolve); });
});

test('uses installed local identity and sends ordered batches without hidden truncation', async () => {
  const client = createLocalStudyEmbeddingClient(config);
  expect(await client.inspect()).toEqual({ provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64) });
  expect(await client.embedBatch(['one', 'two'], { dimensions: 2 })).toEqual([[3, 4], [3, 4]]);
  expect(requests.map(request => request.path)).toEqual(['/api/tags', '/api/show', '/api/embed']);
  expect(requests[2].body).toEqual({ model: 'test:latest', input: ['one', 'two'], truncate: false, keep_alive: '5m' });
});

test.each(['redirect', 'oversized', 'error', 'malformed', 'remote', 'no_embedding'])('rejects %s preflight without inference or redirected requests', async value => {
  mode = value;
  await expect(createLocalStudyEmbeddingClient(config).inspect()).rejects.toThrow();
  expect(requests.every(request => ['/api/tags', '/api/show'].includes(request.path))).toBe(true);
});

test.each(['different_model', 'wrong_count', 'zero'])('rejects %s embedding response', async value => {
  mode = value;
  await expect(createLocalStudyEmbeddingClient(config).embedBatch(['one'], { dimensions: 2 })).rejects.toThrow();
});

test('rejects dimensions, batch budgets, and cancellation before an HTTP request', async () => {
  const client = createLocalStudyEmbeddingClient(config);
  for (const texts of [[], Array(9).fill('x'), ['x'.repeat(1001)], ['']]) {
    await expect(client.embedBatch(texts, { dimensions: 2 })).rejects.toThrow('local_study_embedding_batch_invalid');
  }
  await expect(client.embedBatch(['one'], { dimensions: 0 })).rejects.toThrow();
  await expect(client.inspect({ signal: AbortSignal.abort() })).rejects.toThrow();
  expect(requests).toHaveLength(0);
});

test.each([
  { primary_provider: 'openai' }, { embedding_provider_mode: 'cloud' }, { rag_enabled: false },
  { ollama_host: 'example.com' }, { ollama_host: 'https://127.0.0.1/private' },
  { ollama_host: 'http://user:pass@127.0.0.1' }, { ollama_port: 70000 }, { embedding_model: 'model:cloud' },
])('rejects unsupported configuration %j before network access', override => {
  const fetchRequest = jest.fn();
  expect(() => createLocalStudyEmbeddingClient({ ...config, ...override }, { fetchRequest })).toThrow();
  expect(fetchRequest).not.toHaveBeenCalled();
});

test('uses only explicit separate-Ollama settings when that mode is selected', () => {
  const local = resolveLocalStudyEmbeddingConfig({ ...config, embedding_provider_mode: 'separate_ollama',
    embedding_ollama_host: 'http://127.0.0.1', embedding_ollama_port: 12000, embedding_ollama_model: 'different:tag' });
  expect(local).toEqual({ baseUrl: 'http://127.0.0.1:12000', model: 'different:tag' });
  expect(canonicalStudyModel('test')).toBe(canonicalStudyModel('test:latest'));
});
