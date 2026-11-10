/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createServer } from 'node:http';

const diagnostics = [], writes = [];
const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, (...args) => diagnostics.push([level, ...args])]));
const row = { ollama_model: 'synthetic:latest', temperature: 0.3, classification_disallow_partial_stream_response: true };
jest.unstable_mockModule('../../utils/logger.mjs', () => ({ createLogger: () => logger }));
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: async (sql, params) => {
  if (/^\s*SELECT/u.test(sql) && sql.includes('ai_provider_config')) return { rows: [row] };
  writes.push({ sql, params }); return { rows: [], rowCount: 1 };
} }));
const admission = { admit: jest.fn(async () => null), failed: jest.fn(async () => false), succeeded: jest.fn(async () => {}) };
jest.unstable_mockModule('../../services/classificationProviderAdmissionService.mjs', () => ({ classificationProviderAdmissionService: admission }));
jest.unstable_mockModule('../../services/providerLock.mjs', () => ({ providerLock: {
  config: { heartbeatInterval: 5000 }, acquireLock: async () => {}, heartbeat() {}, releaseLock() {},
} }));
jest.unstable_mockModule('../../services/ollamaVerificationCapabilityRuntimeInvalidationService.mjs', () => ({
  ollamaVerificationCapabilityRuntimeInvalidationService: { invalidateFromGenerationError: async () => false },
}));
const { candidatePurposeFixture } = await import('../fixtures/candidatePurposeFixture.mjs');
const { classificationAiService } = await import('../../services/classificationAiService.mjs');
const { aiRouterService } = await import('../../services/aiRouter.mjs');
const { ollamaService } = await import('../../services/ollama.mjs');

