/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, expect, test } from '@jest/globals';
import { validateEmbedding } from '../utils/embeddingValidation.mjs';

const issue = embeddingIssue => expect.objectContaining({ code: 'INVALID_EMBEDDING', embeddingIssue });

test('parsed, cloned and object-element histories preserve exact vectors and signed zero', () => {
  const source = [0, -0, 0.1, Math.fround(1e-45), Math.fround(3.4028234e38)];
  const boxed = new Array(source.length).fill(null);
  source.forEach((value, index) => { boxed[index] = value; });
  for (const vector of [JSON.parse(JSON.stringify(source)), structuredClone(source), boxed, Object.freeze([...source]),
    Object.setPrototypeOf([...source], null)]) {
    const before = Object.getOwnPropertyDescriptors(vector);
    expect(validateEmbedding(vector, source.length)).toBe(vector);
    expect(Object.getOwnPropertyDescriptors(vector)).toEqual(before);
  }
  expect(Object.is(source[1], -0)).toBe(true);
});

test.each(['hole', 'inherited', 'deleted-by-getter'])('requires every indexed value to remain an own property: %s', scenario => {
  const vector = [1, 2];
  if (scenario === 'deleted-by-getter') {
    Object.defineProperty(vector, '0', { configurable: true, get() { delete vector[0]; return 1; } });
  } else {
    delete vector[0];
    if (scenario === 'inherited') Object.setPrototypeOf(vector, { 0: 1 });
  }
  expect(() => validateEmbedding(vector, 2)).toThrow(issue('nonfinite'));
});

test('accepts non-enumerable own entries, ignores custom iterators and never coerces values', () => {
  const iterator = jest.fn(() => { throw new Error('must not iterate'); });
  const vector = [1, 2];
  Object.defineProperty(vector, '0', { value: 1, enumerable: false });
  vector[Symbol.iterator] = iterator;
  expect(validateEmbedding(vector, 2)).toBe(vector);
  expect(iterator).not.toHaveBeenCalled();
  const convert = jest.fn(() => 1);
  for (const value of [{ [Symbol.toPrimitive]: convert }, { valueOf: convert }, new Number(1), 1n, Symbol('private')]) {
    expect(() => validateEmbedding([1, value], 2)).toThrow(issue('nonfinite'));
  }
  expect(convert).not.toHaveBeenCalled();
});

test('preserves indexed-read, ownership-check and length-read order for proxies', () => {
  const events = [];
  const vector = new Proxy([1, 2], {
    get(target, key, receiver) { events.push(`get:${String(key)}`); return Reflect.get(target, key, receiver); },
    getOwnPropertyDescriptor(target, key) { events.push(`own:${String(key)}`); return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  expect(validateEmbedding(vector, 2)).toBe(vector);
  expect(events).toEqual(['get:length', 'get:length', 'get:length', 'get:length', 'get:0', 'own:0',
    'get:length', 'get:1', 'own:1', 'get:length']);
});

test('does not skip ownership hooks for invalid values or reorder thrown accessor failures', () => {
  const failure = new Error('sentinel');
  for (const value of [NaN, 1e39, 1e-50, 0]) {
    const events = [];
    const vector = new Proxy([value], {
      get(target, key, receiver) { if (key === '0') events.push('read'); return Reflect.get(target, key, receiver); },
      getOwnPropertyDescriptor() { events.push('own'); throw failure; },
    });
    expect(() => validateEmbedding(vector)).toThrow(failure);
    expect(events).toEqual(['read', 'own']);
  }
  const own = jest.fn();
  const vector = new Proxy([1], {
    get(target, key, receiver) { if (key === '0') throw failure; return Reflect.get(target, key, receiver); },
    getOwnPropertyDescriptor: own,
  });
  expect(() => validateEmbedding(vector)).toThrow(failure);
  expect(own).not.toHaveBeenCalled();
});

test('checks later values even after finding a nonzero entry and observes length mutations', () => {
  for (const value of [NaN, Infinity, null, '2']) {
    expect(() => validateEmbedding([1, value], 2)).toThrow(issue('nonfinite'));
  }
  for (const value of [1e39, 1e-50]) expect(() => validateEmbedding([1, value], 2)).toThrow(issue('float32'));
  const vector = [1];
  Object.defineProperty(vector, '0', { get() { vector.push(NaN); return 1; } });
  expect(() => validateEmbedding(vector, 1)).toThrow(issue('nonfinite'));
});

function adjacentPositive(value, delta) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + BigInt(delta));
  return view.getFloat64(0);
}

test('retains ties-to-even underflow and overflow behavior on both sides of exact midpoints', () => {
  const underflow = 2 ** -150, overflow = 2 ** 128 - 2 ** 103;
  for (const sign of [1, -1]) {
    for (const value of [adjacentPositive(underflow, -1), underflow, overflow, adjacentPositive(overflow, 1)]) {
      expect(() => validateEmbedding([1, sign * value], 2)).toThrow(issue('float32'));
    }
    for (const value of [adjacentPositive(underflow, 1), adjacentPositive(overflow, -1)]) {
      const vector = [1, sign * value];
      expect(validateEmbedding(vector, 2)).toBe(vector);
      expect(vector[1]).toBe(sign * value);
    }
  }
});

test('preserves dimension and first-error precedence after mixed valid and invalid histories', () => {
  for (const value of [structuredClone([1, 2]), [0, 0], [1, NaN], JSON.parse('[1.5,2.5]')]) {
    try { validateEmbedding(value, 2); } catch { /* Exercise rejection history. */ }
  }
  expect(() => validateEmbedding([1e39, NaN], 2)).toThrow(issue('float32'));
  expect(() => validateEmbedding([NaN, 1e39], 2)).toThrow(issue('nonfinite'));
  expect(() => validateEmbedding([NaN], 2)).toThrow(issue('dimensions'));
  expect(() => validateEmbedding([], 1)).toThrow(issue('shape'));
  const boundary = new Array(16000).fill(0.1);
  expect(validateEmbedding(boundary, 16000)).toBe(boundary);
  expect(() => validateEmbedding([...boundary, 1], 16001)).toThrow(issue('shape'));
});
