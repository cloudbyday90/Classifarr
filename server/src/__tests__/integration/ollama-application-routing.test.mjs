/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, test } from '@jest/globals';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { createOllamaApplicationFixture } from './helpers/ollamaApplicationFixture.mjs';
import * as generation from '../../services/ollamaGeneration.mjs';
import * as connection from '../../services/ollamaConnection.mjs';
import * as warming from '../../services/ollamaModelWarming.mjs';
import { createAdapterMethods } from '../../services/embeddingProviderAdapters.mjs';
import { createLocalDescriptionBenchmarkClient } from '../../services/localDescriptionBenchmarkClient.mjs';
import { createLocalStudyEmbeddingClient } from '../../services/localStudyEmbeddingClient.mjs';
import { createOllamaVerificationSavedConfigurationClient } from '../../services/ollamaVerificationSavedConfigurationClient.mjs';
import { probeOllamaVerificationCapability } from '../../services/ollamaVerificationCapabilityProbe.mjs';
import { OperationController } from '../../utils/operationController.mjs';
import { checkOllama } from '../../services/healthCheckAiProvider.mjs';
import { ollamaService } from '../../services/ollama.mjs';

const forbidden = () => { throw new Error('direct_path_forbidden'); };
const until = async predicate => { const end = Date.now() + 3000; while (!await predicate()) { if (Date.now() > end) throw new Error('fixture_deadline'); await delay(10); } };
let fixture;
beforeEach(async () => { fixture = await createOllamaApplicationFixture(getPool()); });
afterEach(async () => { await fixture?.close(); });

test('actual application leaves dispatch via authenticated work classes and durable claims', async () => {
  const { owner, configuration, model, vectorModel, ledger, calls, classes } = fixture;
  const getConfig = async () => configuration;
  await owner.run(async () => {
    expect(await generation.generate(getConfig, 'test', model)).toBe('answer');
    expect(classes.every(value => value === 'foreground')).toBe(true); classes.length = 0;
    expect(await generation.generateWithProgress(getConfig, forbidden, 'test', model, 0, null, null, { requireDoneSignal: true })).toBe('answer');
    const controller = new OperationController({ mode: 'streaming', allowPartialOnStall: false });
    expect(await generation.streamGenerate(getConfig, forbidden, configuration, 'test', model, 0, null, controller, { requireDoneSignal: true })).toBe('answer');
    expect(classes.every(value => value === 'foreground')).toBe(true); classes.length = 0;
    expect((await connection.preflightConnection(getConfig, new Map(), { model: vectorModel })).success).toBe(true);
    expect((await connection.testConnection(getConfig)).success).toBe(true);
    expect(await connection.getModels(getConfig)).toHaveLength(2);
    expect(await connection.getLoadedModels(getConfig)).toHaveLength(2);
    expect(await connection.getVersion(getConfig)).toBe('synthetic');
    expect((await connection.probeGeneration(configuration.host, configuration.port, model)).ok).toBe(true);
    expect(await generation.embed(getConfig, forbidden, forbidden, 'test', vectorModel)).toEqual({ embedding: [0, 1], dims: 2 });
    const adapter = createAdapterMethods({ getAdaptiveTimeout: forbidden, createRetriedOperation: forbidden, recordRetry: forbidden });
    expect((await adapter.getOllamaEmbedding('test', configuration.host, configuration.port, vectorModel, {})).dims).toBe(2);
    expect((await warming.warmModel(getConfig, model)).keep_alive).toBe('5m');
    expect((await warming.warmEmbeddingModel(getConfig, vectorModel)).keep_alive).toBe('5m');
    expect((await warming.warmAllModels(getConfig)).embedding.keep_alive).toBe('5m');
    expect(classes.every(value => value === 'background')).toBe(true);
    await expect(generation.pullModel(getConfig, model)).rejects.toThrow('gateway_operation_unsupported');
  });
  const compute = calls.filter(call => ['/api/generate', '/api/embed'].includes(call.path));
  expect(compute).toHaveLength(10);
  expect(await ledger.status()).toMatchObject({ attempts: '10', state: 'ready', requestId: null });
  expect(calls.every(call => !call.authorization)).toBe(true);
  // Every upstream call had a gateway request; no leaf connected directly.
  expect(calls).toHaveLength(classes.length + 6);
});

