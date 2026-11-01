/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { projectLogData } from '../../utils/logging/logDataProjection.mjs';
import { SENSITIVE_FIELD_PATHS } from '../../utils/logging/logConfig.mjs';

function json(value) { return JSON.parse(JSON.stringify(value)); }

test('small ordinary JSON shapes survive as independent inert values', () => {
  const input = Object.freeze({ id: 17, flag: true, no: null, nested: Object.freeze({ list: Object.freeze([1, 'two', null]) }) });
  const result = projectLogData(input);
  expect(json(result)).toEqual(input);
  expect(result).not.toBe(input);
  expect(Object.getPrototypeOf(result)).toBeNull();
  expect(Object.getPrototypeOf(result.nested)).toBeNull();
  expect(Object.getPrototypeOf(result.nested.list)).toBeNull();
  expect(projectLogData(Object.assign(Object.create(null), { safe: 1 }))).toEqual({ safe: 1 });
  expect(projectLogData(null)).toBeNull();
  expect(projectLogData(undefined)).toBeUndefined();
});

test('redacts every existing sensitive substring without reading the value', () => {
  const input = { nested: [{ safe: 'retained' }] }, getter = jest.fn(() => { throw Error('PRIVATE'); });
  for (const field of SENSITIVE_FIELD_PATHS) Object.defineProperty(input, `UP_${field.toUpperCase()}`, { enumerable: true, get: getter });
  input.nested[0].UserToken = 'PRIVATE nested';
  const result = projectLogData(input);
  expect(getter).not.toHaveBeenCalled();
  for (const field of SENSITIVE_FIELD_PATHS) expect(result[`UP_${field.toUpperCase()}`]).toBe('[REDACTED]');
  expect(result.nested[0]).toEqual({ safe: 'retained', UserToken: '[REDACTED]' });
  expect(JSON.stringify(result)).not.toContain('PRIVATE nested');
});

test('skips accessors, serialization/coercion hooks, symbols and inherited properties', () => {
  const hook = jest.fn(() => { throw Error('must not run'); });
  const input = { safe: 1, toJSON: hook, toString: hook, valueOf: hook, [Symbol.toPrimitive]: hook };
  Object.defineProperty(input, 'getter', { enumerable: true, get: hook });
  Object.defineProperty(input, 'hidden', { value: 'PRIVATE', enumerable: false });
  Object.defineProperty(Object.prototype, 'syntheticLogInherited', { configurable: true, enumerable: true, get: hook });
  try {
    const result = projectLogData(input);
    expect(JSON.stringify(result)).toBe('{"safe":1,"toJSON":"[LogData:unsupported]","toString":"[LogData:unsupported]","valueOf":"[LogData:unsupported]","getter":"[LogData:accessor]"}');
    expect(hook).not.toHaveBeenCalled();
  } finally { delete Object.prototype.syntheticLogInherited; }
});

test('rejects live/revoked and function proxies before reflection or coercion', () => {
  const trap = jest.fn(() => { throw Error('PRIVATE trap'); });
  const handlers = { get: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap, apply: trap };
  const proxy = new Proxy({}, handlers), fn = new Proxy(() => {}, handlers);
  const revoked = Proxy.revocable([], handlers); revoked.revoke();
  expect(projectLogData({ proxy, fn, revoked: revoked.proxy, safe: 1 })).toEqual({
    proxy: '[LogData:proxy]', fn: '[LogData:proxy]', revoked: '[LogData:proxy]', safe: 1,
  });
  expect(projectLogData(revoked.proxy)).toEqual({ logData: '[LogData:proxy]', logDataStatus: 'root_value' });
  expect(trap).not.toHaveBeenCalled();
});

test.each([new Date(), new Map(), new Set(), Buffer.from('private'), /x/, new Number(7), new Error('private'), 1n, Symbol('private'), () => {}])(
  'unsupported value %p is replaced without coercion', value => {
    expect(projectLogData({ value, safe: 1 })).toEqual({ value: '[LogData:unsupported]', safe: 1 });
  },
);

test('handles ancestor cycles while retaining repeated acyclic aliases', () => {
  const shared = { safe: 1 }, root = { first: shared, second: shared, list: [] };
  root.list.push(root.list, root);
  const result = projectLogData(root);
  expect(json(result)).toEqual({ first: { safe: 1 }, second: { safe: 1 }, list: ['[LogData:cycle]', '[LogData:cycle]'] });
  expect(result.first).not.toBe(result.second);
});

test('exactly eight containers survive, with the ninth replaced', () => {
  let allowed = { safe: 1 };
  for (let depth = 1; depth < 8; depth++) allowed = { child: allowed };
  expect(json(projectLogData(allowed))).toEqual(allowed);
  let cursor = projectLogData({ child: allowed });
  for (let depth = 0; depth < 8; depth++) cursor = cursor.child;
  expect(cursor).toBe('[LogData:depth]');
});

