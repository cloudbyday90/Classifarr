/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createEmbeddedDatabaseControl, parseEmbeddedDatabaseIdentity } from '../bootstrap/embeddedDatabaseControl.mjs';
import { readFileSync } from 'node:fs';

const identity = '123\n/app/data/postgres\n1790000000\n5432\n';
const clean = { stdout: 'Database cluster state:               shut down\n' };
function fixture() {
  const read = jest.fn(async () => identity);
  const command = jest.fn(async kind => {
    if (kind === 'stop') read.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    return clean;
  });
  const status = jest.fn(async () => {});
  return { command, read, status, db: createEmbeddedDatabaseControl({ command, read, status }) };
}

test('adopts, checks and stops only fixed cluster with bounded commands', async () => {
  const f = fixture();
  await f.db.adopt();
  await f.db.check();
  await f.db.stop();
  expect(f.status).toHaveBeenCalledTimes(2);
  expect(f.command.mock.calls.map(call => call[0])).toEqual(['stop', 'control']);
  expect(f.command.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  await expect(f.db.stop()).rejects.toThrow('not_adopted');
  await expect(f.db.check()).rejects.toThrow('not_adopted');
});

test.each(['', '-1\n/app/data/postgres\n123', '1\n/elsewhere\n123', '1\n/app/data/postgres\nno'])('rejects malformed identity %j', text => {
  expect(() => parseEmbeddedDatabaseIdentity(text)).toThrow('identity_invalid');
});

test('does not adopt changed PID identity during initial status check', async () => {
  const f = fixture();
  f.read.mockResolvedValueOnce(identity).mockResolvedValue(identity.replace('123', '124'));
  await expect(f.db.adopt()).rejects.toThrow('identity_changed');
});

test.each(['123', '1790000000'])('replacement %s blocks check and stop before any command', async part => {
  const f = fixture();
  await f.db.adopt();
  f.command.mockClear();
  f.read.mockResolvedValue(identity.replace(part, `${part}1`));
  await expect(f.db.check()).rejects.toThrow('identity_changed');
  await expect(f.db.stop()).rejects.toThrow('identity_changed');
  expect(f.command).not.toHaveBeenCalled();
});

test('unadopted controller cannot stop a database', async () => {
  const f = fixture();
  await expect(f.db.stop()).rejects.toThrow('not_adopted');
  expect(f.command).not.toHaveBeenCalled();
});

test.each([false, true])('identity change after status overrides transient failure=%s', async transient => {
  const f = fixture();
  await f.db.adopt();
  f.read.mockResolvedValueOnce(identity).mockResolvedValue(identity.replace('123', '124'));
  if (transient) f.status.mockRejectedValue(Object.assign(new Error('busy'), { code: 'database_probe_timeout' }));
  await expect(f.db.check()).rejects.toThrow('identity_changed');
});

test.each(['ENOENT', 'EACCES'])('missing or unreadable identity %s is terminal before status', async code => {
  const f = fixture();
  await f.db.adopt();
  f.status.mockClear();
  f.read.mockRejectedValue(Object.assign(new Error('identity unavailable'), { code }));
  await expect(f.db.check()).rejects.toMatchObject({ code });
  expect(f.status).not.toHaveBeenCalled();
});

test('confirmed status failure is not delayed by another identity read', async () => {
  const f = fixture();
  await f.db.adopt();
  f.read.mockClear();
  f.status.mockRejectedValue(new Error('database_not_running'));
  await expect(f.db.check()).rejects.toThrow('database_not_running');
  expect(f.read).toHaveBeenCalledTimes(1);
});

test('abort during identity I/O prevents a late status command', async () => {
  const f = fixture(), controller = new AbortController();
  await f.db.adopt();
  f.status.mockClear();
  f.read.mockImplementation(async options => {
    expect(options.signal).toBe(controller.signal);
    controller.abort();
    return identity;
  });
  await expect(f.db.check({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.status).not.toHaveBeenCalled();
});

test.each([true, false])('missing PID requires clean control data=%s, never sends a stop', async isClean => {
  const f = fixture();
  await f.db.adopt();
  f.command.mockClear();
  f.read.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  if (!isClean) f.command.mockResolvedValue({ stdout: 'Database cluster state: in production\n' });
  if (isClean) await f.db.stop();
  else await expect(f.db.stop()).rejects.toThrow('shutdown_unconfirmed');
  expect(f.command.mock.calls.map(call => call[0])).toEqual(['control']);
});

test('permission error never causes blind stop', async () => {
  const f = fixture();
  await f.db.adopt();
  f.command.mockClear();
  f.read.mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }));
  await expect(f.db.stop()).rejects.toThrow('denied');
  expect(f.command).not.toHaveBeenCalled();
});

