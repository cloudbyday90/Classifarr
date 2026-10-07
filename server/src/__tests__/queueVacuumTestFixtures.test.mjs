/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { withQueueVacuumPressure } from './helpers/queueVacuumPressureFixture.mjs';
import { observeQueueVacuumAttempt } from './helpers/queueVacuumAttemptEvidence.mjs';
import { queueVacuumRow, queueVacuumState } from './helpers/queueVacuumFixture.mjs';

test.each(['success', 'callback', 'insert'])('pressure fixture restores exact edited settings after %s', async scenario => {
  const client = { release: jest.fn(), query: jest.fn(async sql => {
    if (sql.startsWith('SELECT reloptions')) return { rows: [{ reloptions: [
      'autovacuum_enabled=false', 'autovacuum_vacuum_threshold=50',
      'autovacuum_vacuum_insert_threshold=-1', 'autovacuum_vacuum_scale_factor=0.01',
    ] }] };
    if (sql.startsWith('INSERT INTO libraries')) return { rows: [{ id: 7 }] };
    if (sql.startsWith('INSERT INTO task_queue') && scenario === 'insert') throw new Error('synthetic insert failure');
    if (sql.includes('FROM pg_catalog.pg_class c')) return { rows: [queueVacuumRow()] };
    return { rows: [] };
  }) };
  const run = () => withQueueVacuumPressure({ connect: async () => client }, async () => {
    if (scenario === 'callback') throw new Error('synthetic callback failure');
    return 'done';
  });
  if (scenario === 'success') await expect(run()).resolves.toBe('done');
  else await expect(run()).rejects.toThrow(`synthetic ${scenario} failure`);
  const sql = client.query.mock.calls.map(([statement]) => statement);
  expect(sql.slice(-4)).toEqual([
    'ALTER TABLE public.task_queue SET (autovacuum_enabled = false)',
    'ALTER TABLE public.task_queue SET (autovacuum_vacuum_threshold = 50)',
    'ALTER TABLE public.task_queue SET (autovacuum_vacuum_insert_threshold = -1)',
    'ALTER TABLE public.task_queue RESET (autovacuum_analyze_threshold)',
  ]);
  expect(sql.some(statement => statement.startsWith('ALTER') && statement.includes('autovacuum_vacuum_scale_factor'))).toBe(false);
  expect(client.query).toHaveBeenCalledWith('DELETE FROM libraries WHERE id = $1', [7]);
  expect(client.release.mock.calls).toEqual([[true]]);
});

test('unexpected storage parameter values fail before fixture creation and release the client', async () => {
  const client = { release: jest.fn(), query: jest.fn(async () => ({
    rows: [{ reloptions: ['autovacuum_vacuum_threshold=1); DROP TABLE task_queue;--'] }],
  })) };
  await expect(withQueueVacuumPressure({ connect: async () => client }, jest.fn()))
    .rejects.toThrow('Unexpected queue fixture storage parameter');
  expect(client.query.mock.calls.some(([sql]) => sql.startsWith('ALTER') || sql.startsWith('INSERT'))).toBe(false);
  expect(client.release.mock.calls).toEqual([[true]]);
});

test('attempt evidence is bounded and omits raw notices, errors and connection details', async () => {
  const client = Object.assign(new EventEmitter(), { release: jest.fn() });
  client.query = jest.fn(async sql => {
    if (sql.includes('pg_try_advisory')) return { rows: [{ acquired: true }] };
    if (sql.startsWith('SELECT gate_state')) return { rows: [{ gate_state: 'ready' }] };
    if (sql.includes('FROM pg_catalog.pg_class c')) return { rows: [queueVacuumRow()] };
    if (sql.startsWith('SELECT * FROM public.queue_vacuum_recovery_state')) return { rows: [queueVacuumState()] };
    if (sql.startsWith('WITH active_libraries')) return { rows: [{ readiness: 'ready' }] };
    if (sql.includes('RETURNING attempts')) return { rows: [{ attempts: 1 }] };
    if (sql.startsWith('VACUUM')) {
      for (let index = 0; index < 20; index += 1) client.emit('notice', {
        severity: 'WARNING', code: index === 0 ? 'private' : '55P03',
        message: 'secret query', detail: 'postgres://private-connection',
      });
      throw new Error('private raw failure');
    }
    return { rows: [], rowCount: 1 };
  });
  const outcome = await observeQueueVacuumAttempt({ connect: async () => client });
  expect(outcome.error.category).toBe('execution_failed');
  expect(outcome.evidence).toMatchObject({ commands: 1, observations: [{
    vacuum: '1', analyze: '1', automatic: '1', running: false,
  }] });
  expect(outcome.evidence.notices).toHaveLength(8);
  expect(outcome.evidence.notices[0]).toEqual({ warning: true, code: null });
  expect(JSON.stringify(outcome)).not.toMatch(/private|secret|postgres:\/\//);
  expect(client.release.mock.calls).toEqual([[true]]);
});
