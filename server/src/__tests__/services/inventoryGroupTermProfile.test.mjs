/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { descriptionTerms, fitGroupTermProfile } from '../../services/inventoryGroupTermProfile.mjs';

function fixture() {
  const items = [], texts = new Map([['held', 'leakedword leakedword']]);
  for (const type of ['movie', 'tv']) for (const id of [1, 2]) for (let n = 0; n < 4; n++) {
    const hash = `${type}-${id}-${n}`;
    items.push({ hash, type, id, group: 0 });
    texts.set(hash, `common ${id === 1 ? 'ocean voyage' : 'forest wildlife'} ${n === 0 ? 'singleton' : ''}`);
  }
  return { index: { items, held: new Set(['held']) }, texts };
}

test('learns bounded binary contrast from training only, without cross-media or name features', async () => {
  const { index, texts } = fixture(), before = structuredClone(index);
  const result = await fitGroupTermProfile(index, texts);
  expect(result).toHaveLength(4);
  expect([...result[0].weights.keys()]).toEqual(['ocean', 'voyage']);
  for (const weight of result[0].weights.values()) expect(weight).toBeCloseTo(1 / Math.sqrt(2), 12);
  expect(result.every(row => !row.weights.has('leakedword') && !row.weights.has('common') && !row.weights.has('singleton'))).toBe(true);
  texts.set('held', 'ocean voyage');
  index.items.forEach(item => { item.name = 'ignored'; texts.set(item.hash, `${texts.get(item.hash)} common common`); });
  expect(await fitGroupTermProfile(index, texts)).toEqual(result);
  index.items.reverse();
  expect((await fitGroupTermProfile(index, texts)).sort((a, b) => a.id - b.id || a.type.localeCompare(b.type)))
    .toEqual([...result].sort((a, b) => a.id - b.id || a.type.localeCompare(b.type)));
  expect(before.items).toHaveLength(index.items.length);
});

test('shared and unassigned descriptions affect background frequency but cannot learn a voting group', async () => {
  const { index, texts } = fixture();
  index.items.push({ hash: 'shared', type: 'movie', id: null, group: null }, { hash: 'outlier', type: 'movie', id: 1, group: null });
  texts.set('shared', 'ocean voyage'); texts.set('outlier', 'ocean voyage');
  const result = await fitGroupTermProfile(index, texts);
  expect(result).toHaveLength(4);
  expect(result.find(row => row.type === 'movie' && row.id === 1).weights.size).toBe(0);
  expect(result.find(row => row.type === 'tv' && row.id === 1).weights.size).toBe(2);
});

test('Unicode normalization does not add repetition votes or English category assumptions', () => {
  expect([...descriptionTerms('ＯＣＥＡＮ ocean 123 à bientôt 日本語 __proto__')]).toEqual(['ocean', 'bientôt', '日本語', 'proto']);
  expect(descriptionTerms('a an 42').size).toBe(0);
  expect(descriptionTerms('x'.repeat(65)).size).toBe(0);
  for (const value of [null, '', ' ', 'a'.repeat(2001)]) expect(() => descriptionTerms(value)).toThrow('invalid_description');
  const unique = Array.from({ length: 257 }, (_, n) => `a${String.fromCharCode(97 + Math.floor(n / 26))}${String.fromCharCode(97 + n % 26)}`).join(' ');
  expect(() => descriptionTerms(unique)).toThrow('description_budget');
});

test('rejects held-out leaks, missing descriptions, oversized input and cancellation', async () => {
  const { index, texts } = fixture();
  const controller = new AbortController(); controller.abort();
  await expect(fitGroupTermProfile(index, texts, controller.signal)).rejects.toThrow();
  await expect(fitGroupTermProfile({ ...index, items: Array(20001) }, texts)).rejects.toThrow('input_budget');
  await expect(fitGroupTermProfile(index, new Map(Array.from({ length: 10001 }, (_, n) => [n, 'text'])))).rejects.toThrow('input_budget');
  index.items[0].hash = 'held';
  await expect(fitGroupTermProfile(index, texts)).rejects.toThrow('holdout_leak');
  index.items[0].hash = 'missing';
  await expect(fitGroupTermProfile(index, texts)).rejects.toThrow('invalid_description');
});

test('no other-library groups means no discrimination, even with recurring terms', async () => {
  const { index, texts } = fixture(); index.items = index.items.filter(item => item.id === 1);
  expect((await fitGroupTermProfile(index, texts)).every(row => row.weights.size === 0)).toBe(true);
});

test('resource guards stop unique-vocabulary and cross-group work explosions', async () => {
  const words = n => `a${[0, 1, 2, 3].map(power => String.fromCharCode(97 + Math.floor(n / 26 ** power) % 26)).join('')}`;
  const items = Array.from({ length: 501 }, (_, n) => ({ hash: String(n), id: n + 1, type: 'movie', group: 0 }));
  const texts = new Map(items.map((item, n) => [item.hash, Array.from({ length: 200 }, (_, i) => words(n * 200 + i)).join(' ')]));
  await expect(fitGroupTermProfile({ items, held: new Set(['held']) }, texts)).rejects.toThrow('vocabulary_budget');
  await expect(fitGroupTermProfile({ items: items.slice(0, 500), held: new Set(['held']) }, texts)).rejects.toThrow('work_budget');
});

test('equal rival prevalence is not contrast and cancellation is observed between batches', async () => {
  const { index, texts } = fixture();
  index.items.filter(item => item.type === 'movie').forEach(item => texts.set(item.hash, 'ocean voyage'));
  for (let n = 0; n < 10; n++) {
    index.items.push({ hash: `background-${n}`, type: 'movie', id: null, group: null });
    texts.set(`background-${n}`, 'different background');
  }
  expect((await fitGroupTermProfile(index, texts)).filter(row => row.type === 'movie').every(row => row.weights.size === 0)).toBe(true);
  const controller = new AbortController();
  const pending = fitGroupTermProfile(index, texts, controller.signal); controller.abort();
  await expect(pending).rejects.toThrow();
});
