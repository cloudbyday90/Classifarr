/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, afterAll, test, expect, jest } from '@jest/globals';
import { writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { gatewayTlsFixture } from './helpers/gatewayTlsFixture.mjs';
import { loadOllamaRoutingStartup } from '../bootstrap/ollamaRoutingStartup.mjs';
import { startApplication } from '../bootstrap/startApplication.mjs';
import { getOllamaApplicationBinding } from '../services/ollamaApplicationScope.mjs';

let tls, path;
beforeAll(async () => { tls = await gatewayTlsFixture(); path = join(tls.directory, 'routing.json'); });
afterAll(async () => { await tls?.close(); });
function document() {
  const upstream = 'http://127.0.0.1:11434';
  const common = { url: 'https://127.0.0.1:11435', upstream, models: ['synthetic:latest'], ca: tls.cert };
  return { revision: 1, configuration: { baseUrl: upstream, model: 'synthetic:latest' },
    foreground: { ...common, token: 'a'.repeat(43) }, background: { ...common, token: 'b'.repeat(43) } };
}
async function save(value) { await writeFile(path, JSON.stringify(value), { mode: 0o600 }); await chmod(path, 0o600); }
const environment = () => ({ CLASSIFARR_OLLAMA_ROUTING_FILE: path });
function options() {
  return { database: {}, environment: environment(), processRef: new EventEmitter(), onAdmissionLost: jest.fn(),
    acquireAdmission: jest.fn().mockResolvedValue({ assertHealthy() {}, release() {} }),
    loadNormal: jest.fn(), loadRestore: jest.fn() };
}
test('absent setting does no work; explicit blank path refuses', async () => {
  expect(await loadOllamaRoutingStartup({})).toBeNull();
  await expect(loadOllamaRoutingStartup({ CLASSIFARR_OLLAMA_ROUTING_FILE: '' })).rejects.toThrow('gateway_application_config_invalid');
});
test.each(['http', 'ca', 'duplicate', 'revision', 'unknown', 'model', 'extra'])('invalid %s fails before admission/import without exposing content', async kind => {
  const value = document();
  if (kind === 'http') value.foreground.url = 'http://127.0.0.1:11435';
  if (kind === 'ca') value.background.ca = 'private-test-error-content';
  if (kind === 'duplicate') value.background.token = value.foreground.token;
  if (kind === 'revision') value.revision = 0;
  if (kind === 'unknown') value.configuration.password = 'private-test-error-content';
  if (kind === 'model') value.configuration.model = 'unapproved:latest';
  if (kind === 'extra') value.foreground.rejectUnauthorized = false;
  await save(value); const settings = options();
  await expect(startApplication(settings)).rejects.toThrow('gateway_application_config_invalid');
  expect(settings.acquireAdmission).not.toHaveBeenCalled(); expect(settings.loadNormal).not.toHaveBeenCalled();
});
test('imports, initialization, timers and late callbacks inherit owner; server close fences retained scope', async () => {
  await save(document()); const settings = options(), server = new EventEmitter(); let owner, later;
  settings.loadNormal.mockImplementation(async () => {
    owner = getOllamaApplicationBinding(); expect(owner).not.toBeNull();
    later = new Promise(resolve => { setTimeout(() => resolve(getOllamaApplicationBinding()), 5); });
    return { registerServerProcessHandlers() { expect(getOllamaApplicationBinding()).toBe(owner); },
      async startServer() { expect(getOllamaApplicationBinding()).toBe(owner); return server; } };
  });
  expect(await startApplication(settings)).toBe(server);
  expect(await later).toBe(owner); expect(getOllamaApplicationBinding()).toBeNull();
  server.emit('close'); expect(() => owner.run(() => {})).toThrow('gateway_client_closed');
  expect(settings.processRef.listenerCount('SIGTERM')).toBe(0);
});
test.each(['SIGTERM', 'SIGINT', 'exit', 'uncaughtExceptionMonitor', 'admission', 'failure'])('%s closes captured scope', async reason => {
  await save(document()); const settings = options(); let owner;
  settings.loadNormal.mockImplementation(async () => {
    owner = getOllamaApplicationBinding();
    if (reason === 'failure') throw new Error('fixture_failure');
    return { registerServerProcessHandlers() {}, async startServer() { return new EventEmitter(); } };
  });
  if (reason === 'failure') await expect(startApplication(settings)).rejects.toThrow('fixture_failure');
  else { await startApplication(settings);
    if (reason === 'admission') settings.acquireAdmission.mock.calls[0][0].onLost();
    else settings.processRef.emit(reason);
  }
  expect(() => owner.run(() => {})).toThrow('gateway_client_closed');
});
test('signal during admission prevents normal import', async () => {
  await save(document()); const settings = options();
  settings.acquireAdmission.mockImplementation(async () => { settings.processRef.emit('SIGTERM'); return { assertHealthy() {}, release() {} }; });
  await expect(startApplication(settings)).rejects.toThrow('gateway_client_closed'); expect(settings.loadNormal).not.toHaveBeenCalled();
});
test('restore ignores even invalid gateway configuration and loads no normal services', async () => {
  const settings = options(); settings.environment.CLASSIFARR_RUNTIME_MODE = 'restore';
  settings.environment.CLASSIFARR_OLLAMA_ROUTING_FILE = '';
  settings.loadRestore.mockResolvedValue({ startRestoreServer: () => 'restore' });
  expect(await startApplication(settings)).toBe('restore'); expect(settings.acquireAdmission).not.toHaveBeenCalled();
});
