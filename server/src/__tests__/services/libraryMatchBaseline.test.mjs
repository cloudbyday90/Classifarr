/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { fitLibraryMatchBaseline } from '../../services/libraryMatchBaseline.mjs';

const vector = angle => [Math.cos(angle), Math.sin(angle)];
const reference = () => Array.from({ length: 24 }, (_, index) => vector(index / 100));
const calibration = () => Array.from({ length: 20 }, (_, index) => vector(index / 80));

test('learns an empirical match range, not an accuracy probability', async () => {
  const consumeWork = jest.fn();
  const model = await fitLibraryMatchBaseline(reference(), calibration(), 2, { consumeWork });
  expect(model.summary).toEqual({ status: 'available', referenceDescriptions: 24, calibrationDescriptions: 20 });
  expect(model.assess(vector(.1))).toMatchObject({ status: 'familiar' });
  expect(model.assess(vector(Math.PI))).toEqual({ status: 'unusual', empiricalRank: 1 / 21 });
  expect(consumeWork).toHaveBeenCalledTimes(22);
  expect(consumeWork.mock.calls.every(([value]) => value === 48)).toBe(true);
  expect(JSON.stringify(model)).not.toMatch(/vector|score|confidence|referenceVectors/);
});

test('the same query can be ordinary for a broad library and unusual for a narrow one', async () => {
  const narrow = await fitLibraryMatchBaseline(reference(), calibration(), 2);
  const broad = await fitLibraryMatchBaseline(reference().map((_, i) => vector(i / 6)), calibration().map((_, i) => vector(i / 5)), 2);
  expect(narrow.assess(vector(2))).toMatchObject({ status: 'unusual' });
  expect(broad.assess(vector(2))).toMatchObject({ status: 'familiar' });
});

test('reused live assessments charge their own work budget without retaining a previous request budget', async () => {
  const fitWork = jest.fn(), queryWork = jest.fn();
  const model = await fitLibraryMatchBaseline(reference(), calibration(), 2, { consumeWork: fitWork });
  expect(fitWork).toHaveBeenCalledTimes(20);
  model.assess(vector(.1), { consumeWork: queryWork });
  expect(fitWork).toHaveBeenCalledTimes(20);
  expect(queryWork).toHaveBeenCalledWith(48);
  expect(() => model.assess(vector(.1), { consumeWork: () => { throw new Error('budget'); } })).toThrow('budget');
});

test('normalization, ordering, and post-fit input mutation do not change the model', async () => {
  const refs = reference(), cal = calibration();
  const original = await fitLibraryMatchBaseline(refs, cal, 2);
  const reordered = await fitLibraryMatchBaseline([...refs].reverse().map(v => v.map(x => x * 7)), [...cal].reverse(), 2);
  const expected = original.assess(vector(.1));
  expect(reordered.assess(vector(.1))).toEqual(expected);
  refs.forEach(v => v.fill(0)); cal.forEach(v => v.fill(0));
  expect(original.assess(vector(.1))).toEqual(expected);
});

test('collapsed embeddings do not create perfect confidence', async () => {
  const model = await fitLibraryMatchBaseline(Array(20).fill([1, 0]), Array(20).fill([1, 0]), 2);
  expect(model.summary.status).toBe('degenerate');
  expect(model.assess([1, 0])).toEqual({ status: 'degenerate', empiricalRank: null });
});

test('the tail boundary is strict and ties count conservatively as at least as typical', async () => {
  const cal = Array.from({ length: 39 }, (_, i) => vector((i + 1) / 100));
  const model = await fitLibraryMatchBaseline(Array(20).fill([1, 0]), cal, 2);
  expect(model.assess(cal[38])).toEqual({ status: 'unusual', empiricalRank: .05 });
  expect(model.assess(cal[37])).toEqual({ status: 'familiar', empiricalRank: .075 });
});

test.each([[null, 20], [19, 20], [257, 20], [20, null], [20, 19], [20, 129]])('rejects invalid sample sizes %s/%s', async (r, c) => {
  await expect(fitLibraryMatchBaseline(r === null ? null : Array(r).fill([1, 0]),
    c === null ? null : Array(c).fill([1, 0]), 2)).rejects.toThrow('sample_invalid');
});

test.each([[0, 0], [NaN, 1], [Infinity, 1], ['1', 0], [1], [1, 0, 0]])('rejects malformed vectors %j', async invalid => {
  const refs = reference(); refs[0] = invalid;
  await expect(fitLibraryMatchBaseline(refs, calibration(), 2)).rejects.toThrow();
  const model = await fitLibraryMatchBaseline(reference(), calibration(), 2);
  expect(() => model.assess(invalid)).toThrow();
});

test.each([undefined, 0, -1, 1.5, 16001])('requires bounded explicit dimensions: %s', async dimensions => {
  await expect(fitLibraryMatchBaseline(reference(), calibration(), dimensions)).rejects.toThrow('sample_invalid');
});

test('cancels before and during fitting and propagates bounded-work refusal', async () => {
  const early = new AbortController(); early.abort();
  await expect(fitLibraryMatchBaseline(reference(), calibration(), 2, { signal: early.signal })).rejects.toThrow();
  const late = new AbortController();
  await expect(fitLibraryMatchBaseline(reference(), calibration(), 2,
    { signal: late.signal, consumeWork: () => late.abort() })).rejects.toThrow();
  await expect(fitLibraryMatchBaseline(reference(), calibration(), 2,
    { consumeWork: () => { throw new Error('budget'); } })).rejects.toThrow('budget');
});
