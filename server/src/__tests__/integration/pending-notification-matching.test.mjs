/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, afterEach, beforeAll, expect, test } from '@jest/globals';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { ClassificationPendingDecisionLifecycleService } from '../../services/classificationPendingDecisionLifecycleService.mjs';

let database;
const identity = { key: 'tmdb:movie:884460' }, history = new Set(), notifications = new Set();
const priorTime = new Date('2010-01-01T00:00:00Z');
beforeAll(() => { database = createReadinessDatabase(); });
afterEach(async () => {
  await database.query('DELETE FROM app_notifications WHERE id=ANY($1::integer[])', [[...notifications]]);
  await database.query('DELETE FROM classification_history WHERE id=ANY($1::bigint[])', [[...history]]);
  notifications.clear(); history.clear();
});
afterAll(async () => { await database.pool.end(); });

const payload = scalar => `{"notificationType":"awaiting_decision","classificationId":${scalar}}`;
const quoted = value => JSON.stringify(value);
async function insert(client, id, status = 'pending_retry', predecessors = []) {
  history.add(String(id));
  return (await client.query(`INSERT INTO classification_history(id,tmdb_id,media_type,title,method,status,pending_identity_key,metadata)
    VALUES($1,884460,'movie','Owned notification matching','queued_for_retry',$2,$3,$4::jsonb) RETURNING id`,
  [id, status, identity.key, JSON.stringify({ pending_decision_lifecycle: { supersedes_classification_ids: predecessors } })])).rows[0].id;
}
async function notice(data, { read = false, at = null } = {}) {
  const id = (await database.query(`INSERT INTO app_notifications(type,title,message,data,is_read,read_at)
    VALUES('warning','Owned notification','Owned notification',$1::jsonb,$2,$3) RETURNING id`, [data, read, at])).rows[0].id;
  notifications.add(id); return id;
}
const snapshot = async id => (await database.query('SELECT data,is_read,read_at FROM app_notifications WHERE id=$1', [id])).rows[0];
const replace = (status = 'pending_retry') => new ClassificationPendingDecisionLifecycleService({ db: database }).persist({ status, identity,
  insert: (client, predecessors) => insert(client, 42, status, predecessors) });

test.each(['awaiting_decision', 'pending_retry'])('%s replacement succeeds despite unrelated overflow without editing malformed records', async status => {
  await insert(database, 41, status);
  const matching = await notice(payload(quoted('00041'))), bad = await notice(payload(quoted('9223372036854775808')), { at: priorTime });
  const before = await snapshot(bad);
  expect(await replace(status)).toEqual({ classificationId: 42, supersededClassificationIds: [41] });
  expect((await snapshot(matching)).is_read).toBe(true); expect(await snapshot(bad)).toEqual(before);
  const rows = (await database.query('SELECT id,status,metadata FROM classification_history ORDER BY id')).rows;
  expect(rows.find(row => row.id === 41).status).toBe('reclassified');
  expect(rows.find(row => row.id === 41).metadata.pending_decision_lifecycle.superseded_by_classification_id).toBe(42);
  expect(rows.find(row => row.id === 42).metadata.pending_decision_lifecycle.supersedes_classification_ids).toEqual([41]);
  expect(rows.filter(row => row.status === status)).toHaveLength(1);
});

