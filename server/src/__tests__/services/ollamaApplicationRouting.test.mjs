/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
const requests = [], transports = [], direct = jest.fn(() => { throw new Error('direct_http_forbidden'); });
const query = jest.fn();
jest.unstable_mockModule('../../config/database.mjs', () => ({ query }));
jest.unstable_mockModule('../../utils/logger.mjs', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));
jest.unstable_mockModule('../../utils/httpClient.mjs', () => ({ httpGet: direct, httpPost: direct, httpStream: direct }));
jest.unstable_mockModule('../../services/embeddingHttpClient.mjs', () => ({ postEmbeddingRequest: direct }));
jest.unstable_mockModule('../../services/ollama.mjs', () => ({ ollamaService: { embed: direct } }));
jest.unstable_mockModule('../../ollamaGateway/client.mjs', () => ({ createGatewayClient: gateway => {
  const close = jest.fn(); transports.push({ gateway, close });
  return { close, async request(path, body, options = {}) {
    requests.push({ token: gateway.token, path, body, options });
    if (['/api/tags', '/api/ps'].includes(path)) return { models: [{ name: 'synthetic:latest', digest: 'a'.repeat(64) }] };
    if (path === '/api/version') return { version: 'synthetic' };
    if (path === '/api/show') return { capabilities: ['completion', 'embedding'], model_info: { 'general.architecture': 'test', 'test.context_length': 8192 } };
    if (path === '/api/embed') return { model: body.model, embeddings: [[0, 1]] };
    if (body.stream) options.onRecord({ model: body.model, done: false, response: 'part' });
    return { model: body.model, done: true, response: body.prompt ? 'answer' : '', done_reason: 'stop', prompt_eval_count: 1, eval_count: 1 };
  } };
} }));
const { createOllamaApplicationRouting } = await import('../../services/ollamaApplicationRouting.mjs');
const { getOllamaApplicationBinding, resolveOllamaApplicationClient } = await import('../../services/ollamaApplicationScope.mjs');
const generation = await import('../../services/ollamaGeneration.mjs');
const connection = await import('../../services/ollamaConnection.mjs');
const warming = await import('../../services/ollamaModelWarming.mjs');
const { createAdapterMethods } = await import('../../services/embeddingProviderAdapters.mjs');
const { checkOllama } = await import('../../services/healthCheckAiProvider.mjs');
const { createLocalStudyEmbeddingClient } = await import('../../services/localStudyEmbeddingClient.mjs');
const { createLocalDescriptionBenchmarkClient } = await import('../../services/localDescriptionBenchmarkClient.mjs');
const { createOllamaVerificationSavedConfigurationClient } = await import('../../services/ollamaVerificationSavedConfigurationClient.mjs');
const model = 'synthetic:latest', configuration = { baseUrl: 'http://127.0.0.1:11434', host: '127.0.0.1', port: 11434, model, embeddingModel: model };
const gateway = { url: 'http://127.0.0.1:11435', upstream: configuration.baseUrl, models: [model] };
const settings = { primary_provider: 'ollama', rag_enabled: true, ollama_host: configuration.host, ollama_port: configuration.port, ollama_model: model, embedding_model: model };
const options = revision => ({ revision, configuration, foreground: { ...gateway, token: `foreground-${revision}` }, background: { ...gateway, token: `background-${revision}` } });
const getConfig = async () => configuration;
let owner;
beforeEach(() => { jest.clearAllMocks(); requests.length = 0; transports.length = 0; owner = createOllamaApplicationRouting(options(1)); query.mockResolvedValue({ rows: [settings] }); });
afterEach(() => { owner.close(); expect(direct).not.toHaveBeenCalled(); });

test('all ordinary entry families share the scoped owner with fixed work classes', async () => {
  await owner.run(async () => {
    expect(await generation.generate(getConfig, 'test', model)).toBe('answer');
    expect(requests.at(-1).token).toBe('foreground-1');
    expect(await generation.generateWithProgress(getConfig, direct, 'test', model, 0, null, null, { requireDoneSignal: true })).toBe('partanswer');
    expect(requests.at(-1).token).toBe('foreground-1');
    expect(await generation.embed(getConfig, direct, direct, 'test', model, '15m')).toEqual({ embedding: [0, 1], dims: 2 });
    const adapters = createAdapterMethods({ getAdaptiveTimeout: direct, createRetriedOperation: direct, recordRetry: direct });
    expect((await adapters.getOllamaEmbedding('test', configuration.host, configuration.port, model, {})).dims).toBe(2);
    expect((await connection.testConnection(getConfig)).success).toBe(true);
    expect((await connection.preflightConnection(getConfig, new Map(), { model })).cached).toBe(false);
    expect(await connection.getVersion(getConfig)).toBe('synthetic');
    expect(await connection.getModels(getConfig)).toHaveLength(1);
    expect(await connection.getLoadedModels(getConfig)).toHaveLength(1);
    expect(await connection.isModelLoaded(getConfig, 'synthetic')).toBe(true);
    expect(await connection.isModelLoaded(getConfig, 'synthetic:other')).toBe(false);
    expect((await connection.probeGeneration(configuration.host, configuration.port, model)).ok).toBe(true);
    expect((await warming.warmModel(getConfig, model)).keep_alive).toBe('5m');
    expect((await warming.warmEmbeddingModel(getConfig, model)).keep_alive).toBe('5m');
    expect((await warming.warmAllModels(getConfig)).ai.keep_alive).toBe('5m');
    expect((await checkOllama()).status).toBe('connected');
    expect(requests.slice(4).every(request => request.token === 'background-1')).toBe(true);
    await expect(generation.pullModel(getConfig, model)).rejects.toMatchObject({ code: 'gateway_operation_unsupported' });
  });
  expect(getOllamaApplicationBinding()).toBeNull();
});

