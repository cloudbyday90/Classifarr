/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test,expect,jest,afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gatewayConfig } from '../ollamaGateway/contract.mjs';
import { createGatewayCredentials } from '../ollamaGateway/credentials.mjs';
import { readGatewayConfiguration } from '../ollamaGateway/configurationFile.mjs';
import { createGatewayConfigurationReload } from '../ollamaGateway/configurationReload.mjs';

const entries = ['local','other'].map(installation => ({ installation,workClass: 'foreground',token: randomBytes(32).toString('base64url') }));
const raw = (credentials = entries) => ({ upstream: 'http://127.0.0.1:11434',models: ['synthetic:latest'],credentials });
const document = () => ({ gateway: raw(),database: { host: '127.0.0.1',user: 'fixture',database: 'fixture' } });
const auth = (index = 0) => `Bearer ${entries[index].token}`;
const deferred = () => { let resolve,reject; const promise = new Promise((yes,no) => { resolve = yes; reject = no; }); return { promise,resolve,reject }; };
afterEach(() => { jest.useRealTimers(); });

test('rotation retains unchanged scopes, revokes removed tokens and never exposes credentials in principals', () => {
  const authority = createGatewayCredentials(gatewayConfig(raw())), old = authority.acquire(auth()), other = authority.acquire(auth(1));
  const replacement = { ...entries[0],token: randomBytes(32).toString('base64url') };
  authority.replace(gatewayConfig(raw([...entries,replacement])));
  expect(old.signal.aborted).toBe(false); expect(other.signal.aborted).toBe(false);
  const fresh = authority.acquire(`Bearer ${replacement.token}`);
  authority.replace(gatewayConfig(raw([entries[1],replacement])));
  expect(old.signal.reason).toMatchObject({ code: 'gateway_credentials_revoked',status: 401 });
  expect(() => authority.acquire(auth())).toThrow('gateway_unauthorized');
  expect(other.signal.aborted).toBe(false); expect(fresh.signal.aborted).toBe(false);
  expect(fresh.principal).toEqual({ installation: 'local',workClass: 'foreground' });
  authority.stop(); expect(fresh.signal.aborted).toBe(true); expect(other.signal.aborted).toBe(true);
  expect(() => authority.replace(gatewayConfig(raw()))).toThrow('gateway_cancelled');
  expect(() => authority.acquire(auth())).toThrow('gateway_cancelled');
});

test.each([{ installation: 'changed' },{ workClass: 'background' }])('principal change revokes old scope %#', change => {
  const authority = createGatewayCredentials(gatewayConfig(raw())), old = authority.acquire(auth());
  authority.replace(gatewayConfig(raw([{ ...entries[0],...change },entries[1]])));
  expect(old.signal.aborted).toBe(true); expect(authority.acquire(auth()).principal).toMatchObject(change); authority.stop();
});

test('scope cleanup is idempotent and bounded; incompatible reload preserves existing authority', () => {
  const initial = gatewayConfig(raw()), authority = createGatewayCredentials(initial);
  const scopes = Array.from({ length: 32 },() => authority.acquire(auth()));
  expect(() => authority.acquire(auth())).toThrow('gateway_busy');
  scopes[0].release(); scopes[0].release(); expect(authority.acquire(auth()).signal.aborted).toBe(false);
  for (const changes of [{ port: 12345 },{ upstream: 'http://127.0.0.1:12345' },{ models: ['other:latest'] },{ queueMs: 1 },{ timeoutMs: 250000 }]) {
    expect(() => authority.replace(gatewayConfig({ ...raw([entries[1]]),...changes }))).toThrow('gateway_reload_incompatible');
  }
  expect(scopes[1].signal.aborted).toBe(false); authority.stop();
});