const cases = [
  ['number', payload('41'), true], ['string', payload(quoted('41')), true], ['leading zeros', payload(quoted('00041')), true],
  ['long leading zeros', payload(quoted('0'.repeat(65536) + '41')), true],
  ['neighbor', payload(quoted('40')), false], ['large exact unrelated', payload(quoted('9007199254740993')), false],
  ['maximum', payload(quoted('9223372036854775807')), false], ['overflow string', payload(quoted('9223372036854775808')), false],
  ['overflow number', payload('9223372036854775808'), false], ['huge digits', payload(quoted('9'.repeat(65536))), false],
  ['zero number', payload('0'), false], ['zero string', payload(quoted('0')), false],
  ['all zeros', payload(quoted('0'.repeat(65536))), false], ['negative number', payload('-41'), false],
  ['negative string', payload(quoted('-41')), false], ['plus', payload(quoted('+41')), false],
  ['space prefix', payload(quoted(' 41')), false], ['space suffix', payload(quoted('41 ')), false],
  ['newline suffix', payload(quoted('41\n')), false], ['tab prefix', payload(quoted('\t41')), false],
  ['decimal number', payload('41.0'), false], ['decimal string', payload(quoted('41.0')), false],
  ['exponent number', payload('4.1e1'), true], ['exponent string', payload(quoted('4.1e1')), false],
  ['scaled exponent', payload('4.100e1'), false], ['underscore', payload(quoted('4_1')), false],
  ['hexadecimal', payload(quoted('0x29')), false], ['boolean', payload('true'), false], ['array', payload('[41]'), false],
  ['object', payload('{"id":41}'), false], ['JSON null', payload('null'), false],
  ['missing key', '{"notificationType":"awaiting_decision"}', false], ['SQL null', null, false],
  ['root array', '[41]', false], ['root string', '"41"', false], ['empty', payload(quoted('')), false],
  ['non-ASCII digits', payload(quoted('４１')), false],
];
test.each(cases)('%s preserves the successful legacy match and every other record field', async (_label, data, matches) => {
  await insert(database, 41);
  const candidate = await notice(data, { at: priorTime }), before = await snapshot(candidate);
  const valid = await notice(payload('41'));
  const wrongType = await notice('{"notificationType":"other","classificationId":41}');
  const read = await notice(payload('41'), { read: true, at: priorTime }), readBefore = await snapshot(read);
  expect((await replace()).classificationId).toBe(42);
  expect(await snapshot(candidate)).toEqual({ ...before, is_read: matches });
  expect((await snapshot(valid)).is_read).toBe(true); expect((await snapshot(valid)).read_at).toBeInstanceOf(Date);
  expect((await snapshot(wrongType)).is_read).toBe(false); expect(await snapshot(read)).toEqual(readBefore);
});

test.each(['9007199254740992', '9007199254740993', '9223372036854775807'])(
  'exact predecessor %s matches numeric/string/zero-prefixed JSON without a JavaScript Number conversion', async old => {
    await insert(database, old);
    const string = await notice(payload(quoted(old))), number = await notice(payload(old));
    const zeros = await notice(payload(quoted('0'.repeat(65536) + old)));
    const neighbor = await notice(payload(quoted(String(BigInt(old) - 1n)))), before = await snapshot(neighbor);
    expect((await replace()).supersededClassificationIds).toEqual([old]);
    for (const id of [string, number, zeros]) expect((await snapshot(id)).is_read).toBe(true);
    expect(await snapshot(neighbor)).toEqual(before);
  });

test.each(['callback', 'backlink'])('%s SQL failure still rolls back with malformed notifications present', async phase => {
  await insert(database, 41);
  const matching = await notice(payload(quoted('00041'))), malformed = await notice(payload(quoted('9223372036854775808')));
  const before = await Promise.all([snapshot(matching), snapshot(malformed)]);
  const db = { withTransaction: fn => database.withTransaction(client => fn({ query: async (sql, params) => {
    if (phase === 'backlink' && sql.includes("'superseded_by_classification_id'")) return client.query('SELECT 1/0');
    return client.query(sql, params);
  } })) };
  await expect(new ClassificationPendingDecisionLifecycleService({ db }).persist({ status: 'pending_retry', identity,
    insert: async (client, predecessors) => {
      const id = await insert(client, 42, 'pending_retry', predecessors);
      if (phase === 'callback') await client.query('SELECT 1/0');
      return id;
    } })).rejects.toMatchObject({ code: '22012' });
  expect((await database.query('SELECT id,status FROM classification_history ORDER BY id')).rows).toEqual([{ id: 41, status: 'pending_retry' }]);
  expect(await Promise.all([snapshot(matching), snapshot(malformed)])).toEqual(before);
});
