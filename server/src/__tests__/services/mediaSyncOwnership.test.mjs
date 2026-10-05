/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, expect, test } from '@jest/globals';
import { EventEmitter } from 'node:events';
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
const { createMediaSyncOwnership } = await import('../../services/mediaSyncOwnership.mjs');
const { createMediaSyncOwnershipRepository } = await import('../../services/mediaSyncOwnershipRepository.mjs');
const { MEDIA_SYNC_OWNER_LOCK, MEDIA_SYNC_SLOT_LOCK } = await import('../../services/mediaSyncLockKeys.mjs');

function ownership(acquire = () => true) {
  const client = Object.assign(new EventEmitter(), { release: jest.fn(), query: jest.fn(async (sql, params) =>
    ({ rows: [{ acquired: sql.includes('pg_try') ? acquire(...params) : true }] })) });
  const pool = { connect: jest.fn().mockResolvedValue(client) };
  return { client, pool, own: createMediaSyncOwnership({ pool }) };
}
test('nonblocking exclusion and capacity never invoke callbacks', async () => {
  const callback = jest.fn();
  for (const acquire of [() => false, ns => ns === MEDIA_SYNC_OWNER_LOCK]) {
    const { own, client } = ownership(acquire);
    expect(await own(1, callback)).toMatchObject({ deferred: true });
    expect(callback).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
  }
});
test('owner can use second slot and releases in reverse order', async () => {
  const { own, client } = ownership((ns, key) => ns !== MEDIA_SYNC_SLOT_LOCK || key === 2);
  expect(await own(3, async owner => { expect(owner.signal.aborted).toBe(false); return 'done'; })).toBe('done');
  expect(client.query.mock.calls.filter(([sql]) => sql.includes('pg_advisory_unlock')).map(([, args]) => args))
    .toEqual([[MEDIA_SYNC_SLOT_LOCK, 2], [MEDIA_SYNC_OWNER_LOCK, 3]]);
  expect(client.release).toHaveBeenCalledWith();
});
test('failed callbacks, lost connections and failed unlocks discard the connection', async () => {
  const { own, client } = ownership();
  await expect(own(1, async () => { throw new Error('failure'); })).rejects.toThrow('failure');
  expect(client.release).toHaveBeenCalledWith(true);
  const lost = ownership();
  await lost.own(1, async () => lost.client.emit('error', new Error('lost')));
  expect(lost.client.release).toHaveBeenCalledWith(true);
  expect(lost.client.query.mock.calls.some(([sql]) => sql.includes('pg_advisory_unlock'))).toBe(false);
  const unlock = ownership();
  await unlock.own(1, async () => { unlock.client.query.mockRejectedValue(new Error('unlock lost')); });
  expect(unlock.client.release).toHaveBeenCalledWith(true);
});
test.each([0, -1, 'bad', 2147483648])('invalid library %p never connects', async id => {
  const { own, pool } = ownership();
  await expect(own(id, async () => {})).rejects.toThrow('Invalid ingestion library');
  expect(pool.connect).not.toHaveBeenCalled();
});

function repository({ previous, foreign = false, cooling = false, source = true } = {}) {
  const db = { query: jest.fn(async sql => {
    if (sql.startsWith('SELECT *')) return { rows: previous ? [previous] : [] };
    if (sql.startsWith('SELECT l.id')) return { rows: source ? [{ id: 1 }] : [] };
    if (sql.includes('AS present')) return { rows: [{ present: foreign }] };
    if (sql.includes('AS cooling')) return { rows: [{ cooling }] };
    return { rows: [], rowCount: 1 };
  }), withTransaction: fn => fn(db) };
  return { db, repo: createMediaSyncOwnershipRepository(db, 1) };
}
test.each([undefined, { phase: 'complete' }, { phase: 'running', sync_status_id: 2, capture_generation: 3 }])('claims and checkpoints %p with a run token', async previous => {
  const { db, repo } = repository({ previous });
  const replay = Boolean(previous && previous.phase !== 'complete');
  expect(await repo.claim()).toEqual({ replay: !previous || replay });
  const insert = db.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO library_ingestion_state'));
  expect(insert[1]).toEqual([1, expect.stringMatching(/^[a-f0-9-]{36}$/), replay]);
  await repo.attach(4, { generation: 5 });
  await repo.checkpoint(10);
  await repo.finish(false);
  await repo.finish(true);
  for (const [, values] of db.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE library_ingestion_state'))) {
    expect(values.slice(0, 2)).toEqual(insert[1].slice(0, 2));
  }
  expect(db.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE library_ingestion_state')).at(-1)[1][2]).toBe('complete');
});
test('foreign work and cooldowns never replace an owner', async () => {
  for (const [options, reason] of [[{ foreign: true }, 'legacy_owner_unknown'], [{ previous: { phase: 'retry_wait' }, cooling: true }, 'retry_wait']]) {
    const { db, repo } = repository(options);
    expect(await repo.claim()).toEqual({ reason });
    expect(db.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql))).toBe(false);
  }
});
test('source validation is parameterized and fails closed on configuration changes', async () => {
  const source = { media_server_id: 2, external_id: 'id', media_type: 'movie', type: 'plex', url: 'http://synthetic.invalid', api_key: 'synthetic' };
  const { db, repo } = repository();
  await repo.assertSource(source);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FOR SHARE OF l,ms'), [1, 2, 'id', 'movie', 'plex', source.url, source.api_key]);
  await expect(repository({ source: false }).repo.assertSource(source)).rejects.toThrow('ingestion_source_changed');
});

test('changed run tokens cannot acknowledge progress or completion', async () => {
  const { db, repo } = repository();
  await repo.claim();
  db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  await expect(repo.checkpoint(5)).rejects.toThrow('ingestion_ownership_changed');
  await expect(repo.finish(true)).rejects.toThrow('ingestion_ownership_changed');
});
