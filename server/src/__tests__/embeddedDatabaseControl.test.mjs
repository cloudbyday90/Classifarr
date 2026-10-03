/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createEmbeddedDatabaseControl, parseEmbeddedDatabaseIdentity } from '../bootstrap/embeddedDatabaseControl.mjs';
import { readFileSync } from 'node:fs';

const identity = '123\n/app/data/postgres\n1790000000\n5432\n';
const clean = { stdout: 'Database cluster state:               shut down\n' };
function fixture() {
  const run = jest.fn(async () => clean);
  const read = jest.fn(async () => identity);
  const status = jest.fn(async () => run('/usr/libexec/postgresql18/pg_ctl', ['-D', '/app/data/postgres', 'status'], {}));
  return { run, read, status, db: createEmbeddedDatabaseControl({ run, read, status }) };
}

test('adopts, checks and stops only fixed cluster with bounded commands', async () => {
  const f = fixture();
  await f.db.adopt();
  await f.db.check();
  await f.db.stop();
  expect(f.run.mock.calls.map(call => call[1])).toEqual([
    ['-D', '/app/data/postgres', 'status'], ['-D', '/app/data/postgres', 'status'],
    ['-D', '/app/data/postgres', '-m', 'fast', '-w', '-t', '20', 'stop'], ['/app/data/postgres'],
  ]);
  expect(f.run.mock.calls[2][2]).toMatchObject({ timeout: 22_000, shell: false, maxBuffer: 65536, env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' } });
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
  f.run.mockClear();
  f.read.mockResolvedValue(identity.replace(part, `${part}1`));
  await expect(f.db.check()).rejects.toThrow('identity_changed');
  await expect(f.db.stop()).rejects.toThrow('identity_changed');
  expect(f.run).not.toHaveBeenCalled();
});

test('unadopted controller cannot stop a database', async () => {
  const f = fixture();
  await expect(f.db.stop()).rejects.toThrow('not_adopted');
  expect(f.run).not.toHaveBeenCalled();
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
  f.read.mockImplementation(async (_path, options) => {
    expect(options.signal).toBe(controller.signal);
    controller.abort();
    return identity;
  });
  await expect(f.db.check({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.status).not.toHaveBeenCalled();
});

test('missing PID requires clean control data, never sends a stop', async () => {
  const f = fixture();
  await f.db.adopt();
  f.run.mockClear();
  f.read.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  await f.db.stop();
  expect(f.run).toHaveBeenCalledTimes(1);
  expect(f.run.mock.calls[0][0]).toContain('pg_controldata');
  f.run.mockResolvedValue({ stdout: 'Database cluster state: in production\n' });
  await expect(f.db.stop()).rejects.toThrow('shutdown_unconfirmed');
});

test('permission error never causes blind stop', async () => {
  const f = fixture();
  await f.db.adopt();
  f.run.mockClear();
  f.read.mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }));
  await expect(f.db.stop()).rejects.toThrow('denied');
  expect(f.run).not.toHaveBeenCalled();
});

test.each(['adopt', 'check', 'stop'])('propagates %s command failure', async method => {
  const f = fixture();
  if (method !== 'adopt') await f.db.adopt();
  f.run.mockRejectedValue(new Error('command failed'));
  await expect(f.db[method]()).rejects.toThrow('command failed');
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
