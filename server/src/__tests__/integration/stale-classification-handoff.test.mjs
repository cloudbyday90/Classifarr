/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { createStaleClassificationHandoffRepository } from '../../services/staleClassificationHandoffRepository.mjs';

let ids;
const query = (sql, params) => getPool().query(sql, params);
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
const repository = createStaleClassificationHandoffRepository({ withTransaction });

async function seed({ count = 1, type = 'movie', tmdb = 10, title = 'Handoff fixture',
  status = 'awaiting_decision', days = 8, metadata = { retained: true } } = {}) {
  const { rows } = await query(`INSERT INTO classification_history
    (title, media_type, tmdb_id, method, status, created_at, metadata)
    SELECT $1, $2, $3, 'policy_engine', $4, NOW() - ($5::integer * INTERVAL '1 day'), $6::jsonb
    FROM generate_series(1, $7::integer) RETURNING id`,
  [title, type, tmdb, status, days, JSON.stringify(metadata), count]);
  ids.push(...rows.map(row => row.id));
  return rows[0].id;
}
const histories = () => query('SELECT * FROM classification_history WHERE id=ANY($1::bigint[]) ORDER BY id', [ids]);
const tasks = () => query(`SELECT * FROM task_queue WHERE payload->>'source_classification_id'=ANY($1::text[]) ORDER BY id`, [ids.map(String)]);

beforeEach(() => { ids = []; });
afterEach(async () => {
  await query('DROP TRIGGER IF EXISTS handoff_fixture_reject ON classification_history');
  await query('DROP TRIGGER IF EXISTS handoff_fixture_reject ON task_queue');
  await query('DROP FUNCTION IF EXISTS handoff_fixture_reject()');
  await query("DELETE FROM task_queue WHERE payload->>'source_classification_id'=ANY($1::text[])", [ids.map(String)]);
  await query('DELETE FROM classification_history WHERE id=ANY($1::bigint[])', [ids]);
});

test('fresh setup has no work', async () => {
  expect(await repository.handoff()).toEqual([]);
});

test('movie and TV handoff preserves metadata, identity, provenance and normal attempt budget', async () => {
  await seed(); await seed({ type: 'tv', tmdb: 20 });
  expect(await repository.handoff()).toHaveLength(2);
  const history = (await histories()).rows;
  const queued = (await tasks()).rows;
  for (let i = 0; i < 2; i++) {
    const task = queued.find(row => row.payload.source_classification_id === String(history[i].id));
    expect(task).toMatchObject({ status: 'pending', attempts: 0, max_attempts: 5, priority: 5,
      payload: { source: 'stale_cleanup', tmdb_id: history[i].tmdb_id, media_type: history[i].media_type } });
    expect(history[i]).toMatchObject({ status: 'pending',
      metadata: { retained: true, stale_cleanup: { queue_task_id: String(task.id), admitted_at: expect.any(String) } } });
    expect(history[i].pending_reason).toContain(String(task.id));
  }
  expect(await repository.handoff()).toEqual([]);
});

test('ineligible identity, recent history and existing receipt are untouched', async () => {
  await seed({ tmdb: null }); await seed({ tmdb: 0 }); await seed({ title: '  ' });
  await seed({ days: 1 }); await seed({ status: 'pending' });
  await seed({ metadata: [] }); await seed({ metadata: { stale_cleanup: null } });
  const before = (await histories()).rows;
  expect(await repository.handoff()).toEqual([]);
  expect((await histories()).rows).toEqual(before);
  expect((await tasks()).rowCount).toBe(0);
});

test('bounded passes carry a larger backlog without duplicates', async () => {
  await seed({ count: 105 });
  expect((await repository.handoff()).map(row => row.classification_id).sort((a, b) => a - b)).toEqual(ids.slice(0, 100));
  expect((await histories()).rows.filter(row => row.status === 'awaiting_decision')).toHaveLength(5);
  expect(await repository.handoff()).toHaveLength(5);
  expect((await tasks()).rowCount).toBe(105);
});

