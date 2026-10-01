/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { checkEmbeddedSupervisor } from '../../../../scripts/lib/embeddedSupervisorChecks.mjs';
import { runEmbeddedIsolationCompose } from '../../../../scripts/lib/embeddedIsolationCompose.mjs';

function fixture() {
  let exitCode = 0;
  let forced = false;
  const command = jest.fn(args => {
    const [action] = args;
    if (action === 'up') exitCode = 0;
    if (action === 'ps') return JSON.stringify([{ State: 'exited', ExitCode: exitCode }]);
    if (action === 'logs') return '{"status":"database_stopped"}\n{"component":"EmbeddedQueueMaintenance","status":"available","authority":"shared_identity"}';
    if (action === 'run') return 'Database cluster state: shut down\n';
    if (action === 'exec' && args[3] === 'ps') return 'node src/scripts/runEmbeddedSupervisor.mjs --run';
    if (action === 'exec' && args[3] === 'stat') return args[2] === 'runtime' ? '1000' : args[2] === 'unraid' ? '99' : '2345';
    if (action === 'exec' && args[3] === 'cat') return forced && args[2] === 'runtime' ? 'automatic recovery in progress' : '';
    if (action === 'exec' && args[3] === 'psql') return 'preserved';
    if (action === 'exec' && args[3] === 'node') {
      forced = args.at(-1).includes('SIGSTOP');
      exitCode = forced ? 137 : 1;
    }
    if (action === 'exec' && args[3]?.endsWith('pg_ctl')) exitCode = 1;
    return '';
  });
  return { command, report: jest.fn() };
}

test('uses actual unchanged entrypoint and ten-second host stops, with explicit forced-recovery evidence', () => {
  const f = fixture();
  checkEmbeddedSupervisor(f.command, f.report);
  const calls = f.command.mock.calls.map(([args]) => args);
  expect(calls.filter(args => args[0] === 'stop').every(args => args[2] === '10')).toBe(true);
  expect(calls.filter(args => args[0] === 'up').every(args => !args.includes('--entrypoint'))).toBe(true);
  expect(f.report.mock.calls.flat().some(text => text.includes('not a clean shutdown'))).toBe(true);
});

test.each(['status', 'clean', 'sentinel', 'identity', 'crash'])('does not hide %s evidence failure', failure => {
  const f = fixture();
  const run = args => {
    if (failure === 'status' && args[0] === 'ps') return '[]';
    if (failure === 'clean' && args[0] === 'run') return 'Database cluster state: in production\n';
    if (failure === 'sentinel' && args.at(-1) === 'SELECT value FROM supervisor_sentinel') return 'lost';
    if (failure === 'identity' && args[3] === 'stat') return '0';
    if (failure === 'crash' && args[3] === 'cat') return 'automatic recovery in progress';
    return f.command(args);
  };
  expect(() => checkEmbeddedSupervisor(run, f.report)).toThrow();
});

test('production verification failure still cleans only the generated project', () => {
  const run = jest.fn(() => ({ status: 0, stdout: '' }));
  expect(() => runEmbeddedIsolationCompose({ run, random: size => Buffer.alloc(size, 8),
    verify: () => { throw new Error('verification failed'); } })).toThrow('verification failed');
  expect(run.mock.calls.at(-1)[1][7]).toBe('down');
});

test('launcher captures bounded output and permits only expected process exit statuses', () => {
  const run = jest.fn((_cmd, args) => ({ status: args[7] === 'wait' ? 1 : 0, stdout: 'result' }));
  // Empty collision inventory, then capture an expected nonzero container exit.
  run.mockImplementation((_cmd, args) => ({ status: args[7] === 'wait' ? 1 : 0, stdout: args[0] === 'compose' ? 'result' : '' }));
  const verify = command => {
    expect(command(['wait', 'runtime'], 50, { capture: true, expectedStatus: [0, 1] })).toBe('result');
  };
  expect(runEmbeddedIsolationCompose({ run, random: size => Buffer.alloc(size, 7), verify }).status).toBe('passed');
  const captureOptions = run.mock.calls.find(([, args]) => args[7] === 'wait')[2];
  expect(captureOptions).toMatchObject({ maxBuffer: 2 * 1024 * 1024, timeout: 50, stdio: ['ignore', 'pipe', 'pipe'] });
});
