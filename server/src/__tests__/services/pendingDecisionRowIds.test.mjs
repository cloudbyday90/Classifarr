/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { ClassificationPendingDecisionLifecycleService } from '../../services/classificationPendingDecisionLifecycleService.mjs';

const identity = { key: 'tmdb:movie:884450' };
const invalid = [
  ['missing', undefined], ['null', null], ['boolean', true], ['object', {}], ['array', []], ['BigInt', 1n],
  ['empty', ''], ['leading zero', '01'], ['space', ' 1'], ['exponent', '1e3'], ['decimal', '1.0'],
  ['newline', '1\n'], ['zero', 0], ['negative', -1], ['infinite', Infinity], ['NaN', NaN],
  ['unsafe number', 9007199254740992], ['overflow', '9223372036854775808'], ['oversized', '9'.repeat(1000)],
];
function fixture(ids = [41], ...inserted) {
  const query = jest.fn(async sql => sql.trim().startsWith('SELECT id')
    ? { rows: ids.map(id => ({ id })) } : { rows: [], rowCount: ids.length });
  const client = { query }, insert = jest.fn().mockResolvedValue(inserted.length ? inserted[0] : 42);
  const service = new ClassificationPendingDecisionLifecycleService({ db: { withTransaction: fn => fn(client) } });
  const persist = () => service.persist({ status: 'pending_retry', identity, insert });
  return { query, client, insert, persist };
}

test.each([
  [41, 41], ['41', 41], [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  ['9007199254740991', Number.MAX_SAFE_INTEGER], ['9007199254740992', '9007199254740992'],
  ['9007199254740993', '9007199254740993'], ['9223372036854775807', '9223372036854775807'],
])('predecessor %s reaches every SQL binding and callback exactly', async (input, expected) => {
  const value = fixture([input], '9007199254740995');
  expect(await value.persist()).toEqual({ classificationId: '9007199254740995', supersededClassificationIds: [expected] });
  expect(value.insert).toHaveBeenCalledWith(value.client, [expected]);
  for (const call of value.query.mock.calls.slice(2)) expect(call[1][0]).toEqual([expected]);
  expect(value.query.mock.calls[4][0]).toContain("'superseded_by_classification_id', $3::jsonb");
  expect(value.query.mock.calls[4][1][2]).toBe(JSON.stringify('9007199254740995'));
});

test('mixed predecessor order and JSON scalar types remain exact', async () => {
  const value = fixture(['9007199254740993', '41', '9007199254740992', 40]);
  const expected = ['9007199254740993', 41, '9007199254740992', 40];
  expect((await value.persist()).supersededClassificationIds).toEqual(expected);
  expect(JSON.parse(JSON.stringify(expected))).toEqual(expected);
  expect(value.insert).toHaveBeenCalledWith(value.client, expected);
});

test.each(invalid)('invalid %s predecessor rejects the entire list before mutation', async (_label, id) => {
  const value = fixture([41, id]);
  await expect(value.persist()).rejects.toThrow('Invalid pending classification row identifier');
  expect(value.query).toHaveBeenCalledTimes(2); expect(value.insert).not.toHaveBeenCalled();
});

test.each(invalid)('invalid %s insertion result rejects before backlink or completion', async (_label, id) => {
  const value = fixture([41], id);
  await expect(value.persist()).rejects.toThrow('Invalid pending classification row identifier');
  expect(value.insert).toHaveBeenCalledTimes(1); expect(value.query).toHaveBeenCalledTimes(4);
});

test.each([42, '42', Number.MAX_SAFE_INTEGER, '9007199254740991', '9007199254740992',
  '9007199254740993', '9223372036854775807'])('valid insertion %s keeps its raw type and JSON value', async id => {
  const value = fixture([41], id), result = await value.persist();
  expect(result.classificationId).toBe(id);
  expect(JSON.parse(value.query.mock.calls[4][1][2])).toBe(id);
});

test('empty active cohort still validates the new result without issuing updates', async () => {
  const value = fixture([], null);
  await expect(value.persist()).rejects.toThrow('Invalid pending classification row identifier');
  expect(value.query).toHaveBeenCalledTimes(2); expect(value.insert).toHaveBeenCalledWith(value.client, []);
});

test.each(['completed', 'missing identity', 'no transaction'])('%s bypass preserves its insertion result', async kind => {
  const inserted = { intentionally: 'outside this validation boundary' }, insert = jest.fn().mockResolvedValue(inserted);
  const withTransaction = jest.fn(), service = new ClassificationPendingDecisionLifecycleService({
    db: kind === 'no transaction' ? {} : { withTransaction } });
  const result = await service.persist({ status: kind === 'completed' ? 'completed' : 'pending_retry',
    identity: kind === 'missing identity' ? null : identity, insert });
  expect(result.classificationId).toBe(inserted); expect(result.supersededClassificationIds).toEqual([]);
  expect(insert).toHaveBeenCalledWith(null, []); expect(withTransaction).not.toHaveBeenCalled();
});

test('unsupported predecessor objects cannot run coercion hooks', async () => {
  const trap = jest.fn(() => { throw new Error('must not run'); });
  const value = fixture([{ toString: trap, valueOf: trap }]);
  await expect(value.persist()).rejects.toThrow('Invalid pending classification row identifier');
  expect(trap).not.toHaveBeenCalled(); expect(value.insert).not.toHaveBeenCalled();
});