test('precreated factories use background transport and retained schema/attempt checks', async () => {
  const { owner, settings, model, digest, ledger, classes } = fixture;
  const study = createLocalStudyEmbeddingClient(settings, { fetchRequest: forbidden });
  const benchmark = createLocalDescriptionBenchmarkClient(settings, { fetchRequest: forbidden });
  const saved = createOllamaVerificationSavedConfigurationClient({ configuration: settings });
  try {
    await owner.run(async () => {
      expect((await study.inspect()).digest).toBe(digest);
      expect(await study.embedBatch(['one', 'two'], { dimensions: 2 })).toEqual([[0, 1], [0, 1]]);
      const identity = await benchmark.inspect(); let reserved = 0;
      expect((await benchmark.generate({ prompt: 'test', count: 2, context: 8192, identity, onGenerationCall: () => { reserved++; } })).response).toBe('answer');
      expect(reserved).toBe(1);
      expect((await saved.preflightConnection()).success).toBe(true);
      // Provider deliberately returns a non-conforming answer: readiness must not claim success.
      expect((await probeOllamaVerificationCapability({ identity: { applicable: true, model, configurationRevision: 1, fingerprint: 'fixture' }, ollamaClient: saved })).statusId).not.toBe('verification_ready');
    });
    expect(classes.every(value => value === 'background')).toBe(true);
    expect(await ledger.status()).toMatchObject({ attempts: '3', state: 'ready' });
    owner.close(); const before = fixture.calls.length;
    await expect(study.inspect()).rejects.toThrow('gateway_client_closed');
    await expect(benchmark.inspect()).rejects.toThrow('gateway_client_closed');
    expect(() => saved.getVersion()).toThrow('gateway_client_closed'); expect(fixture.calls).toHaveLength(before);
  } finally { study.close(); benchmark.close(); saved.close(); }
});

test('listener and timer created inside scope retain binding for later external requests, including closure', async () => {
  const { owner, configuration, calls } = fixture;
  const server = owner.run(() => createServer((_req, res) => {
    setTimeout(() => { void connection.getVersion(async () => configuration).then(value => res.end(value), error => res.end(error.code)); }, 1);
  }));
  // Listen inside run too: it is the async resource which accepts future requests.
  await owner.run(() => new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); }));
  try {
    expect(await (await fetch(`http://127.0.0.1:${server.address().port}`)).text()).toBe('synthetic');
    owner.close();
    expect(await (await fetch(`http://127.0.0.1:${server.address().port}`)).text()).toBe('gateway_client_closed');
    expect(calls.map(call => call.path)).toEqual(['/api/version']);
  } finally { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); }
});

test.each(['close', 'replace', 'invalid_replace'])('%s aborts admitted compute and retains unknown attempt without fallback', async action => {
  const { owner, configuration, model, ledger, calls } = fixture; fixture.setHold();
  const pending = owner.run(() => generation.generate(async () => configuration, 'test', model)).catch(error => error.code);
  await until(() => calls.some(call => call.path === '/api/generate')); const before = await ledger.status();
  if (action === 'close') owner.close();
  else if (action === 'replace') owner.replace(fixture.options(2));
  else expect(() => owner.replace(fixture.options(1))).toThrow('gateway_application_config_invalid');
  expect(await pending).toBe('gateway_cancelled'); await until(fixture.disconnected);
  expect(await ledger.status()).toEqual(before);
  if (action === 'replace') await expect(owner.run(() => generation.generate(async () => configuration, 'test', model))).rejects.toMatchObject({ status: 503 });
  expect(calls.filter(call => call.path === '/api/generate')).toHaveLength(1);
});

test('gateway refusal keeps the cooldown and bypasses direct embedding retry/pull paths', async () => {
  const { owner, configuration, vectorModel, calls, ledger } = fixture; fixture.setFailure();
  const adapter = createAdapterMethods({ getAdaptiveTimeout: forbidden, createRetriedOperation: forbidden, recordRetry: forbidden });
  await expect(owner.run(() => adapter.getOllamaEmbedding('test', configuration.host, configuration.port, vectorModel, { max_retries: 3 }))).rejects.toMatchObject({ status: 503 });
  expect(calls.map(call => call.path)).toEqual(['/api/tags', '/api/embed']);
  expect(await ledger.status()).toMatchObject({ attempts: '1', state: 'cooldown' });
});

test('fresh saved health and the ordinary singleton use gateway routing, while changed settings refuse', async () => {
  const { owner, configuration, calls, classes, ledger } = fixture;
  await getPool().query('UPDATE ollama_config SET is_active = false');
  await getPool().query("UPDATE ai_provider_config SET primary_provider = 'ollama', ollama_host = $1, ollama_port = $2, ollama_model = $3 WHERE id = 1",
    [configuration.host, configuration.port, configuration.model]);
  ollamaService.resetConfig();
  try {
    await owner.run(async () => {
      expect((await checkOllama()).status).toBe('connected');
      expect(await ollamaService.getVersion()).toBe('synthetic');
      expect(await ollamaService.generate('test', configuration.model)).toBe('answer');
      const before = calls.length;
      await getPool().query('UPDATE ai_provider_config SET ollama_port = 9 WHERE id = 1');
      expect((await checkOllama()).status).not.toBe('connected');
      ollamaService.resetConfig();
      await expect(ollamaService.getVersion()).rejects.toThrow('gateway_provider_mismatch');
      expect(calls).toHaveLength(before);
    });
    expect(classes).toEqual(['background', 'background', 'foreground', 'foreground']);
    expect(await ledger.status()).toMatchObject({ attempts: '1', state: 'ready' });
  } finally { ollamaService.resetConfig(); }
});
