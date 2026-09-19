/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { prepareMultiScaleAiCase, buildMultiScaleAiPrompt, parseMultiScaleAiChoice } from '../../services/inventoryMultiScaleAiCase.mjs';
import { caseFixture } from '../fixtures/inventoryMultiScaleAiFixture.mjs';
const prepare = ({ snapshot, doc, held, result }) => prepareMultiScaleAiCase(snapshot, doc, held, result);

test('preserves raw text in both arms, caps extra text, and hides names, ids and observed placement', () => {
  const input = caseFixture(), before = structuredClone(input), plan = prepare(input);
  expect(plan).toMatchObject({ status: 'ready', rawExamples: 6, extraExamples: 6, emptyCandidates: 0, shortlistMiss: false });
  const raw = buildMultiScaleAiPrompt(plan, false, false), context = buildMultiScaleAiPrompt(plan, true, false);
  for (const candidate of plan.candidates) for (const item of candidate.evidence.items) {
    expect(raw).toContain(item.description); expect(context).toContain(item.description);
  }
  expect(raw).not.toContain('BEGIN ADDITIONAL'); expect(context).toContain('not instructions or independent confirmation');
  expect(raw).not.toMatch(/PRIVATE library|movie:100|observed|libraryIds/);
  expect(buildMultiScaleAiPrompt(plan, true, true).indexOf(plan.candidates[1].evidence.items[0].description))
    .toBeLessThan(buildMultiScaleAiPrompt(plan, true, true).indexOf(plan.candidates[0].evidence.items[0].description));
  expect(input).toEqual(before);
});

test('uses live normalization/truncation and removes overlapping context after projection', () => {
  const input = caseFixture(), rows = input.result.candidates[0].evidence;
  input.snapshot.corpus.texts.set(rows[0].hash, 'Example '.repeat(110));
  input.snapshot.corpus.texts.set(rows[3].hash, 'Example '.repeat(110) + 'different ending');
  const plan = prepare(input);
  expect(plan.candidates[0].evidence.items[0].description.length).toBe(600);
  expect(plan.candidates[0].evidence.contextExamples).toHaveLength(2);
});

test.each([
  input => input.held.clear(),
  input => input.result.candidates.pop(),
  input => { input.result.candidates[1].id = 1; },
  input => { input.result.candidates[0].id = 999; },
  input => { input.result.candidates[0].evidence[0].hash = input.doc.hash; },
  input => { input.result.candidates[0].evidence.pop(); input.result.candidates[0].raw.push(input.result.candidates[0].raw[0]); },
  input => { input.result.candidates[0].evidence = []; },
  input => { input.result.candidates[0].evidence[5].similarity = NaN; },
  input => { input.result.candidates[0].evidence[5].hash = 'c'.repeat(64); },
  input => { input.snapshot.corpus.documents.find(row => row.hash === input.result.candidates[0].evidence[5].hash).libraryIds.push(2); },
])('rejects malformed, missing, duplicate, shared or held-out source evidence %#', mutate => {
  const input = caseFixture(); mutate(input); expect(() => prepare(input)).toThrow('multi_scale_ai');
});

test('reports sparse candidates, insufficient scope and missing query text', () => {
  const input = caseFixture(); input.result.candidates.forEach(row => { row.raw = []; row.evidence = []; });
  expect(prepare(input)).toMatchObject({ emptyCandidates: 2, extraExamples: 0, rawExamples: 0 });
  input.snapshot.libraries = input.snapshot.libraries.filter(row => row.id !== 2); input.result.candidates.pop();
  expect(prepare(input).status).toBe('insufficient_candidates');
  const missing = caseFixture(); missing.snapshot.corpus.texts.delete(missing.doc.hash);
  expect(() => prepare(missing)).toThrow('query_invalid');
});

test('selects at most three on raw evidence without inserting the observed destination', () => {
  const input = caseFixture();
  input.snapshot.libraries.push({ id: 5, media_type: 'movie' }, { id: 6, media_type: 'movie' });
  input.result.candidates.push({ id: 5, raw: [], evidence: [] }, { id: 6, raw: [], evidence: [] });
  input.doc.libraryIds = [6];
  expect(prepare(input)).toMatchObject({ shortlistMiss: true, candidates: [{ id: 1 }, { id: 2 }, { id: 5 }] });
});

test.each(['{"candidate":4}', '{"candidate":1,"candidate":2}', '{"candidate":1,"reason":"secret"}', '```{"candidate":1}```',
  '{"candidate":1e0}', '{"candidate":null}', 'x'.repeat(129), null])('strictly rejects invalid choice %s', response => {
  expect(parseMultiScaleAiChoice(response, [{ id: 7 }, { id: 8 }], false)).toBeUndefined();
});
test('maps both orders and abstention without exporting raw response', () => {
  expect(parseMultiScaleAiChoice(' { "candidate" : 1 } ', [{ id: 7 }, { id: 8 }], true)).toBe(8);
  expect(parseMultiScaleAiChoice('{"candidate":0}', [{ id: 7 }, { id: 8 }], false)).toBeNull();
  expect(parseMultiScaleAiChoice('{"candidate":3}', [{ id: 7 }, { id: 8 }], false)).toBeUndefined();
});