test.each(['before', 'inside'])('study and saved verification factories created %s scope cannot escape it', async creation => {
  const make = () => [createLocalStudyEmbeddingClient(settings, { fetchRequest: direct }), createLocalDescriptionBenchmarkClient(settings, { fetchRequest: direct }),
    createOllamaVerificationSavedConfigurationClient({ configuration: settings })];
  const clients = creation === 'before' ? make() : owner.run(make);
  await owner.run(async () => {
    await clients[0].inspect(); await clients[0].embedBatch(['test'], { dimensions: 2 });
    const identity = await clients[1].inspect(); let attempts = 0;
    await clients[1].generate({ prompt: 'test', count: 2, context: 8192, identity, onGenerationCall: () => { attempts++; } });
    expect(attempts).toBe(1);
    await clients[2].preflightConnection(); await clients[2].generate('test', model); await clients[2].getVersion();
  });
  expect(requests.every(request => request.token === 'background-1')).toBe(true);
  await clients[0].inspect(); // Still bound outside its creation scope.
  owner.replace(options(2)); const count = requests.length;
  await expect(clients[0].inspect()).rejects.toThrow('gateway_client_closed');
  expect(() => clients[2].getVersion()).toThrow('gateway_client_closed');
  expect(requests).toHaveLength(count);
  clients.forEach(client => client.close());
});

test('closing a borrowed client does not close the owner; private overrides cannot bypass a scope', async () => {
  const privateClient = createOllamaVerificationSavedConfigurationClient({ configuration: settings, gateway: { ...gateway, token: 'private' } });
  await owner.run(async () => {
    expect(() => privateClient.getVersion()).toThrow('gateway_scope_conflict');
    expect(() => createLocalStudyEmbeddingClient(settings, { gateway })).toThrow('gateway_scope_conflict');
    const client = createOllamaVerificationSavedConfigurationClient({ configuration: settings }); client.close();
    expect(() => client.getVersion()).toThrow('gateway_client_closed');
    expect(await connection.getVersion(getConfig)).toBe('synthetic');
  });
  privateClient.close();
});

test.each([0, 1, 1.5, NaN, 2])('invalid replacement %s fences the old binding and both transports', revision => {
  owner.run(() => {
    const next = options(revision); if (revision === 2) next.background.models = [];
    expect(() => owner.replace(next)).toThrow(/^gateway_/);
    expect(() => resolveOllamaApplicationClient(configuration)).toThrow('gateway_client_closed');
  });
  expect(transports.every(transport => transport.close.mock.calls.length > 0)).toBe(true);
  expect(() => owner.run(() => {})).toThrow('gateway_client_closed');
});

test('replacement changes both classes together; nested owners are refused, parallel scopes remain isolated', async () => {
  const other = createOllamaApplicationRouting(options(9));
  try {
    await owner.run(async () => {
      expect(() => other.run(() => {})).toThrow('gateway_scope_conflict');
      owner.replace(options(2));
      await generation.generate(getConfig, 'test', model); expect(requests.at(-1).token).toBe('foreground-2');
      await connection.getVersion(getConfig); expect(requests.at(-1).token).toBe('background-2');
    });
    await Promise.all([owner.run(async () => { await Promise.resolve(); expect(getOllamaApplicationBinding()).toBe(owner); }),
      other.run(async () => { await Promise.resolve(); expect(getOllamaApplicationBinding()).toBe(other); })]);
  } finally { other.close(); }
});

test('endpoint changes, partial overrides and model/retention mismatches refuse before dispatch', async () => {
  await owner.run(async () => {
    await expect(connection.getVersion(async () => ({ ...configuration, baseUrl: 'http://127.0.0.1:9' }))).rejects.toThrow('gateway_provider_mismatch');
    await expect(connection.getModels(getConfig, configuration.host)).rejects.toThrow('gateway_provider_mismatch');
    await expect(warming.warmModel(getConfig, 'other')).rejects.toThrow('gateway_model_mismatch');
    await expect(warming.warmModel(getConfig, model, 0)).rejects.toThrow('gateway_body_invalid');
    await expect(generation.embed(getConfig, direct, direct, 'test', 'other')).rejects.toThrow('gateway_model_mismatch');
    const adapters = createAdapterMethods({ ollamaProviderContext: {}, getAdaptiveTimeout: direct, createRetriedOperation: direct, recordRetry: direct });
    await expect(adapters.getOllamaEmbedding('test', null, null, model, {})).rejects.toThrow('gateway_scope_conflict');
  });
  expect(requests).toHaveLength(0);
});

test('closed context remains bound across a timer, without reverting to direct HTTP', async () => {
  await owner.run(async () => {
    await new Promise(resolve => { setTimeout(resolve, 1); }); owner.close();
    await expect(generation.generate(getConfig, 'test', model)).rejects.toThrow('gateway_client_closed');
    await expect(connection.getLoadedModels(getConfig)).rejects.toThrow('gateway_client_closed');
  });
  expect(requests).toHaveLength(0);
});