test('private file reader validates JSON, byte limits, database TLS and excludes cleartext gateway credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(),'classifarr-gateway-config-')), path = join(directory,'config.json');
  try {
    await writeFile(path,JSON.stringify(document()),{ mode: 0o600 });
    const result = await readGatewayConfiguration(path);
    expect(result.config.providerHash).toHaveLength(64); expect(JSON.stringify(result)).not.toContain(entries[0].token);
    for (const input of ['{',Buffer.from([0xff]),' '.repeat(65537),JSON.stringify({ ...document(),extra: true }),
      JSON.stringify({ ...document(),database: { host: '10.0.0.1',user: 'fixture',database: 'fixture' } }),
      JSON.stringify({ ...document(),database: { ...document().database,ssl: { rejectUnauthorized: false } } })]) {
      await writeFile(path,input); await expect(readGatewayConfiguration(path)).rejects.toThrow();
    }
    await expect(readGatewayConfiguration(directory)).rejects.toThrow();
    await expect(readGatewayConfiguration('')).rejects.toThrow('gateway_config_invalid');
  } finally { await rm(directory,{ recursive: true,force: true }); }
});

function reloader(load) {
  const initial = { config: gatewayConfig(raw()),database: document().database };
  const apply = jest.fn(), onReload = jest.fn(), onFailure = jest.fn();
  return { initial,apply,onReload,onFailure,control: createGatewayConfigurationReload({ initial,load,apply,onReload,onFailure }) };
}

test('reload serializes reads and coalesces repeated requests into one follow-up', async () => {
  const first = deferred(), load = jest.fn().mockReturnValueOnce(first.promise);
  const fixture = reloader(load); load.mockResolvedValue(fixture.initial);
  const pending = fixture.control.reload(); await Promise.resolve();
  for (let i = 0; i < 20; i++) expect(fixture.control.reload()).toBe(pending);
  expect(load).toHaveBeenCalledTimes(1); first.resolve(fixture.initial); await pending;
  expect(load).toHaveBeenCalledTimes(2); expect(fixture.apply).toHaveBeenCalledTimes(2);
  expect(fixture.onReload).toHaveBeenCalledTimes(2); expect(fixture.onFailure).not.toHaveBeenCalled(); fixture.control.stop();
});

test.each(['invalid','database','apply'])('reload %s failure stops further reloads without disclosing exceptions', async kind => {
  const load = jest.fn(), fixture = reloader(load);
  if (kind === 'invalid') load.mockRejectedValue(new Error('PRIVATE file contents'));
  else load.mockResolvedValue({ ...fixture.initial,database: kind === 'database' ? { ...fixture.initial.database,password: 'PRIVATE' } : fixture.initial.database });
  if (kind === 'apply') fixture.apply.mockImplementation(() => { throw new Error('PRIVATE config'); });
  await fixture.control.reload(); await fixture.control.reload();
  expect(load).toHaveBeenCalledTimes(1); expect(fixture.onFailure).toHaveBeenCalledWith(); expect(fixture.onFailure).toHaveBeenCalledTimes(1);
  expect(fixture.onReload).not.toHaveBeenCalled();
});

test('five-second deadline shuts down once and late reads cannot publish', async () => {
  jest.useFakeTimers(); const read = deferred(), fixture = reloader(() => read.promise);
  const pending = fixture.control.reload(); await jest.advanceTimersByTimeAsync(5000); await pending;
  expect(fixture.onFailure).toHaveBeenCalledTimes(1); read.resolve(fixture.initial); await Promise.resolve();
  expect(fixture.apply).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});

test('shutdown fences pending reads, clears deadlines and rejects follow-up work', async () => {
  jest.useFakeTimers(); const read = deferred(), load = jest.fn(() => read.promise), fixture = reloader(load);
  const pending = fixture.control.reload(); await Promise.resolve(); fixture.control.reload(); fixture.control.stop(); await pending;
  read.resolve(fixture.initial); await fixture.control.reload();
  expect(load).toHaveBeenCalledTimes(1); expect(fixture.apply).not.toHaveBeenCalled(); expect(fixture.onFailure).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});