let server, url, requests, response, status, done;
beforeEach(async () => {
  diagnostics.length = 0; writes.length = 0; requests = [];
  response = JSON.stringify({ decision: 'PROPOSE', library_number: 1 }); status = 200; done = true;
  server = createServer(async (request, reply) => {
    if (request.method === 'GET') {
      requests.push({ path: request.url, body: null }); reply.setHeader('Content-Type', 'application/json');
      reply.end(JSON.stringify({ models: [{ name: 'synthetic:latest', digest: 'a'.repeat(64) }] })); return;
    }
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requests.push({ path: request.url, body }); reply.statusCode = status;
    reply.setHeader('Content-Type', request.url === '/api/generate' ? 'application/x-ndjson' : 'application/json');
    reply.end(request.url === '/api/generate'
      ? `${JSON.stringify({ model: 'synthetic:latest', done, response })}\n`
      : JSON.stringify({ choices: [{ message: { content: response } }], usage: {} }));
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  url = `http://127.0.0.1:${server.address().port}`;
  jest.spyOn(ollamaService, 'getConfig').mockResolvedValue({ baseUrl: url, host: '127.0.0.1', port: server.address().port, model: 'synthetic:latest' });
  jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({ success: true });
});
afterEach(async () => {
  jest.restoreAllMocks(); jest.clearAllMocks(); server.closeAllConnections();
  await new Promise(resolve => { server.close(resolve); });
});
const sentinel = 'Private declared purpose sentinel';
const fixture = () => candidatePurposeFixture({ configure: policy => { policy.policy_intent_contract.purpose[0].values.require_any.push(sentinel); } });
const classify = value => classificationAiService.aiClassify(value.item, value.libraries, null, { mode: 'adjudicate', candidatePurpose: value.token });
function choose(type, host = url) {
  jest.spyOn(aiRouterService, 'getProvider').mockResolvedValue({ type,
    config: { primary_provider: 'custom', api_endpoint: url, host, model: 'synthetic:latest', temperature: 0.3 } });
}

test.each(['ollama', 'custom'])('actual %s HTTP receives only its approved projection and one generation', async type => {
  const value = await fixture(); choose(type);
  const result = await classify(value);
  expect(requests).toHaveLength(1);
  const request = requests[0];
  const sent = type === 'ollama' ? request.body.prompt : request.body.messages.find(message => message.role === 'user').content;
  expect(sent.includes(sentinel)).toBe(type === 'ollama');
  expect(sent).toContain('DECLARED POSITIVE PURPOSE EVIDENCE');
  expect(request.path).toBe(type === 'ollama' ? '/api/generate' : '/chat/completions');
  expect(JSON.stringify(request.body)).not.toContain('generationConfiguration');
  expect(result.library.id).toBe(value.libraries[0].id);
  expect(JSON.stringify({ result, diagnostics, writes })).not.toContain(sentinel);
  expect(writes.some(value => value.sql.includes('INSERT INTO ai_provider_capability_metrics'))).toBe(true);
  expect(admission.admit).toHaveBeenCalledTimes(1);
  expect(ollamaService.getConfig).toHaveBeenCalledTimes(type === 'ollama' ? 1 : 0);
});

test('untrusted Ollama host classification receives aggregates even over synthetic loopback transport', async () => {
  const value = await fixture(); choose('ollama', 'https://external.example');
  await classify(value);
  expect(requests).toHaveLength(1);
  expect(requests[0].body.prompt).not.toContain(sentinel);
  expect(requests[0].body.prompt).toContain('"declaredMatch":"matched"');
});

test('a trusted selected label cannot disclose terms to an untrusted actual endpoint syntax', async () => {
  const value = await fixture(); choose('ollama');
  ollamaService.getConfig.mockResolvedValue({ baseUrl: url.replace('127.0.0.1', '[::ffff:127.0.0.1]'),
    host: '::ffff:127.0.0.1', port: server.address().port, model: 'synthetic:latest' });
  await classify(value);
  expect(requests).toHaveLength(1);
  expect(requests[0].body.prompt).not.toContain(sentinel);
  expect(requests[0].body.prompt).toContain('"declaredMatch":"matched"');
  expect(ollamaService.getConfig).toHaveBeenCalledTimes(1);
});

test('configuration mutation during preflight cannot redirect a detailed request to a replacement endpoint', async () => {
  const value = await fixture(); choose('ollama');
  let trapCalls = 0;
  const trap = createServer((_request, response) => { trapCalls++; response.end('{}'); });
  try {
    await new Promise(resolve => { trap.listen(0, '127.0.0.1', resolve); });
    ollamaService.preflightConnection.mockImplementation(async () => {
      ollamaService.getConfig.mockResolvedValue({ baseUrl: `http://127.0.0.1:${trap.address().port}`, model: 'synthetic:latest' });
      return { success: true };
    });
    await classify(value);
    expect(requests).toHaveLength(1); expect(requests[0].body.prompt).toContain(sentinel);
    expect(trapCalls).toBe(0); expect(ollamaService.getConfig).toHaveBeenCalledTimes(1);
  } finally { trap.closeAllConnections(); await new Promise(resolve => { trap.close(resolve); }); }
});

test('actual preflight and generation share the frozen configuration without another settings read', async () => {
  const value = await fixture(); choose('ollama');
  ollamaService.preflightConnection.mockRestore();
  const original = ollamaService.preflightConnection;
  ollamaService.preflightCache.clear();
  jest.spyOn(ollamaService, 'preflightConnection').mockImplementation(async options => {
    ollamaService.getConfig.mockRejectedValue(new Error('a later configuration read must not run'));
    return original.call(ollamaService, options);
  });
  const result = await classify(value);
  expect(result.library.id).toBe(value.libraries[0].id);
  expect(requests.map(request => request.path)).toEqual(['/api/tags', '/api/generate']);
  expect(requests[1].body.prompt).toContain(sentinel);
  expect(ollamaService.getConfig).toHaveBeenCalledTimes(1);
});

test('reflected raw declaration text cannot become adjudication output, history fields or a repair request', async () => {
  const value = await fixture(); choose('ollama'); response = JSON.stringify({ decision: 'PROPOSE', library_number: 1, reason: sentinel });
  const result = await classify(value);
  expect(requests).toHaveLength(1);
  expect(JSON.stringify({ result, diagnostics, writes })).not.toContain(sentinel);
  expect(result.library).toBeNull();
});

test('HTTP failure preserves the existing fixed error without retaining reflected provider fields', async () => {
  const value = await fixture(); choose('ollama'); status = 400; response = sentinel;
  await expect(classify(value)).rejects.toThrow();
  expect(requests).toHaveLength(1);
  expect(JSON.stringify({ diagnostics, writes })).not.toContain(sentinel);
});

test('incomplete reflected streams keep the existing bounded attempts and fixed persisted diagnostics', async () => {
  const value = await fixture(); choose('ollama'); done = false; response = sentinel;
  await expect(classify(value)).rejects.toThrow();
  expect(requests).toHaveLength(2);
  expect(JSON.stringify({ diagnostics, writes })).not.toContain(sentinel);
});
