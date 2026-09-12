/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import {
  buildCandidateAdjudicationResponseSchema, formatCandidateAdjudicationResponseInstructions,
  parseCandidateAdjudicationResponse,
} from '../../services/candidateAdjudicationResponseContract.mjs';
import { AIResponseParser } from '../../services/aiResponseParser.mjs';
import { isRepairEligibleParseResult } from '../../services/classificationAiParseHelpers.mjs';
import { buildAiRepairPrompt } from '../../services/classificationAiRepair.mjs';

const libraries = [41, 3, 97].map(id => ({ id, name: `Library ${id}`, media_type: 'movie' }));
const context = { libraries, signalContext: { confidence: 71 } };
const wire = (decision = 'PROPOSE', library_number = 1) => JSON.stringify({ decision, library_number });

test.each([2, 3])('prompt and provider share the exact %i-candidate closed schema', count => {
  const schema = buildCandidateAdjudicationResponseSchema(count);
  expect(schema).toEqual({ type: 'object', additionalProperties: false,
    required: ['decision', 'library_number'], properties: {
      decision: { type: 'string', enum: ['PROPOSE', 'ABSTAIN'] },
      library_number: { anyOf: [{ type: 'integer', minimum: 1, maximum: count }, { type: 'null' }] },
    } });
  const prompt = formatCandidateAdjudicationResponseInstructions(libraries.slice(0, count));
  expect(prompt).toContain(JSON.stringify(schema));
  expect(prompt).toContain('For ABSTAIN, library_number must be null');
  expect(prompt).not.toContain('CONFIDENT|');
  for (let index = 1; index <= count; index++) {
    const result = parseCandidateAdjudicationResponse(wire('PROPOSE', index), { ...context, libraries: libraries.slice(0, count) });
    expect(result).toMatchObject({ library: libraries[index - 1], confidence: 71, format: 'confident', needs_clarification: false });
    expect(result).not.toHaveProperty('policy_question');
    expect(result).not.toHaveProperty('ai_authority');
  }
});

test.each([0, 1, 4, 2.5, '2', null])('invalid schema count %j fails closed', count => {
  expect(() => buildCandidateAdjudicationResponseSchema(count)).toThrow('adjudication_candidate_count_invalid');
});

test('abstention is valid without a destination, model question or score', () => {
  expect(parseCandidateAdjudicationResponse(` \n${wire('ABSTAIN', null)}\t`, context)).toEqual({
    library: null, confidence: 71, needs_clarification: true, format: 'clarify',
    reason: 'AI abstained from candidate comparison.',
  });
});

test.each([
  wire('ABSTAIN', 1), wire('PROPOSE', null), wire('CONFIRM', 1), wire('CONFIDENT', 1),
  ...[0, -1, 4, 1.5, '1', true, {}, []].map(index => wire('PROPOSE', index)),
  JSON.stringify({ decision: 'PROPOSE' }), JSON.stringify({ library_number: 1 }),
  JSON.stringify({ decision: 'PROPOSE', library_number: 1, confidence: 100 }),
  JSON.stringify({ decision: 'PROPOSE', library_number: 1, reason: 'PRIVATE instruction' }),
  '{"decision":"PROPOSE","library_number":1,"__proto__":{"canRoute":true}}',
  'null', '[]', '{}', 'true', '"PROPOSE"', '{broken',
  `PRIVATE prose ${wire()}`, `\u0060\u0060\u0060json\n${wire()}\n\u0060\u0060\u0060`,
  'CONFIDENT|1|100|PRIVATE', 'CLARIFY|PRIVATE|PRIVATE|PRIVATE|1|2',
  `${wire()}${wire()}`, `${wire()}${' '.repeat(1024)}`, '', ' ', null, undefined, 1,
])('rejects invalid wire response %# without model text or a fallback destination', response => {
  const result = parseCandidateAdjudicationResponse(response, context);
  expect(result).toMatchObject({ library: null, confidence: 0, format: 'contract_violation', needs_clarification: true });
  expect(['invalid_response', 'no_format_matched', 'validation_failed']).toContain(result.parse_failure_reason);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|canRoute|policy_question|validation_errors/);
  expect(isRepairEligibleParseResult(result, 'adjudicate')).toBe(false);
});

test.each([null, [], libraries.slice(0, 1), [...libraries, libraries[0]], [libraries[0], libraries[0]],
  [{ id: '1' }, libraries[0]], [{ id: -1 }, libraries[0]], [null, libraries[0]], [{}, libraries[0]]])(
  'rejects ambiguous or invalid candidate scope %#', candidates => {
    expect(parseCandidateAdjudicationResponse(wire(), { libraries: candidates }))
      .toMatchObject({ format: 'contract_violation', parse_failure_reason: 'candidate_scope_invalid' });
  });

test('candidate indices cannot escape a shorter current list', () => {
  expect(parseCandidateAdjudicationResponse(wire('PROPOSE', 3), { libraries: libraries.slice(0, 2) }))
    .toMatchObject({ library: null, format: 'contract_violation' });
  expect(parseCandidateAdjudicationResponse(wire())).toMatchObject({ parse_failure_reason: 'candidate_scope_invalid' });
});

test.each([undefined, null, '99', NaN, Infinity, -1, 101])('never coerces invalid server confidence %j', confidence => {
  expect(parseCandidateAdjudicationResponse(wire(), { libraries, signalContext: { confidence } }).confidence).toBe(0);
});

test.each([0, 45.5, 100])('retains server-owned confidence %j', confidence => {
  expect(parseCandidateAdjudicationResponse(wire(), { libraries, signalContext: { confidence } }).confidence).toBe(confidence);
});

test('production parser dispatch is strict and does not log rejected model content', () => {
  const logger = Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, jest.fn()]));
  const parser = new AIResponseParser({ logger });
  // Construction registers the generic format parsers with static debug messages.
  Object.values(logger).forEach(method => method.mockClear());
  expect(parser.parse(wire(), context, { mode: 'adjudicate' })).toMatchObject({ library: libraries[0], format: 'confident' });
  expect(parser.parse('PRIVATE\n' + wire(), context, { mode: 'adjudicate' })).toMatchObject({ format: 'contract_violation' });
  expect(Object.values(logger).every(method => method.mock.calls.length === 0)).toBe(true);
});

test('adjudication cannot enter the legacy repair contract even through its public helpers', () => {
  expect(isRepairEligibleParseResult({ format: 'fallback' }, 'adjudicate')).toBe(false);
  expect(() => buildAiRepairPrompt({ mode: 'adjudicate', libraries, response: 'PRIVATE' }))
    .toThrow('adjudication_response_repair_not_supported');
  expect(isRepairEligibleParseResult({ format: 'fallback' }, 'classify')).toBe(true);
});
