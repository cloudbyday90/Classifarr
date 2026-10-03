/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { checkQueueRecovery, runQueueRecoveryDrill } from '../../../../scripts/lib/embeddedQueueRecoveryChecks.mjs';

function fixture(mode, failure) {
  let phase = 'initial', stopped = 0;
  const rows = () => [1, 2].map(id => {
    const row = { id, task_type: id === 1 ? 'metadata_enrichment' : 'classification',
      status: 'processing', attempts: 0, claim_token: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      payload: { shutdownFixture: 'v1' }, live: true };
    if (phase === 'restarted' && mode === 'graceful') Object.assign(row, { status: 'pending', claim_token: null });
    if (phase === 'replay') row.claim_token = row.claim_token.replace(/.$/, '9');
    if (phase === 'completed') Object.assign(row, { status: 'completed', claim_token: null, payload: { result: { fixture: 'current' } } });
    if (failure === 'attempts') row.attempts = 1;
    if (failure === 'missing-type') row.task_type = 'embedding';
    if (failure === 'initial-expired' && phase === 'initial') row.live = false;
    if (failure === 'early-takeover' && phase === 'restarted') row.claim_token = 'replacement';
    if (failure === 'restart-expired' && phase === 'restarted') row.live = false;
    if (failure === 'same-token' && phase === 'replay') row.claim_token = `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`;
    if (failure === 'bad-result' && phase === 'completed') row.payload.result.fixture = 'stale';
    return row;
  });
  return {
    name: 'fixture', image: 'sha256:fixture',
    docker: jest.fn(async args => {
      if (args[0] === 'stop') stopped++;
      if (args[0] === 'start') phase = 'restarted';
      if (args.at(-1) === 'stale' && failure === 'stale-write') throw new Error('stale_write_accepted');
      return '';
    }),
    inspect: jest.fn(async () => ({ Status: 'exited', OOMKilled: failure === 'oom',
      ExitCode: failure === 'exit' ? 2 : stopped === 1 && mode === 'killed' ? 137 : 0 })),
    query: jest.fn(async sql => {
      if (sql.includes('json_agg')) return JSON.stringify(failure === 'missing-row' ? rows().slice(0, 1) : rows());
      if (sql.startsWith("UPDATE task_queue SET next_retry_at=NOW(),")) phase = 'replay';
      if (sql === 'UPDATE queue_drill_control SET finish=true') phase = 'completed';
      if (sql.startsWith('SELECT count(*) FROM queue_drill_claims') || sql.includes("status='completed'")) return '2';
      if (sql.startsWith('SELECT count(*) FROM queue_drill_effects')) return failure === 'duplicate-effect' ? '2' : '1';
      if (sql === 'SELECT value FROM shutdown_sentinel') return failure === 'lost-data' ? '' : 'preserved';
      return '';
    }),
    healthy: jest.fn(),
    readReceipt: jest.fn(async () => JSON.stringify(failure === 'fixture-failed' ? { phase: 'queue_task', reason: 'failed' } : {})),
    waitFor: async (check, timeout) => {
      if (failure === 'wait-timeout' && timeout === 90_000) throw new Error('shutdown_drill_wait_timeout');
      if (!await check()) throw new Error('test_missing_evidence');
    },
    offline: jest.fn(async () => `Database cluster state: ${failure === 'control-state' || mode === 'graceful' ? 'shut down' : 'in production'}\n`),
  };
}

test.each(['graceful', 'killed'])('requires real claim lifecycle evidence for %s', async mode => {
  const f = fixture(mode);
  await expect(checkQueueRecovery(f, mode)).resolves.toMatchObject({ mode, replayedTasks: 2, staleWritesRejected: true, metadataEffects: 1 });
  expect(f.docker.mock.calls.filter(([args]) => args.at(-1) === 'stale')).toHaveLength(mode === 'graceful' ? 3 : 2);
  expect(f.healthy).toHaveBeenCalledTimes(1);
  expect(f.query).toHaveBeenCalledWith('UPDATE queue_drill_control SET finish=true');
});

test.each(['attempts', 'missing-type', 'initial-expired', 'early-takeover', 'restart-expired', 'same-token',
  'bad-result', 'stale-write', 'oom', 'exit', 'missing-row', 'duplicate-effect', 'lost-data', 'fixture-failed',
  'wait-timeout', 'control-state'])('rejects incomplete or contradictory %s evidence', async failure => {
  await expect(checkQueueRecovery(fixture('killed', failure), 'killed')).rejects.toThrow();
});

test('bounds claim waiting and includes phase and safe row state on timeout', async () => {
  await expect(checkQueueRecovery(fixture('killed', 'wait-timeout'), 'killed'))
    .rejects.toThrow('queue_claim_wait_failed:killed:initial:[{"id":1,"status":"processing","live":true}');
});

test('pins one image and reports success only after cleanup', async () => {
  let index = 0;
  const report = jest.fn(), modes = ['graceful', 'killed'];
  const container = jest.fn(check => check(fixture(modes[index++])));
  expect(await runQueueRecoveryDrill({ container, report })).toHaveLength(2);
  expect(container.mock.calls.map(([, options]) => options)).toEqual([
    { fixtureMode: 'queue' }, { fixtureMode: 'queue', imageName: 'sha256:fixture' },
  ]);
  expect(report).toHaveBeenCalledTimes(2);
  await expect(runQueueRecoveryDrill({ report, container: async () => { throw new Error('cleanup_failed'); } }))
    .rejects.toThrow('cleanup_failed');
  expect(report).toHaveBeenCalledTimes(2);
});

test('rejects mixed image evidence', async () => {
  let index = 0;
  const container = async check => {
    const f = fixture(index ? 'killed' : 'graceful'); f.image = `image-${index++}`;
    return check(f);
  };
  await expect(runQueueRecoveryDrill({ container, report: jest.fn() })).rejects.toThrow('queue_drill_image_changed');
});

test('rejects unsupported scenarios before querying', async () => {
  const f = fixture('graceful');
  await expect(checkQueueRecovery(f, 'unknown')).rejects.toThrow();
  expect(f.query).not.toHaveBeenCalled();
});
