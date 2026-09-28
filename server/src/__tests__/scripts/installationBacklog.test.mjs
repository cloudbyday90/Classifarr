/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { assertBacklogCheckpoint, readBacklogCheckpoint, writeBacklogCheckpoint } from '../../scripts/installationBacklogCheckpoint.mjs';
import { assertBacklogCompleted, assertBacklogTaskIdentities, sawSiblingProgress, waitForBacklog } from '../../scripts/installationBacklogEvidence.mjs';
import { backlogRecoveryEvidence, BACKLOG_BOUNDARY } from '../../scripts/installationBacklogContract.mjs';
import { armBacklogCrash, verifyBacklogBoundary, verifyBacklogRecovery } from '../../scripts/installationBacklogProbe.mjs';
import { installBacklogGate } from '../../scripts/installationBacklogFixture.mjs';
import { runScheduledCrashRecovery } from '../../../../scripts/lib/scheduledCrashRecovery.mjs';
import { backlog } from '../fixtures/installationBudget.mjs';

function checkpoint() {
  const inventory = Array.from({ length: 600 }, (_, index) => ({ id: index + 1, library_id: index < 300 ? 1 : 2,
    media_type: index < 300 ? 'movie' : 'tv', external_id: `restart-${index < 300 ? 'movie' : 'tv'}-${index % 300}` }));
  return { version: 1, ownerPid: 20, databaseEpoch: 1000,
    libraries: [1, 2].map(library_id => ({ library_id, run_id: `00000000-0000-0000-0000-00000000000${library_id}` })), inventory,
    tasks: inventory.map((row, index) => ({ id: index + 10, item_id: String(row.id), library_id: String(row.library_id),
      media_type: row.media_type, task_type: 'metadata_enrichment', status: index < 5 ? 'processing' : 'pending',
      starts: index < 5 ? 1 : 0, completions: 0, attempts: 0, started_ms: index < 5 ? 2000 : null,
      visible_ms: index < 5 ? 602000 : null })) };
}
const completed = original => original.map(row => ({ ...row, status: 'completed', enriched: true,
  starts: row.status === 'processing' ? 2 : 1, completions: 1,
  last_started_ms: row.status === 'processing' ? 602000 : 10000,
  completed_ms: row.status === 'processing' ? 603000 : 11000 }));

test('checkpoint covers 600 stable identities across two pages per media type', () => {
  const value = checkpoint(); expect(assertBacklogCheckpoint(value)).toBe(value);
  const tasks = completed(value.tasks);
  expect(() => assertBacklogCompleted(tasks, value.tasks)).not.toThrow();
  expect(sawSiblingProgress(tasks, value.tasks)).toBe(true);
});

test.each([
  value => { value.version = 2; }, value => { value.ownerPid = 0; }, value => { value.databaseEpoch = null; },
  value => { value.libraries[1].library_id = 1; }, value => { value.libraries[0].run_id = 'bad'; },
  value => { value.inventory.pop(); }, value => { value.inventory[0].external_id = 'real-media'; },
  value => { value.inventory[1].id = value.inventory[0].id; }, value => { value.tasks[0].item_id = '9000'; },
  value => { value.tasks[0].visible_ms--; }, value => { value.tasks[0].starts++; },
  value => { value.tasks[0].attempts++; }, value => { value.tasks[0].completions++; },
  value => { value.tasks[0].status = 'failed'; }, value => { value.tasks[0].task_type = 'classification'; },
  value => { value.tasks[10].visible_ms = 1; }, value => { value.tasks[1].id = value.tasks[0].id; },
])('rejects an incomplete or substituted checkpoint (%#)', mutate => {
  const value = checkpoint(); mutate(value); expect(() => assertBacklogCheckpoint(value)).toThrow();
});

test.each([
  rows => { rows[0].id++; }, rows => { rows[0].status = 'failed'; }, rows => { rows[0].enriched = false; },
  rows => { rows[0].starts++; }, rows => { rows[0].completions++; }, rows => { rows[0].last_started_ms--; },
  rows => { rows[20].starts++; }, rows => { rows[0].attempts++; }, rows => { rows[0].completed_ms = null; },
  rows => { rows.pop(); },
])('rejects early reclamation, duplicate starts/completions and skipped work (%#)', mutate => {
  const value = checkpoint(); const rows = completed(value.tasks); mutate(rows);
  expect(() => assertBacklogCompleted(rows, value.tasks)).toThrow();
});