test.each(['adopt', 'check', 'stop'])('propagates %s command failure', async method => {
  const f = fixture();
  if (method !== 'adopt') await f.db.adopt();
  (method === 'stop' ? f.command : f.status).mockRejectedValue(new Error('command failed'));
  await expect(f.db[method]()).rejects.toThrow('command failed');
});

test('a PID that reappears after stop/control confirmation is not clean shutdown', async () => {
  const f = fixture();
  await f.db.adopt();
  f.command.mockResolvedValue(clean);
  await expect(f.db.stop()).rejects.toThrow('shutdown_unconfirmed');
  await expect(f.db.stop()).rejects.toThrow('not_adopted');
  expect(f.command).toHaveBeenCalledTimes(2);
});

test('pending check prevents a concurrent stop command', async () => {
  const f = fixture();
  await f.db.adopt();
  let finish;
  f.status.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const check = f.db.check();
  await new Promise(resolve => { setImmediate(resolve); });
  await expect(f.db.stop()).rejects.toThrow('operation_busy');
  expect(f.command).not.toHaveBeenCalled();
  finish(); await check;
});

test.each(['adopt', 'stop'])('stalled %s identity read has a deadline and cannot issue late commands', async method => {
  jest.useFakeTimers();
  try {
    const f = fixture();
    if (method === 'stop') await f.db.adopt();
    f.status.mockClear();
    let finish;
    f.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const assertion = expect(f.db[method]()).rejects.toMatchObject({ code: 'database_operation_unjoined' });
    await jest.advanceTimersByTimeAsync(method === 'stop' ? 26_000 : 6000);
    await assertion;
    finish(identity);
    await jest.advanceTimersByTimeAsync(0);
    expect(f.status).not.toHaveBeenCalled();
    expect(f.command).not.toHaveBeenCalled();
    await expect(f.db.stop()).rejects.toThrow('not_adopted');
    await expect(f.db.adopt()).rejects.toThrow('adoption_unavailable');
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test('host cancellation during adoption joins the read without granting ownership', async () => {
  const f = fixture(), controller = new AbortController();
  f.read.mockImplementation(async ({ signal }) => {
    controller.abort();
    await Promise.resolve();
    signal.throwIfAborted();
    return identity;
  });
  await expect(f.db.adopt({ signal: controller.signal })).rejects.toMatchObject({ code: 'database_operation_cancelled' });
  await expect(f.db.stop()).rejects.toThrow('not_adopted');
  expect(f.status).not.toHaveBeenCalled();
  expect(f.command).not.toHaveBeenCalled();
});

test('late stop helper completion cannot run control-data confirmation or retry', async () => {
  jest.useFakeTimers();
  try {
    const f = fixture();
    await f.db.adopt();
    let finish;
    f.command.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const assertion = expect(f.db.stop()).rejects.toMatchObject({ code: 'database_operation_unjoined' });
    await jest.advanceTimersByTimeAsync(26_000); await assertion;
    finish(clean); await jest.advanceTimersByTimeAsync(0);
    expect(f.command.mock.calls.map(call => call[0])).toEqual(['stop']);
    await expect(f.db.stop()).rejects.toThrow('not_adopted');
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test('entrypoint retains privilege drop and embedded guard, with sufficient Compose grace', () => {
  const shell = readFileSync(new URL('../../../docker-entrypoint.sh', import.meta.url), 'utf8');
  expect(shell).toContain('exec su-exec classifarr node src/scripts/runEmbeddedSupervisor.mjs --run');
  expect(shell).toContain('exec node src/scripts/runEmbeddedSupervisor.mjs --run');
  expect(shell).toContain('provisionEmbeddedIdentity.mjs --apply');
  const policy = readFileSync(new URL('../bootstrap/embeddedStartupPolicy.mjs', import.meta.url), 'utf8');
  expect(policy).toContain('External schema maintenance is not supported');
  for (const name of ['docker-compose.yml', 'docker-compose.unraid.yml', 'docker-compose.synology.yml']) {
    expect(readFileSync(new URL(`../../../${name}`, import.meta.url), 'utf8')).toContain('stop_grace_period: 60s');
  }
});
