/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { runScheduledCrashRecovery } from '../../../../scripts/lib/scheduledCrashRecovery.mjs';
import { SCHEDULED_CRASH_BOUNDARY, SCHEDULED_CRASH_RECOVERY } from '../../../../scripts/lib/scheduledInstallationContract.mjs';
import { validateScheduledCrashCheckpoint } from '../../scripts/scheduledCrashCheckpoint.mjs';
import { armScheduledCrash, verifyScheduledCrashBoundary, verifyScheduledCrashRecovery } from '../../scripts/scheduledCrashRecoveryProbe.mjs';
import { assertScheduledTaskInventory } from '../../scripts/scheduledInstallationEvidence.mjs';

function checkpoint() {
  return { version: 1, ownerPid: 42,
    libraries: [1, 2].map(library_id => ({ library_id, run_id: `12345678-1234-1234-1234-${String(library_id).padStart(12, '0')}` })),
    inventory: ['movie', 'movie', 'tv', 'tv'].map((media_type, index) => ({ id: index + 1,
      library_id: index < 2 ? 1 : 2, external_id: `scheduler-${media_type}-${index % 2}`, media_type })) };
}

test('checkpoint preserves exact committed run and row identities', () => {
  const value = checkpoint();
  expect(validateScheduledCrashCheckpoint(value)).toBe(value);
});
test('completion requires one completed task for each original item and library', async () => {
  const inventory = checkpoint().inventory;
  const tasks = inventory.map(row => ({ item_id: String(row.id), library_id: String(row.library_id),
    media_type: row.media_type, task_type: 'metadata_enrichment', status: 'completed' }));
  const query = jest.fn(async () => ({ rows: tasks }));
  await expect(assertScheduledTaskInventory({ query }, [1, 2], inventory)).resolves.toBeUndefined();
  tasks[0] = { ...tasks[1] };
  await expect(assertScheduledTaskInventory({ query }, [1, 2], inventory)).rejects.toThrow();
});
test.each([
  value => { value.version = 2; }, value => { value.ownerPid = 0; },
  value => { value.libraries[1].library_id = 1; }, value => { value.libraries[0].run_id = 'unknown'; },
  value => { value.inventory.pop(); }, value => { value.inventory[0].id = 2; },
  value => { value.inventory[0].library_id = 3; }, value => { value.inventory[0].external_id = 'live-media'; },
  value => { value.inventory[0].media_type = 'music'; },
])('rejects malformed or unrelated checkpoints (%#)', mutate => {
  const value = checkpoint(); mutate(value);
  expect(() => validateScheduledCrashCheckpoint(value)).toThrow();
});

function runner({ boundary = SCHEDULED_CRASH_BOUNDARY, exit = '137 false', recovery = SCHEDULED_CRASH_RECOVERY,
  id = 'a'.repeat(64) } = {}) {
  const compose = jest.fn(args => ({ status: 0, stdout: args[0] === 'ps' ? id : '' }));
  const docker = jest.fn(args => ({ stdout: args.includes('{{.State.Status}}') ? 'exited' : exit }));
  const probe = jest.fn(phase => phase === 'scheduled-crash-ready' ? boundary : recovery);
  const poll = jest.fn(async check => { expect(await check()).toBe(true); });
  return { compose, docker, probe, poll, start: jest.fn(), setStage: jest.fn() };
}
test('checks the held lock before killing and observes normal restart on the same volume', async () => {
  const tools = runner();
  await expect(runScheduledCrashRecovery(tools)).resolves.toEqual(SCHEDULED_CRASH_RECOVERY);
  expect(tools.start).toHaveBeenCalledTimes(1);
  expect(tools.start).toHaveBeenCalledWith('normal');
  expect(tools.probe.mock.calls.flat()).toEqual(['scheduled-crash-ready', 'scheduled-crash-resume']);
  expect(tools.probe.mock.invocationCallOrder[0]).toBeLessThan(tools.compose.mock.invocationCallOrder[3]);
  expect(tools.compose.mock.calls.map(([args]) => args[0])).not.toContain('down');
  expect(tools.setStage).toHaveBeenCalledWith('fresh_backfill_crash');
});
test.each([{ boundary: {} }, { id: 'production-container' }])('never kills an unverified boundary or target: %j', options => {
  const tools = runner(options);
  return expect(runScheduledCrashRecovery(tools).finally(() => {
    expect(tools.compose.mock.calls.some(([args]) => args[0] === 'kill')).toBe(false);
    expect(tools.start).not.toHaveBeenCalled();
  })).rejects.toThrow();
});
test.each(['0 false', '137 true', '1 false'])('rejects a non-SIGKILL or OOM exit %s', async exit => {
  const tools = runner({ exit });
  await expect(runScheduledCrashRecovery(tools)).rejects.toThrow();
  expect(tools.start).not.toHaveBeenCalled();
});
test('does not accept a replaced ingestion run as recovered work', async () => {
  await expect(runScheduledCrashRecovery(runner({ recovery: { ...SCHEDULED_CRASH_RECOVERY, ingestionRuns: 'replaced' } }))).rejects.toThrow();
});
test('every crash probe refuses the normal environment before database access', async () => {
  const previous = process.env.CLASSIFARR_UPGRADE_DRILL;
  delete process.env.CLASSIFARR_UPGRADE_DRILL;
  const query = jest.fn();
  try {
    for (const probe of [armScheduledCrash, verifyScheduledCrashBoundary, verifyScheduledCrashRecovery]) {
      await expect(probe({ query })).rejects.toThrow();
    }
    expect(query).not.toHaveBeenCalled();
  } finally {
    if (previous === undefined) delete process.env.CLASSIFARR_UPGRADE_DRILL;
    else process.env.CLASSIFARR_UPGRADE_DRILL = previous;
  }
});
test('restart observer cannot reseed, repair state or start provider/worker services', () => {
  const source = readFileSync(new URL('../../scripts/scheduledCrashRecoveryProbe.mjs', import.meta.url), 'utf8')
    .split('export async function verifyScheduledCrashRecovery')[1];
  expect(source).not.toMatch(/seed|UPDATE |INSERT |DELETE |runScheduledInstallationProbe|createScheduledInstallationFixture|\.refillQueue\(|\.syncLibrary\(/);
});
