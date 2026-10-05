/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { Readable, PassThrough } from 'node:stream';
import { verifySelectedMigrationThroughHandoff, readSelectedVerificationRequest, selectedVerificationEnvironment } from '../bootstrap/selectedVerificationHandoff.mjs';
import { runSelectedVerificationBootstrap } from '../bootstrap/selectedVerificationBootstrap.mjs';
import { verifySelectedMigrationRoles } from '../bootstrap/selectedMigrationRoleVerification.mjs';

const request = () => ({ environment: { NODE_OPTIONS: '--max-old-space-size=1536' }, expectedSystemId: '123456' });
const stream = value => Readable.from([Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))]);
function childFixture() {
  const child = new EventEmitter(); child.pid = 123; child.kill = jest.fn();
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.stdin = new EventEmitter(); child.stdin.end = jest.fn();
  return { child, spawnFn: jest.fn(() => child), finish: (code = 0) => { child.emit('exit', code, null); child.emit('close'); } };
}
const bootstrap = () => ({ stream: stream(request()), environment: selectedVerificationEnvironment(),
  context: { platform: 'linux', uid: 0, cwd: '/app', args: ['--verify'], umask: 0o022 },
  accounts: async () => ({ users: [{ name: 'classifarr', uid: 1000, gid: 1000 }, { name: 'postgres', uid: 70, gid: 70 }] }),
  verify: jest.fn(async () => {}) });

test('handoff preserves saved settings in bounded stdin, never argv or privileged environment', async () => {
  const f = childFixture(), value = request();
  const result = verifySelectedMigrationThroughHandoff({ ...value, ...f, platform: 'linux', uid: 0 });
  const [file, args, options] = f.spawnFn.mock.calls[0];
  expect(file).toBe('/usr/local/bin/node'); expect(args).toEqual(['/app/src/scripts/runSelectedMigrationVerification.mjs', '--verify']);
  expect(options.env).toEqual(selectedVerificationEnvironment()); expect(options.shell).toBe(false);
  expect(options.env.NODE_OPTIONS).toBe('--max-old-space-size=256');
  expect(JSON.parse(f.child.stdin.end.mock.calls[0][0])).toEqual(value);
  f.finish(); await result;
});
test.each(['NODE_OPTIONS', 'PGOPTIONS', 'LD_PRELOAD'])('rejects execution override %s before spawning', async key => {
  const f = childFixture(), value = request(); value.environment[key] = '--import=/tmp/private';
  await expect(verifySelectedMigrationThroughHandoff({ ...value, ...f, platform: 'linux', uid: 0 })).rejects.toThrow();
  expect(f.spawnFn).not.toHaveBeenCalled();
});
test('canonical request roundtrip returns compiled saved values', async () => {
  const result = await readSelectedVerificationRequest(stream(request()));
  expect(result.profile.configuration.NODE_OPTIONS).toBe('--max-old-space-size=1536');
});
test.each(['{}', '{', '{"expectedSystemId":"123","expectedSystemId":"123","environment":{"NODE_OPTIONS":"--max-old-space-size=1536"}}',
  JSON.stringify({ ...request(), extra: true }), 'x'.repeat(65537)])('invalid framing is sanitized', async text => {
  await expect(readSelectedVerificationRequest(stream(text))).rejects.toThrow('selected_verification_input_invalid');
});
test('rejects invalid UTF-8 and stalled input', async () => {
  await expect(readSelectedVerificationRequest(Readable.from([Buffer.from([255])]))).rejects.toThrow('input_invalid');
  await expect(readSelectedVerificationRequest(new PassThrough(), { timeoutMs: 5 })).rejects.toThrow('input_invalid');
});
test('bootstrap validates real account and saved mask before invoking verifier', async () => {
  const f = bootstrap(); await runSelectedVerificationBootstrap(f);
  expect(f.verify).toHaveBeenCalledWith({ expectedSystemId: '123456', signal: undefined, timeoutMs: 300000 });
});
test.each(['environment', 'uid', 'mask', 'args', 'accounts'])('bootstrap refuses %s mismatch', async failure => {
  const f = bootstrap();
  if (failure === 'environment') f.environment.POSTGRES_PASSWORD = 'private';
  if (failure === 'uid') f.context.uid = 1000;
  if (failure === 'mask') f.context.umask = 0;
  if (failure === 'args') f.context.args = ['--repair'];
  if (failure === 'accounts') f.accounts = async () => ({ users: [] });
  await expect(runSelectedVerificationBootstrap(f)).rejects.toThrow(); expect(f.verify).not.toHaveBeenCalled();
});
test('aborted handoff signals and joins child; a clean exit after cancellation is still failure', async () => {
  const f = childFixture(), controller = new AbortController();
  const result = verifySelectedMigrationThroughHandoff({ ...request(), ...f, platform: 'linux', uid: 0, signal: controller.signal });
  const rejected = expect(result).rejects.toThrow('selected_verification_failed');
  controller.abort(); expect(f.child.kill).toHaveBeenCalledWith('SIGTERM'); f.finish(); await rejected;
});
test.each(['exit', 'overflow', 'cancel'])('catalog helper fails on %s and joins output', async failure => {
  const f = childFixture(), controller = new AbortController();
  const result = verifySelectedMigrationRoles({ ...f, identity: { uid: 70, gid: 70 }, signal: controller.signal });
  const rejected = expect(result).rejects.toThrow('roles_invalid');
  if (failure === 'overflow') f.child.stdout.emit('data', Buffer.alloc(65537));
  if (failure === 'cancel') controller.abort();
  f.finish(failure === 'exit' ? 1 : 0); await rejected;
});
test('catalog helper uses fixed read-only SQL, peer identity and scrubbed client options', async () => {
  const f = childFixture(); const result = verifySelectedMigrationRoles({ ...f, identity: { uid: 70, gid: 70 } });
  const [file, args, options] = f.spawnFn.mock.calls[0];
  expect(file).toBe('/sbin/su-exec'); expect(args[0]).toBe('70:70');
  expect(args).toContain('-X'); expect(args).toContain('-w'); expect(args.at(-1)).toMatch(/^BEGIN READ ONLY;/);
  expect(args.at(-1)).toContain('pg_catalog.pg_auth_members'); expect(args.at(-1)).toContain('pg_catalog.pg_shdepend');
  expect(args.at(-1)).toContain('pg_catalog.pg_db_role_setting');
  expect(args.at(-1)).not.toContain('rolconfig');
  expect(options.env.PGOPTIONS).toContain('session_preload_libraries=');
  expect(options.env.PGPASSWORD).toBeUndefined(); expect(options.shell).toBe(false);
  f.finish(); await result;
});