test('competing schedulers cannot admit the same history row', async () => {
  await seed({ count: 40 });
  const runs = await Promise.all([repository.handoff(), repository.handoff()]);
  expect(runs.flat()).toHaveLength(40);
  expect(new Set(runs.flat().map(row => row.classification_id)).size).toBe(40);
  expect((await tasks()).rowCount).toBe(40);
});

test('locked rows are skipped, then admitted after the competing transaction ends', async () => {
  const id = await seed();
  await withTransaction(async client => {
    await client.query('SELECT id FROM classification_history WHERE id=$1 FOR UPDATE', [id]);
    expect(await repository.handoff()).toEqual([]);
  });
  expect(await repository.handoff()).toHaveLength(1);
});

test.each(['task_queue', 'classification_history'])('failure at %s rolls back both writes', async table => {
  await seed();
  const before = (await histories()).rows;
  await query(`CREATE FUNCTION handoff_fixture_reject() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic write failure'; END $$`);
  // Only fixed table names from this test's literal cases; suite owns its database.
  const trigger = table === 'task_queue'
    ? 'CREATE TRIGGER handoff_fixture_reject BEFORE INSERT ON task_queue FOR EACH ROW EXECUTE FUNCTION handoff_fixture_reject()'
    : 'CREATE TRIGGER handoff_fixture_reject BEFORE UPDATE ON classification_history FOR EACH ROW EXECUTE FUNCTION handoff_fixture_reject()';
  await query(trigger);
  await expect(repository.handoff()).rejects.toThrow('synthetic write failure');
  expect((await histories()).rows).toEqual(before);
  expect((await tasks()).rowCount).toBe(0);
});

test('lost commit acknowledgement and later status reset do not reset the retry budget', async () => {
  await seed();
  const uncertain = createStaleClassificationHandoffRepository({ withTransaction: async fn => {
    await withTransaction(fn); throw new Error('synthetic lost acknowledgement');
  } });
  await expect(uncertain.handoff()).rejects.toThrow('synthetic lost acknowledgement');
  const task = (await tasks()).rows[0];
  await query("UPDATE task_queue SET status='failed',attempts=5 WHERE id=$1", [task.id]);
  await query("UPDATE classification_history SET status='awaiting_decision' WHERE id=ANY($1::bigint[])", [ids]);
  expect(await repository.handoff()).toEqual([]);
  expect((await tasks()).rows).toMatchObject([{ id: task.id, status: 'failed', attempts: 5 }]);
});

test('bigint source references survive JSON without integer overflow or rounding', async () => {
  const original = await seed();
  const id = '9007199254740993';
  await query('UPDATE classification_history SET id=$1 WHERE id=$2', [id, original]);
  ids = [id];
  expect(await repository.handoff()).toMatchObject([{ classification_id: id }]);
  expect((await tasks()).rows[0].payload.source_classification_id).toBe(id);
});

test('SQL NULL metadata is populated without fabricating source identity', async () => {
  const id = await seed();
  await query('UPDATE classification_history SET metadata=NULL WHERE id=$1', [id]);
  expect(await repository.handoff()).toHaveLength(1);
  expect((await histories()).rows[0].metadata.stale_cleanup.queue_task_id).toBe(String((await tasks()).rows[0].id));
});

test('a suppressed insert does not reset the history row', async () => {
  await seed();
  const before = (await histories()).rows;
  await query(`CREATE FUNCTION handoff_fixture_reject() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RETURN NULL; END $$`);
  await query('CREATE TRIGGER handoff_fixture_reject BEFORE INSERT ON task_queue FOR EACH ROW EXECUTE FUNCTION handoff_fixture_reject()');
  expect(await repository.handoff()).toEqual([]);
  expect((await histories()).rows).toEqual(before);
  expect((await tasks()).rowCount).toBe(0);
});

test('table-lock contention times out without a partial transition', async () => {
  await seed();
  const before = (await histories()).rows;
  await withTransaction(async client => {
    await client.query('LOCK TABLE task_queue IN ACCESS EXCLUSIVE MODE');
    await expect(repository.handoff()).rejects.toMatchObject({ code: '55P03' });
  });
  expect((await histories()).rows).toEqual(before);
  expect((await tasks()).rowCount).toBe(0);
});
