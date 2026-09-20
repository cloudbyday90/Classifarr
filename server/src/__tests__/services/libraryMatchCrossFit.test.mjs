/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { expect, jest, test } from '@jest/globals';
import { fitLibraryMatchCrossFit } from '../../services/libraryMatchCrossFit.mjs';

const vector = angle => [Math.cos(angle), Math.sin(angle)];
const groups = (count = 24) => Array.from({ length: count }, (_, index) => ({
  hash: createHash('sha256').update(String(index)).digest('hex'), vector: vector(index * index / 300) }));
const normalized = value => { const norm = Math.sqrt(value.reduce((sum, item) => sum + item * item, 0)); return value.map(item => item / norm); };
const mean = (query, references) => references.map(ref => Math.max(-1, Math.min(1,
  query.reduce((sum, value, index) => sum + value * ref[index], 0)))).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0) / 3;

test('matches an independent leave-group-out oracle and differs from a self-contaminated baseline', async () => {
  const input = groups(), vectors = input.map(group => normalized(group.vector));
  const scores = vectors.map((query, index) => mean(query, vectors.filter((_, other) => other !== index)));
  const leaked = vectors.map(query => mean(query, vectors.slice(0, 23)));
  const model = await fitLibraryMatchCrossFit(input, 2);
  expect(model.summary).toEqual({ status: 'available', referenceDescriptions: 23, calibrationDescriptions: 24, minimumCalibrationReferences: 23 });
  let leakageChangesRank = false;
  for (const angle of [.03, .17, .41, .63, 1.1, 1.4, 1.9, 2.7, 3.1]) {
    const query = normalized(vector(angle)), value = mean(query, vectors.slice(0, 23));
    const rank = (1 + scores.filter(score => score <= value).length) / 25;
    expect(model.assess(query)).toEqual({ status: rank > .05 ? 'familiar' : 'unusual', empiricalRank: rank });
    leakageChangesRank ||= rank !== (1 + leaked.filter(score => score <= value).length) / 25;
  }
  expect(leakageChangesRank).toBe(true);
});

test.each([21, 24, 257])('%i groups retain at least 20 equal references for calibration and query scoring', async size => {
  const consumeWork = jest.fn(), model = await fitLibraryMatchCrossFit(groups(size), 2, { consumeWork });
  expect(model.summary).toMatchObject({ referenceDescriptions: size - 1, minimumCalibrationReferences: size - 1,
    calibrationDescriptions: Math.min(size, 128) });
  expect(consumeWork).toHaveBeenCalledTimes(Math.min(size, 128));
  expect(consumeWork.mock.calls.every(([value]) => value === (size - 1) * 2)).toBe(true);
  const queryWork = jest.fn(); model.assess(vector(2), { consumeWork: queryWork });
  expect(queryWork).toHaveBeenCalledWith((size - 1) * 2);
  expect(JSON.stringify(model)).not.toMatch(/hash|vector|confidence|accuracy/);
});

test('owns its vectors and does not confuse collapsed embeddings with familiarity', async () => {
  const input = groups(), model = await fitLibraryMatchCrossFit(input, 2), expected = model.assess(vector(.63));
  const scaled = await fitLibraryMatchCrossFit(input.map(group => ({ ...group, vector: group.vector.map(value => value * 2) })), 2);
  expect(scaled.assess(vector(.63))).toEqual(expected);
  input.forEach(group => { group.vector.fill(0); group.hash = 'changed'; });
  expect(model.assess(vector(.63))).toEqual(expected);
  const collapsed = await fitLibraryMatchCrossFit(groups().map(group => ({ ...group, vector: [1, 0] })), 2);
  expect(collapsed.assess([1, 0])).toEqual({ status: 'degenerate', empiricalRank: null });
});

test.each([0, 1, 20, 258, null])('rejects insufficient or oversized group counts: %s', size => {
  return expect(fitLibraryMatchCrossFit(size === null ? null : groups(size), 2)).rejects.toThrow('sample_invalid');
});

test.each([undefined, 0, -1, 1.5, 16001])('rejects dimension %s', dimensions => {
  return expect(fitLibraryMatchCrossFit(groups(), dimensions)).rejects.toThrow('sample_invalid');
});

test.each(['missing', 'duplicate', 'invalid', 'zero', 'nan', 'infinite', 'dimension'])('rejects %s group data', kind => {
  const input = groups();
  if (kind === 'missing') input[0] = null;
  if (kind === 'duplicate') input[0].hash = input[1].hash;
  if (kind === 'invalid') input[0].hash = 'private invalid identity';
  if (kind === 'zero') input[0].vector = [0, 0];
  if (kind === 'nan') input[0].vector = [NaN, 1];
  if (kind === 'infinite') input[0].vector = [Infinity, 1];
  if (kind === 'dimension') input[0].vector = [1, 0, 0];
  return expect(fitLibraryMatchCrossFit(input, 2)).rejects.toThrow();
});

test('propagates cancellation and work-budget refusal during fitting and query scoring', async () => {
  await expect(fitLibraryMatchCrossFit(groups(), 2, { signal: AbortSignal.abort() })).rejects.toThrow();
  const controller = new AbortController();
  await expect(fitLibraryMatchCrossFit(groups(), 2, { signal: controller.signal, consumeWork: () => controller.abort() })).rejects.toThrow();
  const refuse = () => { throw new Error('budget'); };
  await expect(fitLibraryMatchCrossFit(groups(), 2, { consumeWork: refuse })).rejects.toThrow('budget');
  const model = await fitLibraryMatchCrossFit(groups(), 2);
  expect(() => model.assess([0, 0])).toThrow();
  expect(() => model.assess(vector(.1), { consumeWork: refuse })).toThrow('budget');
});