test('late sibling completion cannot be misreported as independent progress', () => {
  const value = checkpoint(), tasks = completed(value.tasks);
  tasks.forEach(row => { row.completed_ms = 603000; });
  expect(sawSiblingProgress(tasks, value.tasks)).toBe(false);
  expect(() => assertBacklogTaskIdentities(tasks, value.tasks)).not.toThrow();
});

test.each([
  value => { value.interruptedTasks = 0; }, value => { value.pendingTasks--; }, value => { value.reclaimedTasks++; },
  value => { value.totalStarts++; }, value => { value.visibilityMs = 1000; }, value => { value.completedTasks--; },
  value => { value.observationMs = 900001; }, value => { value.inventory = 'reseeded'; },
  value => { value.siblingProgress = 'after_expiry'; }, value => { value.duplicateCompletions++; },
])('rejects unsafe aggregate evidence (%#)', mutate => {
  const value = backlog(); mutate(value); expect(() => backlogRecoveryEvidence(value)).toThrow();
});

test('aggregate evidence discards raw fields', () => {
  expect(JSON.stringify(backlogRecoveryEvidence({ ...backlog(), token: 'secret' }))).not.toContain('secret');
});

test('observation is bounded with a fixed failure classification', async () => {
  let time = 0;
  await expect(waitForBacklog(async () => false, { timeout: 2000, now: () => time,
    sleep: async ms => { time += ms; } })).rejects.toThrow('unfinished_backfill_timeout');
  expect(time).toBe(2000);
  for (const timeout of [0, -1, 900001, Infinity]) await expect(waitForBacklog(jest.fn(), { timeout })).rejects.toThrow();
});

test('all fixture access fails before database or filesystem operations outside the isolated environment', async () => {
  const previous = process.env.CLASSIFARR_UPGRADE_DRILL;
  delete process.env.CLASSIFARR_UPGRADE_DRILL;
  try {
    const db = { query: jest.fn(), withTransaction: jest.fn() };
    for (const fn of [armBacklogCrash, verifyBacklogBoundary, verifyBacklogRecovery, installBacklogGate]) {
      await expect(fn(db)).rejects.toThrow();
    }
    await expect(readBacklogCheckpoint()).rejects.toThrow();
    await expect(writeBacklogCheckpoint(checkpoint())).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled(); expect(db.withTransaction).not.toHaveBeenCalled();
  } finally {
    if (previous === undefined) delete process.env.CLASSIFARR_UPGRADE_DRILL; else process.env.CLASSIFARR_UPGRADE_DRILL = previous;
  }
});

test('restart observer contains no mutating SQL or worker invocations', () => {
  const source = readFileSync(new URL('../../scripts/installationBacklogProbe.mjs', import.meta.url), 'utf8')
    .split('export async function verifyBacklogRecovery')[1];
  expect(source).not.toMatch(/\b(?:UPDATE|INSERT|DELETE|ALTER|CREATE)\b|armBacklogCrash|seedScheduled|installBacklogGate|startWorker|refillQueue/);
  const reads = readFileSync(new URL('../../scripts/installationBacklogEvidence.mjs', import.meta.url), 'utf8');
  expect(reads).not.toMatch(/\b(?:UPDATE|INSERT|DELETE|ALTER|CREATE)\b/);
});

test.each([false, true])('host kills only after a valid unfinished boundary: invalid=%s', async invalid => {
  const compose = jest.fn(args => ({ status: args.at(-1)?.endsWith('unfinished-backfill-failed') ? 1 : 0,
    stdout: args[0] === 'ps' ? 'a'.repeat(64) : '' }));
  const docker = jest.fn(args => ({ stdout: args.includes('{{.State.Status}}') ? 'exited' : '137 false' }));
  const probe = jest.fn(phase => phase === 'scheduled-backlog-ready' ? (invalid ? {} : BACKLOG_BOUNDARY) : backlog());
  const start = jest.fn();
  const result = runScheduledCrashRecovery({ compose, docker, probe, start, setStage: jest.fn(),
    poll: async check => { expect(await check()).toBe(true); }, armPhase: 'scheduled-backlog-arm' });
  if (invalid) await expect(result).rejects.toThrow(); else expect((await result).completedTasks).toBe(600);
  expect(compose.mock.calls.some(([args]) => args[0] === 'kill')).toBe(!invalid);
  expect(start).toHaveBeenCalledTimes(invalid ? 0 : 1);
});
