/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { afterEach, expect, jest, test } from '@jest/globals';
import { createLocalStudyEmbeddingClient } from '../../services/localStudyEmbeddingClient.mjs';
import { createInventoryRepresentativeProfileRefresh } from '../../services/inventoryRepresentativeProfileRefresh.mjs';

let server, client, worker;
afterEach(async () => {
  worker?.stop(); client?.close();
  server?.closeAllConnections();
  if (server) await new Promise(resolve => { server.close(resolve); });
});

async function setup(handler) {
  const requests = [];
  server = createServer((request, response) => { requests.push(request.url); handler(request, response); });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const state = { rag_enabled: true, embedding_provider_mode: 'same', primary_provider: 'ollama', embedding_model: 'test',
    ollama_host: '127.0.0.1', ollama_port: server.address().port, busy: false };
  const read = jest.fn(), fit = jest.fn();
  worker = createInventoryRepresentativeProfileRefresh({ readState: async () => state, now: () => 0,
    createEmbedder: () => (client = createLocalStudyEmbeddingClient(state)), repository: { read }, fit });
  return { requests, read, fit };
}

test.each([['http_busy', 503, '{"error":"PRIVATE token"}'], ['json', 200, 'PRIVATE not JSON']])(
  'real HTTP %s failure reaches bounded worker evidence without retries or inference', async (category, status, body) => {
    const v = await setup((_request, response) => { response.writeHead(status); response.end(body); });
    expect(await worker.run()).toMatchObject({ status: 'failed', failure: { stage: 'representation_inspection', category } });
    expect(await worker.run()).toMatchObject({ status: 'cooldown' });
    expect(v.requests).toEqual(['/api/tags']);
    expect(v.read).not.toHaveBeenCalled(); expect(v.fit).not.toHaveBeenCalled();
    expect(JSON.stringify(worker.getStatus())).not.toMatch(/PRIVATE|127\.0\.0\.1|token|providerResponse|cause/);
  },
);

test('external cancellation aborts a real pending HTTP read and stays non-alarming', async () => {
  const controller = new AbortController();
  let received;
  const requestReceived = new Promise(resolve => { received = resolve; });
  const v = await setup(() => { received(); });
  const pending = worker.run({ signal: controller.signal });
  await requestReceived; controller.abort();
  expect(await pending).toMatchObject({ status: 'cancelled' });
  expect(worker.getStatus()).not.toHaveProperty('failure');
  expect(v.requests).toEqual(['/api/tags']); expect(v.read).not.toHaveBeenCalled();
});
