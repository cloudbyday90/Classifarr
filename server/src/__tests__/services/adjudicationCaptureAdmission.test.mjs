/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { captureAdmissionCase, validCaptureAdmission, planCaptureAdmission } from '../../services/adjudicationCaptureAdmission.mjs';
import { EVALUATION_GAP_REASONS } from '../../services/evaluationCoverageGaps.mjs';
import { gapDirectedCaptureFixture, syntheticCaptureResponse } from '../fixtures/gapDirectedCaptureFixture.mjs';

const request = key => ({ key: key.repeat(64), prompt: 'Synthetic prompt', count: 2 });
const pair = (item, arms, mediaType = 'movie', stratum = 'a') => ({ item: item.repeat(64), mediaType, stratum: stratum.repeat(64), arms });
const missing = key => ({ key: key.repeat(64), gap: 'cache_missing' });
const automatic = { key: null, gap: 'none' };

test('metadata contains only hashed membership and gaps, not content or labels', () => {
  const value = captureAdmissionCase('PRIVATE movie', 'movie', [2, 1, 2], [{ status: 'automatic' }, { status: 'misses' }], [null, 'a'.repeat(64)]);
  expect(value).toEqual(captureAdmissionCase('PRIVATE movie', 'movie', [1, 2], [{ status: 'automatic' }, { status: 'misses' }], [null, 'a'.repeat(64)]));
  expect(JSON.stringify(value)).not.toContain('PRIVATE');
  expect(validCaptureAdmission([value], [request('a')])).toBe(true);
});

test('one remaining response outranks two, including shared keys, without mutating checkpoint order', () => {
  const plan = ['a', 'b', 'c', 'd'].map(request), before = structuredClone(plan);
  const admission = [pair('1', [missing('a'), missing('b')]), pair('2', [automatic, missing('c')]),
    pair('3', [missing('d'), missing('d')])];
  expect(planCaptureAdmission(admission, plan)).toEqual(['c', 'd', 'a', 'b'].map(key => key.repeat(64)));
  expect(plan).toEqual(before);
});

test('ties balance media and membership strata, with completed pairs carried into service counts', () => {
  const plan = ['a', 'b', 'c', 'd'].map(request);
  const admission = [pair('1', [automatic, missing('a')]), pair('2', [automatic, missing('b')]),
    pair('3', [automatic, missing('c')], 'movie', 'b'), pair('4', [automatic, missing('d')], 'tv', 'c')];
  expect(planCaptureAdmission(admission, plan).map(key => key[0])).toEqual(['a', 'd', 'c', 'b']);
  admission.push(pair('5', [automatic, automatic]));
  expect(planCaptureAdmission(admission, plan).map(key => key[0])).toEqual(['d', 'c', 'a', 'b']);
});

test.each(EVALUATION_GAP_REASONS.filter(gap => gap !== 'cache_missing'))('known %s does not justify inference or retry of rejected output', gap => {
  const plan = ['a', 'b'].map(request);
  const admission = [pair('1', [{ key: 'a'.repeat(64), gap }, missing('b')])];
  expect(planCaptureAdmission(admission, plan)).toEqual([]);
  admission.push(pair('2', [automatic, missing('b')]));
  expect(planCaptureAdmission(admission, plan)).toEqual(['b'.repeat(64)]);
});

test('already shared requests are emitted once even when they complete several cases', () => {
  const plan = ['a', 'b'].map(request);
  expect(planCaptureAdmission([pair('1', [missing('a'), missing('a')]), pair('2', [automatic, missing('a')]),
    pair('3', [missing('a'), missing('b')])], plan)).toEqual(['a'.repeat(64), 'b'.repeat(64)]);
  expect(planCaptureAdmission([], [])).toEqual([]);
});

test.each([
  null, {}, [null], [pair('x', [automatic, missing('a')])], [pair('1', [automatic, missing('a')], 'music')],
  [pair('1', [automatic, missing('a')], 'movie', 'x')], [pair('1', [missing('b'), automatic])],
  [pair('1', [{ key: null, gap: 'cache_missing' }, automatic])], [pair('1', [{ key: null, gap: 'private' }, automatic])],
  [pair('1', [automatic])], [pair('1', [automatic, automatic])], [pair('1', [missing('a'), { ...automatic, private: true }])],
  [pair('1', [automatic, missing('a')]), pair('1', [automatic, missing('a')])],
  Array.from({ length: 26 }, (_, i) => ({ ...pair('1', [automatic, missing('a')]), item: i.toString(16).padStart(64, '0') })),
])('malformed admission %j fails closed', value => {
  expect(validCaptureAdmission(value, [request('a')])).toBe(false);
  expect(() => planCaptureAdmission(value, [request('a')])).toThrow('admission_invalid');
});

test('invalid canonical plan fails closed before choosing keys', () => {
  expect(validCaptureAdmission([], null)).toBe(false);
});

test('300-case equal-budget experiment improves pair coverage without consulting labels or names', async () => {
  const fixture = gapDirectedCaptureFixture(), totals = { sequential: 0, prioritized: 0, calls: 0 };
  for (let offset = 0; offset < 300; offset += 25) {
    fixture.source.adjudicationSelectionOffset = offset;
    const cold = await fixture.replay();
    const rejected = cold.plan.filter(row => [offset + 23, offset + 24].some(index => row.prompt === `PRIVATE request ${index} 0`))
      .map(row => ({ key: row.key, generated: syntheticCaptureResponse('invalid') }));
    const prepared = await fixture.replay(rejected), before = structuredClone(prepared.plan);
    const order = planCaptureAdmission(prepared.captureAdmission, prepared.plan);
    const labeled = await fixture.replay(rejected, new Map([[`movie:${offset}`, { libraryId: 999 }]]));
    expect(labeled.captureAdmission).toEqual(prepared.captureAdmission);
    fixture.source.libraries.forEach(library => { library.name = 'Different unrelated name'; });
    expect((await fixture.replay(rejected)).captureAdmission).toEqual(prepared.captureAdmission);
    const seed = new Set(rejected.map(row => row.key));
    const sequential = prepared.plan.filter(row => !seed.has(row.key)).slice(0, 5).map(row => row.key);
    const prioritized = order.slice(0, 5);
    for (const [strategy, keys] of Object.entries({ sequential, prioritized })) {
      const replay = await fixture.replay([...rejected, ...keys.map(key => ({ key, generated: syntheticCaptureResponse() }))]);
      totals[strategy] += replay.report.paired;
      expect(replay.report).toMatchObject({ selected: 25, eligible: 300, selectionOffset: offset });
    }
    totals.calls += prioritized.length;
    expect(prepared.plan).toEqual(before);
    // Stable-window progress cannot starve the two-request cases after cheaper cases finish.
    const records = [...rejected];
    for (let tick = 0; tick < 6; tick++) {
      const next = await fixture.replay(records);
      records.push(...planCaptureAdmission(next.captureAdmission, next.plan).slice(0, 5).map(key => ({ key, generated: syntheticCaptureResponse() })));
    }
    const complete = await fixture.replay(records);
    expect(complete.report).toMatchObject({ paired: 20, baseline: { invalid: 2 } });
    expect(planCaptureAdmission(complete.captureAdmission, complete.plan)).toEqual([]);
    expect(new Set(records.map(row => row.key)).size).toBe(records.length);
  }
  expect(totals).toEqual({ sequential: 24, prioritized: 60, calls: 60 });
});
