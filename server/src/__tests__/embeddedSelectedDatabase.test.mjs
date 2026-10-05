/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createSelectedEmbeddedDatabase } from '../bootstrap/embeddedSelectedDatabase.mjs';
import { runEmbeddedDatabaseStartup } from '../bootstrap/embeddedDatabaseStartup.mjs';

const missing = () => Object.assign(new Error('missing'), { code: 'ENOENT' });
const pid = '123\n/app/data/embedded-postgres/candidate\n1790000000\n5432\n/socket\n\n0\nready\n';
function fixture() {
  let ended = false, finish;
  const done = new Promise(resolve => { finish = result => { ended = true; resolve(result); }; });
  const read = jest.fn(async () => { if (ended) throw missing(); return pid; });
  const child = { pid: 123, done, hasExited: () => ended, detach: jest.fn(),
    signal: jest.fn(() => finish({ code: 0, signal: null })) };
  const options = { read, prepare: jest.fn(async () => ({ uid: 70, gid: 70 })),
    launch: jest.fn(() => child), control: jest.fn(async () => {}), report: jest.fn() };
  return { child, options, finish, db: createSelectedEmbeddedDatabase(options) };
}

test('starts one child, adopts its ready identity, then observes fast shutdown and clean control', async () => {
  const f = fixture();
  await f.db.adopt(); await f.db.check(); await f.db.stop();
  expect(f.options.launch).toHaveBeenCalledTimes(1);
  expect(f.options.launch).toHaveBeenCalledWith({ uid: 70, gid: 70 });
  expect(f.child.signal.mock.calls).toEqual([['SIGINT']]);
  expect(f.options.control).toHaveBeenCalledTimes(1);
  await expect(f.db.adopt()).rejects.toThrow('adoption_unavailable');
  await expect(f.db.check()).rejects.toThrow('not_adopted');
  await expect(f.db.stop()).rejects.toThrow('not_adopted');
});

test.each(['pid', 'path', 'start', 'port'])('rejects changed %s and never signals a file-selected process', async field => {
  const f = fixture(); await f.db.adopt();
  const changed = { pid: pid.replace('123', '456'), path: pid.replace('/candidate', '/source'),
    start: pid.replace('1790000000', '1790000001'), port: pid.replace('5432', '5433') };
  f.options.read.mockResolvedValue(changed[field]);
  await expect(f.db.check()).rejects.toThrow('identity_changed');
  await expect(f.db.stop()).rejects.toThrow('identity_changed');
  expect(f.child.signal).not.toHaveBeenCalled();
});

test('preflight refusal and pre-cancellation never launch', async () => {
  const f = fixture(); f.options.prepare.mockRejectedValue(new Error('unsafe_layout'));
  await expect(f.db.adopt()).rejects.toThrow('unsafe_layout');
  expect(f.options.launch).not.toHaveBeenCalled();
  const other = fixture(), controller = new AbortController(); controller.abort();
  await expect(other.db.adopt({ signal: controller.signal })).rejects.toThrow('cancelled');
  expect(other.options.prepare).not.toHaveBeenCalled();
});

test('cancellation after launch waits for the direct child before rejecting adoption', async () => {
  const f = fixture(), controller = new AbortController();
  f.options.launch.mockImplementation(() => { queueMicrotask(() => controller.abort()); return f.child; });
  await expect(f.db.adopt({ signal: controller.signal })).rejects.toThrow('cancelled');
  expect(f.child.hasExited()).toBe(true);
  expect(f.child.signal.mock.calls).toEqual([['SIGINT']]);
  await expect(f.db.stop()).rejects.toThrow('not_adopted');
});

test('a partial native PID file waits without adopting or restarting', async () => {
  const f = fixture(); let now = 0;
  f.options.read.mockResolvedValueOnce('123\n');
  const db = createSelectedEmbeddedDatabase({ ...f.options, start: options => runEmbeddedDatabaseStartup({
    ...options, now: () => now, delay: async ms => { now += ms; },
  }) });
  await db.adopt(); expect(f.options.launch).toHaveBeenCalledTimes(1); await db.stop();
});

test.each(['missing', 'not_ready', 'dead'])('runtime check refuses %s', async failure => {
  const f = fixture(); await f.db.adopt();
  if (failure === 'missing') f.options.read.mockRejectedValue(missing());
  if (failure === 'not_ready') f.options.read.mockResolvedValue(pid.replace('ready', 'stopping'));
  if (failure === 'dead') f.finish({ code: 1, signal: null });
  await expect(f.db.check()).rejects.toThrow();
});

test.each(['control', 'pid_reappears', 'unclean_exit', 'signal_failed'])('shutdown never claims success for %s', async failure => {
  const f = fixture(); await f.db.adopt();
  if (failure === 'control') f.options.control.mockRejectedValue(new Error('not_clean'));
  if (failure === 'pid_reappears') f.options.read.mockResolvedValue(pid);
  if (failure === 'unclean_exit') f.child.signal.mockImplementation(() => f.finish({ code: 1, signal: null }));
  if (failure === 'signal_failed') f.child.signal.mockImplementation(() => { throw new Error('EPERM'); });
  await expect(f.db.stop()).rejects.toThrow();
  expect(f.child.signal.mock.calls).toEqual([['SIGINT']]);
  await expect(f.db.check()).rejects.toThrow('not_adopted');
});

test('shutdown joins an already exited child without another signal', async () => {
  const f = fixture(); await f.db.adopt(); f.finish({ code: 0, signal: null });
  await f.db.stop(); expect(f.child.signal).not.toHaveBeenCalled();
});

test('overlapping checks cannot race shutdown', async () => {
  const f = fixture(); await f.db.adopt(); let resolve;
  f.options.read.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const checking = f.db.check();
  await expect(f.db.stop()).rejects.toThrow('busy');
  resolve(pid); await checking; await f.db.stop();
});
