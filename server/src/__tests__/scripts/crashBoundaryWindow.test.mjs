/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createCrashBoundaryWindow } from '../../../../scripts/lib/crashBoundaryWindow.mjs';
import { runScheduledCrashRecovery } from '../../../../scripts/lib/scheduledCrashRecovery.mjs';
import { assertBacklogBoundary, BACKLOG_BOUNDARY } from '../../scripts/installationBacklogContract.mjs';
import { backlog } from '../fixtures/installationBudget.mjs';

function scenario({ preparation = 0, verification = 100, kill = 200, exit = 100, window = 4000,
  exitResult = '137 false', failKill = false, id = 'a'.repeat(64) } = {}) {
  let time = 0;
  const report = jest.fn();
  const compose = jest.fn(args => ({ status: args.at(-1)?.endsWith('-backfill-failed') ? 1 : 0,
    stdout: args[0] === 'ps' ? id : '' }));
  const docker = jest.fn(args => {
    if (args[0] === 'kill') {
      time += kill;
      if (failKill) throw new Error('private payload');
      return { stdout: '' };
    }
    if (args.includes('{{.State.Status}}')) { time += exit; return { stdout: 'exited' }; }
    return { stdout: exitResult };
  });
  const probe = jest.fn(phase => {
    if (phase === 'scheduled-backlog-ready') { time += verification; return { ...BACKLOG_BOUNDARY, remainingWindowMs: window }; }
    return backlog();
  });
  const tools = { compose, docker, probe, report, start: jest.fn(), setStage: jest.fn(), clock: () => time,
    beforeKill: jest.fn(async () => { time += preparation; }), armPhase: 'scheduled-backlog-arm',
    poll: jest.fn(async check => { expect(await check()).toBe(true); }) };
  return { tools, receipt: () => JSON.parse(report.mock.calls.at(-1)[0].slice('UPGRADE_CRASH_TIMELINE '.length)) };
}

test('preparation precedes proof, then direct immutable-ID kill and observed exit fit the window', async () => {
  const { tools, receipt } = scenario({ preparation: 9000 });
  expect((await runScheduledCrashRecovery(tools)).completedTasks).toBe(600);
  expect(tools.beforeKill.mock.invocationCallOrder[0]).toBeLessThan(tools.probe.mock.invocationCallOrder[0]);
  const kill = tools.docker.mock.calls.find(([args]) => args[0] === 'kill');
  expect(kill).toEqual([['kill', '--signal', 'SIGKILL', 'a'.repeat(64)], 3900]);
  expect(tools.compose.mock.calls.some(([args]) => args[0] === 'kill')).toBe(false);
  expect(receipt()).toEqual({ version: 1, scenario: 'backlog', windowMs: 4000, outcome: 'verified', events: [
    { stage: 'readyObserved', elapsedMs: 0 }, { stage: 'targetResolved', elapsedMs: 0 },
    { stage: 'preparationComplete', elapsedMs: 9000 }, { stage: 'verificationStarted', elapsedMs: 9000 },
    { stage: 'boundaryVerified', elapsedMs: 9100 }, { stage: 'killDispatched', elapsedMs: 9100 },
    { stage: 'killReturned', elapsedMs: 9300 }, { stage: 'exitObserved', elapsedMs: 9400 },
    { stage: 'exitVerified', elapsedMs: 9400 },
  ] });
});

test.each([4000, 9000])('a %i ms verification delay cannot send a stale crash', async verification => {
  const { tools, receipt } = scenario({ verification });
  await expect(runScheduledCrashRecovery(tools)).rejects.toThrow('upgrade_crash_window_expired');
  expect(tools.docker).not.toHaveBeenCalled();
  expect(tools.start).not.toHaveBeenCalled();
  expect(receipt().outcome).toBe('not_verified');
});

test.each([{ kill: 4000 }, { exit: 4000 }])('late kill/exit observation cannot start recovery %j', async options => {
  const { tools, receipt } = scenario(options);
  await expect(runScheduledCrashRecovery(tools)).rejects.toThrow('upgrade_crash_window_expired');
  expect(tools.start).not.toHaveBeenCalled();
  expect(receipt().outcome).toBe('not_verified');
});

test.each([null, 0, -1, 8001, 1.5, '4000'])('invalid window %j cannot send a crash', async window => {
  const { tools } = scenario({ window });
  await expect(runScheduledCrashRecovery(tools)).rejects.toThrow();
  expect(tools.docker).not.toHaveBeenCalled();
  expect(tools.start).not.toHaveBeenCalled();
});

test.each(['0 false', '137 true'])('wrong exit %s fails independently of timing', async exitResult => {
  const { tools, receipt } = scenario({ exitResult });
  await expect(runScheduledCrashRecovery(tools)).rejects.toThrow();
  expect(tools.start).not.toHaveBeenCalled();
  expect(receipt().events.at(-1).stage).toBe('exitObserved');
});

test('command failures retain bounded timeline without raw exceptions', async () => {
  const { tools, receipt } = scenario({ failKill: true });
  await expect(runScheduledCrashRecovery(tools)).rejects.toThrow();
  expect(tools.start).not.toHaveBeenCalled();
  expect(receipt().events.at(-1).stage).toBe('killDispatched');
  expect(JSON.stringify(tools.report.mock.calls)).not.toContain('private payload');
});

test('a short or non-container target is rejected before verification or kill', async () => {
  const { tools } = scenario({ id: 'a'.repeat(12) });
  await expect(runScheduledCrashRecovery(tools)).rejects.toThrow('invalid_drill_container');
  expect(tools.probe).not.toHaveBeenCalled();
  expect(tools.docker).not.toHaveBeenCalled();
});

test.each([NaN, Infinity, -1, 600001])('invalid/backward/overlong clock reading %s fails closed', value => {
  let time = 0;
  const timeline = createCrashBoundaryWindow({ backlog: true, now: () => time });
  timeline.mark('readyObserved');
  time = value;
  expect(() => timeline.mark('targetResolved')).toThrow('upgrade_crash_clock_invalid');
  expect(timeline.receipt().events).toEqual([{ stage: 'readyObserved', elapsedMs: 0 }]);
});

test('unknown/repeated stages and incomplete boundaries are not accepted', () => {
  const timeline = createCrashBoundaryWindow({ backlog: true, now: () => 0 });
  expect(() => timeline.mark('private')).toThrow();
  expect(() => timeline.remaining()).toThrow();
  expect(() => timeline.setWindow(4000)).toThrow();
  timeline.mark('readyObserved');
  expect(() => timeline.mark('readyObserved')).toThrow();
  expect(() => assertBacklogBoundary(BACKLOG_BOUNDARY)).toThrow();
  expect(() => assertBacklogBoundary({ ...BACKLOG_BOUNDARY, remainingWindowMs: 4000, arbitrary: 'private' })).toThrow();
});