test('the 64-member bound preserves the prefix and cannot overwrite input envelope keys', () => {
  const input = { logData: 'original', logDataStatus: 'original' };
  for (let index = 0; index < 62; index++) input[`k${index}`] = index;
  expect(json(projectLogData(input))).toEqual(input);
  input.omitted = 'PRIVATE';
  const result = projectLogData(input);
  expect(result.logDataStatus).toBe('members');
  expect(result.logData.logData).toBe('original');
  expect(result.logData.logDataStatus).toBe('original');
  expect(Object.keys(result.logData)).toHaveLength(64);
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
  expect(projectLogData(Array.from({ length: 65 }, (_, index) => index))).toEqual({
    logData: Array.from({ length: 64 }, (_, index) => index), logDataStatus: 'members',
  });
});

test('the global 1,024-value budget counts aliases and stops further expansion', () => {
  const full = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`k${index}`, index]));
  const last = Object.fromEntries(Array.from({ length: 47 }, (_, index) => [`k${index}`, index]));
  const exact = [...Array(15).fill(full), last]; // root + 15 * 65 + 48 = 1,024
  expect(json(projectLogData(exact)).logData).toEqual(exact);
  last.extra = 1;
  const limited = projectLogData([...exact, full]);
  expect(limited.logDataStatus).toBe('values');
  expect(limited.logData).toHaveLength(16);
  expect(limited.logData[15].logDataStatus).toBe('values');
  expect(Object.keys(limited.logData[15].logData)).toHaveLength(47);
});

test('key and string boundaries use UTF-16 units without key truncation collisions', () => {
  const exactKey = 'k'.repeat(128), tooLong = exactKey + 'x', getter = jest.fn(() => { throw Error('PRIVATE'); });
  const input = { [exactKey]: 1, safe: 2 };
  Object.defineProperty(input, tooLong, { enumerable: true, get: getter });
  const result = projectLogData(input);
  expect(result.logDataStatus).toBe('key');
  expect(result.logData).toEqual({ [exactKey]: 1, safe: 2 });
  expect(getter).not.toHaveBeenCalled();
  expect(projectLogData({ text: 's'.repeat(2048) }).text).toBe('s'.repeat(2048));
  expect(projectLogData({ text: 's'.repeat(2049) }).text).toBe('s'.repeat(2048) + '[LogData:string]');
  expect(projectLogData({ text: '😀'.repeat(1025) }).text).toBe('😀'.repeat(1024) + '[LogData:string]');
  expect(projectLogData({ text: 'x'.repeat(2047) + '😀' }).text).toBe('x'.repeat(2047) + '[LogData:string]');
});

test('array indices never invoke getters, species, iterators or inherited holes', () => {
  const hook = jest.fn(() => { throw Error('PRIVATE'); });
  const input = [1, , 3];
  Object.defineProperty(input, '2', { get: hook });
  Object.defineProperty(input, 'toJSON', { get: hook });
  Object.defineProperty(input, 'constructor', { get: hook });
  Object.defineProperty(input, Symbol.iterator, { get: hook });
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, '1', { get: hook });
  Object.setPrototypeOf(input, prototype);
  expect(json(projectLogData({ input }))).toEqual({ input: [1, null, '[LogData:accessor]'] });
  expect(hook).not.toHaveBeenCalled();
});

test.each(['level', 'time', 'msg', 'pid', 'hostname', 'module'])('root %s cannot override log identity', key => {
  expect(projectLogData({ [key]: 'untrusted', safe: 1 })).toEqual({
    logData: { [key]: 'untrusted', safe: 1 }, logDataStatus: 'root_fields',
  });
  expect(projectLogData({ nested: { [key]: 'ordinary' } })).toEqual({ nested: { [key]: 'ordinary' } });
});

test.each([false, 0, 12, 'data'])('root primitive %p has an inert merging envelope', value => {
  expect(projectLogData(value)).toEqual({ logData: value, logDataStatus: 'root_value' });
});

test('own prototype-like keys are safe JSON data and do not change prototypes', () => {
  const input = JSON.parse('{"__proto__":{"safe":1},"constructor":{"prototype":{"safe":2}},"hasOwnProperty":3}');
  const result = projectLogData(input);
  expect(json(result)).toEqual(input);
  expect(Object.getPrototypeOf(result)).toBeNull();
  expect(Object.getPrototypeOf(result.__proto__)).toBeNull();
});

test('encoded budgets include escaping, multibyte strings, markers and root wrapping', () => {
  for (const unit of ['x', '\u0000', '"\\\n', '😀', '\ud800']) {
    const input = { safe: 'retained', level: 'untrusted', large: Array.from({ length: 64 }, () => unit.repeat(2048)) };
    const encoded = JSON.stringify(projectLogData(input));
    expect(Buffer.byteLength(encoded)).toBeLessThanOrEqual(65536);
    expect(JSON.parse(encoded).logData.safe).toBe('retained');
    expect(encoded).toContain('[LogData:');
  }
  expect(projectLogData({ numbers: [NaN, Infinity, -Infinity, -0] })).toEqual({ numbers: [null, null, null, 0] });
});
