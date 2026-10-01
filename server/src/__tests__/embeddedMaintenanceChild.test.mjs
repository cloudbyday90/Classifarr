/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { startEmbeddedMaintenance } from '../bootstrap/embeddedMaintenanceChild.mjs';

function fixture() {
  const child = Object.assign(new EventEmitter(), { pid: 42, kill: jest.fn(),
    stdout: new EventEmitter(), stderr: new EventEmitter(), stdin: Object.assign(new EventEmitter(), { end: jest.fn() }) });
  const spawnFn = jest.fn(() => child);
  const options = { kind: 'schema', parentUid: 0, identity: { name: 'postgres', uid: 70, gid: 70 }, spawnFn };
  return { child, options, spawnFn };
}
test.each(['schema', 'restore', 'indexes', 'vacuum', 'queueRecovery'])('fixed %s executable has no inherited secrets or preload hooks', async kind => {
  const f = fixture();
  const request = kind === 'restore' ? Buffer.from('{"synthetic":true}') : null;
  const job = startEmbeddedMaintenance({ ...f.options, kind, request });
  const [command, args, options] = f.spawnFn.mock.calls[0];
  expect(command).toBe('/sbin/su-exec');
  const filename = { schema: 'runDatabaseSchemaMaintenance', restore: 'runDatabaseRestoreMaintenance', indexes: 'runImageIndexMaintenance', vacuum: 'runQueueVacuumMaintenance', queueRecovery: 'runQueueRecoveryHandoff' }[kind];
  expect(args).toEqual(['70:70', '/usr/local/bin/node', `/app/src/scripts/${filename}.mjs`, kind === 'queueRecovery' ? '--assess' : '--apply']);
  expect(options).toMatchObject({ shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
  expect(options.env.NODE_OPTIONS).toBe('--max-old-space-size=512');
  expect(Object.keys(options.env).some(key => /SECRET|PASSWORD|TOKEN|PGOPTIONS|PGPASSFILE/.test(key))).toBe(false);
  expect(f.child.stdin.end).toHaveBeenCalledWith(request);
  f.child.emit('exit', 0, null);
  f.child.emit('close', 0, null);
  expect(await job.done).toEqual({ code: 0, signal: null });
});
test.each([{ kind: '../other' }, { kind: 'constructor' }, { parentUid: 1000 }, { databaseName: '../postgres' },
  { identity: { name: 'root', uid: 0, gid: 0 } }, { kind: 'restore' }, { request: Buffer.from('bad') }])('rejects invalid launch %j', change => {
  const f = fixture();
  expect(() => startEmbeddedMaintenance({ ...f.options, ...change })).toThrow();
  expect(f.spawnFn).not.toHaveBeenCalled();
});
test.each(['overflow', 'pipe-error', 'late-output'])('%s fails even if child exit code is zero', async scenario => {
  const f = fixture();
  const job = startEmbeddedMaintenance(f.options);
  if (scenario === 'late-output') f.child.emit('exit', 0, null);
  if (scenario === 'pipe-error') f.child.stdin.emit('error', new Error('EPIPE'));
  else f.child.stdout.emit('data', Buffer.alloc(65537));
  f.child.emit('exit', 0, null);
  f.child.emit('close', 0, null);
  expect((await job.done).code).toBe(1);
});
