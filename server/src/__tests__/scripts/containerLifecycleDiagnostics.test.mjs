/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readContainerLifecycleEvents, formatContainerLifecycleEvents } from '../../../../scripts/lib/containerLifecycleDiagnostics.mjs';

const event = (fields = {}) => ({ component: 'EmbeddedDatabaseStartup', status: 'failed',
  reason: 'database_startup_process_exited', ...fields });

test('projects fixed startup events and keeps per-stream ordering, not raw fields', () => {
  const result = readContainerLifecycleEvents({
    stdout: [event({ status: 'starting', reason: undefined }), event({ secret: 'private', elapsedSeconds: 123 })]
      .map(value => JSON.stringify(value)).join('\n'),
    stderr: JSON.stringify({ component: 'EmbeddedSupervisor', status: 'stopping', reason: 'application_exit', message: 'private' }),
  });
  expect(result).toEqual({ events: [
    { component: 'EmbeddedDatabaseStartup', status: 'starting', stream: 'stdout' },
    { ...event(), stream: 'stdout' },
    { component: 'EmbeddedSupervisor', status: 'stopping', reason: 'application_exit', stream: 'stderr' },
  ], limited: false });
  expect(JSON.stringify(result)).not.toContain('private');
});

test.each([
  'null', '[]', '123', 'invalid', '::error::' + JSON.stringify(event()),
  JSON.stringify(event({ component: '__proto__' })), JSON.stringify(event({ status: 'private' })),
  JSON.stringify(event({ status: ['failed'] })), JSON.stringify(event({ component: ['EmbeddedDatabaseStartup'] })),
])('ignores malformed or unknown events without publishing %s', text => {
  expect(readContainerLifecycleEvents({ stdout: text }).events).toEqual([]);
});

test('unknown or wrong-component reason and phase are omitted, not echoed or guessed', () => {
  for (const reason of ['database_startup_private_secret', 'database_unavailable', { secret: 'private' }]) {
    expect(readContainerLifecycleEvents({ stdout: JSON.stringify(event({ reason, phase: 'private' })) }).events)
      .toEqual([{ component: 'EmbeddedDatabaseStartup', status: 'failed', stream: 'stdout' }]);
  }
  expect(readContainerLifecycleEvents({ stderr: JSON.stringify(event({ status: 'waiting', reason: undefined,
    phase: 'starting_or_recovering' })) }).events[0].phase).toBe('starting_or_recovering');
});

test('retains only a bounded event tail per stream and discloses truncation', () => {
  const text = Array.from({ length: 20 }, (_, i) => JSON.stringify(event({ status: i ? 'failed' : 'starting' }))).join('\n');
  const result = readContainerLifecycleEvents({ stdout: text, stderr: text });
  expect(result.events).toHaveLength(32);
  expect(result.events.every(item => item.status === 'failed')).toBe(true);
  expect(result.limited).toBe(true);
});

test('bounds lines, input and individual JSON events without parsing truncated fragments', () => {
  const json = JSON.stringify(event());
  for (const stdout of [json + '\n'.repeat(101), 'x'.repeat(65537) + '\n' + json,
    JSON.stringify(event({ payload: 'x'.repeat(4096) }))]) {
    expect(readContainerLifecycleEvents({ stdout }).limited).toBe(true);
  }
  expect(readContainerLifecycleEvents({ stdout: JSON.stringify(event({ payload: 'x'.repeat(4096) })) }).events).toEqual([]);
  expect(readContainerLifecycleEvents({ stdout: null, stderr: {} })).toEqual({ events: [], limited: false });
});

test.each([[1, null], [0, null], [null, 'SIGSEGV'], [null, 'SIGKILL']])('preserves only a valid startup exit tuple %j %j', (exitCode, exitSignal) => {
  const result = readContainerLifecycleEvents({ stdout: JSON.stringify(event({ exitCode, exitSignal, detail: 'private' })) });
  expect(result.events[0]).toEqual({ ...event(), stream: 'stdout', exitCode, exitSignal });
  expect(formatContainerLifecycleEvents(result)).toContain(exitSignal ?? `exit=${exitCode}`);
  expect(JSON.stringify(result)).not.toContain('private');
});

test.each([[-1, null], [256, null], ['1', null], [1, 'SIGKILL'], [null, 'SECRET'], [null, null], [1.5, null]])(
  'omits invalid startup exit tuple %j %j', (exitCode, exitSignal) => {
    expect(readContainerLifecycleEvents({ stdout: JSON.stringify(event({ exitCode, exitSignal })) }).events[0])
      .toEqual({ ...event(), stream: 'stdout' });
  });

test.each(['ready', 'parent_thread_pid_reused'])('does not attach exit evidence to %s', status => {
  const result = readContainerLifecycleEvents({ stdout: JSON.stringify(event({ status, reason: undefined, exitCode: 1, exitSignal: null })) });
  expect(result.events[0]).toEqual({ component: 'EmbeddedDatabaseStartup', status, stream: 'stdout' });
});
