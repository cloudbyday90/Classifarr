/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, jest.fn()]));
jest.unstable_mockModule('../../utils/logger.mjs', () => ({ createLogger: () => logger }));
const { AIResponseParser } = await import('../../services/aiResponseParser.mjs');
const parser = new AIResponseParser({ logger });
const metadata = { tmdb_id: 884411, media_type: 'movie', title: 'Owned unresolved item' };
const libraries = [
  { id: 11, name: 'Action', media_type: 'movie' }, { id: 22, name: 'Drama', media_type: 'movie' },
  { id: 33, name: 'Comedy', media_type: 'movie' }, { id: 44, name: 'Archive', media_type: 'movie' },
  { id: 55, name: 'Movies', media_type: 'movie' },
];
const jsonClarify = JSON.stringify({ decision: 'CLARIFY', problem_summary: 'Conflicting support',
  why_uncertain: 'Two choices', question: 'Which destination?', options: [5, 1] });
const cases = [
  ['missing', null, 'fallback'], ['non-string', 17, 'fallback'],
  ['narrative', 'An unsupported destination seems best.', 'contract_violation'],
  ['out-of-set', 'CONFIDENT|999|99|Untrusted choice', 'contract_violation'],
  ['partial clarification', 'CLARIFY|One choice|Missing support|Choose?|5|999', 'contract_violation'],
  ['pipe clarification', 'CLARIFY|Conflicting support|Two choices|Which destination?|5|1', 'clarify'],
  ['JSON clarification', jsonClarify, 'clarify'],
];
const hints = [
  ['absent', null],
  ['known high-confidence', { confidence: 99, suggestedLibrary: libraries[4], breakdown: [{ score: 99 }] }],
  ['copied out-of-set', JSON.parse(JSON.stringify({ confidence: 99, suggestedLibrary: { id: 999, name: 'Unproven hint' }, source: 'policy_engine' }))],
];

for (const [hint, signalContext] of hints) {
  test.each(cases)('%s with ' + hint + ' context has no primary generic destination', (_name, response, format) => {
    const result = parser.parse(response, { libraries, metadata, signalContext }, { mode: 'classify' });
    expect(result.library).toBeNull(); expect(result.needs_clarification).toBe(true); expect(result.format).toBe(format);
    const question = result.policy_question || result.clarification;
    expect(question.options.length).toBeGreaterThan(0); expect(question.options.length).toBeLessThanOrEqual(4);
    expect(question.options.every(option => libraries.some(library => library.id === option.library_id))).toBe(true);
    if (format !== 'clarify') {
      expect(question.question).not.toContain('Unproven hint');
      expect(question.why_uncertain).not.toContain('Deterministic scoring currently favors');
      if (question.meta) {
        expect(question.meta.suggested_library_id).toBeNull(); expect(question.meta.suggested_library_name).toBeNull();
      }
    }
  });
}

test('fallback choices keep supplied order/cap without promoting the named fifth destination', () => {
  const result = parser.parse(null, { libraries, metadata });
  expect(result.library).toBeNull();
  expect(result.clarification.options.map(option => option.library_id)).toEqual([11, 22, 33, 44]);
  expect(result.confidence).toBe(50);
});

test('matched partial options remain choices without becoming a primary reference', () => {
  const result = parser.parse('CLARIFY|One choice|Missing support|Choose?|5|999', { libraries, metadata });
  expect(result.library).toBeNull();
  expect(result.policy_question.options.map(option => option.library_id)).toEqual([55, 11, 22, 33]);
});

test('pipe and JSON classify clarification use the same contract despite ordinary signal context', () => {
  const context = { libraries, metadata, signalContext: { confidence: 83, suggestedLibrary: libraries[4] } };
  const pipe = parser.parse(cases[5][1], context, { mode: 'classify' });
  const json = parser.parse(jsonClarify, context, { mode: 'classify' });
  for (const result of [pipe, json]) {
    expect(result.library).toBeNull(); expect(result.format).toBe('clarify'); expect(result.needs_clarification).toBe(true);
    expect(result.confidence).toBe(83); expect(result.ai_advisory).toBeUndefined();
    expect(result.policy_question.question).toBe('Which destination?');
    expect(result.policy_question.options.map(option => option.library_id)).toEqual([55, 11]);
  }
});

test.each([0, 24, 88, undefined])('classify clarification preserves existing diagnostic/default semantics for %s', confidence => {
  const result = parser.parse(jsonClarify, { libraries, metadata, signalContext: { confidence } }, { mode: 'classify' });
  expect(result.library).toBeNull(); expect(result.confidence).toBe(confidence || 55);
});

test('renaming and reordering changes choices, never a missing primary reference', () => {
  for (const pool of [libraries, [...libraries].reverse(), libraries.map((library, index) => ({ ...library, name: `Arbitrary ${index}` }))]) {
    const result = parser.parse('Unstructured model text', { libraries: pool, metadata });
    expect(result.library).toBeNull(); expect(result.policy_question.meta.suggested_library_id).toBeNull();
    expect(result.policy_question.options.map(option => option.library_id)).toEqual(pool.slice(0, 4).map(library => library.id));
  }
});

test('successful generic proposals remain proposals with the existing confidence clamp', () => {
  const result = parser.parse('CONFIDENT|2|99|Supplied support', { libraries, metadata });
  expect(result.library).toBe(libraries[1]); expect(result.confidence).toBe(95); expect(result.needs_clarification).toBe(false);
});

test('explicit verification early-invalid and untagged legacy factories retain their compatibility behavior', () => {
  const context = { libraries, metadata, signalContext: { confidence: 91, suggestedLibrary: libraries[0] } };
  expect(parser.parse(null, context, { mode: 'verify' }).library).toBe(libraries[4]);
  expect(parser.createFallbackResult(libraries, metadata).library).toBe(libraries[4]);
  const result = parser.parse(jsonClarify, context, { mode: 'verify' });
  expect(result.library).toBe(libraries[0]); expect(result.format).toBe('verify_advisory'); expect(result.needs_clarification).toBe(false);
});
