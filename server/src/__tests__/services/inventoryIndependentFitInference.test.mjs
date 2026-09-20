/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createMultiScaleAiInference } from '../../services/inventoryMultiScaleAiInference.mjs';
import { identity, generationResult } from '../fixtures/inventoryMultiScaleAiFixture.mjs';

const plan = { candidates: [{ id: 9 }, { id: 4 }, { id: 1 }] };
const prompts = [['raw forward', 'raw reverse'], [['A1', 'B1', 'C1'], ['C2', 'B2', 'A2']]];
const make = (grades = {}, dependencies = {}) => {
  const client = { generate: jest.fn(async ({ prompt, responseContract, count, onGenerationCall }) => {
    onGenerationCall();
    if (responseContract === 'independent_fit') {
      expect(count).toBe(1);
      return { ...generationResult, response: JSON.stringify({ fit: grades[prompt] ?? 0 }) };
    }
    expect(count).toBe(3); return generationResult;
  }) };
  return { client, inference: createMultiScaleAiInference({ generateCases: 4, context: 8192 },
    { client, identity, independentFit: true, ...dependencies }) };
};

test('really repeats separate calls in reverse order, counterbalances timing and maps grades back before selection', async () => {
  const { client, inference } = make({ A1: 3, A2: 3, B1: 1, B2: 1, C1: 2, C2: 2 });
  for (let ordinal = 0; ordinal < 4; ordinal++) {
    expect(await inference.compare(plan, prompts, ordinal)).toEqual([{ status: 'abstained' }, { status: 'selected', id: 9 }]);
  }
  expect(await inference.compare(plan, prompts, 4)).toBeNull();
  expect(client.generate.mock.calls.map(([row]) => row.prompt)).toEqual([
    'raw forward', 'raw reverse', 'A1', 'B1', 'C1', 'C2', 'B2', 'A2',
    'A1', 'B1', 'C1', 'C2', 'B2', 'A2', 'raw forward', 'raw reverse',
    'raw reverse', 'raw forward', 'C2', 'B2', 'A2', 'A1', 'B1', 'C1',
    'C2', 'B2', 'A2', 'A1', 'B1', 'C1', 'raw reverse', 'raw forward',
  ]);
  expect(inference.read()).toMatchObject({ calls: 32, maximumCalls: 32, completePairs: 4,
    assessments: { compared: 12, changed: 0, grades: [0, 8, 8, 8] }, arms: [{ calls: 8 }, { name: 'independent', calls: 24 }] });
});

test('reports grade drift even when both final decisions agree; tied/weak candidates abstain', async () => {
  const { inference } = make({ A1: 3, A2: 3, B1: 1, B2: 2 });
  expect((await inference.compare(plan, prompts, 0))[1]).toEqual({ status: 'selected', id: 9 });
  expect(inference.read().assessments).toMatchObject({ changed: 1, casesWithChangedGrades: 1, compared: 3 });
  const tied = make({ A1: 3, A2: 3, B1: 3, B2: 3 });
  expect((await tied.inference.compare(plan, prompts, 0))[1]).toEqual({ status: 'abstained' });
  const changed = make({ A1: 3, A2: 1, B1: 1, B2: 3 });
  expect((await changed.inference.compare(plan, prompts, 0))[1]).toEqual({ status: 'order_sensitive' });
});

test('empty evidence consumes no model call and stays distinct from invalid output', async () => {
  const { client, inference } = make({ A1: 2, A2: 2 });
  expect((await inference.compare(plan, [prompts[0], [['A1', null, null], [null, null, 'A2']]], 0))[1])
    .toEqual({ status: 'selected', id: 9 });
  expect(client.generate).toHaveBeenCalledTimes(4);
  expect(inference.read().assessments).toMatchObject({ empty: 4, grades: [0, 0, 2, 0], compared: 3 });
});

test('malformed fit stops midway without retry, scoring the case or leaking provider text', async () => {
  const { client, inference } = make({ B1: 'PRIVATE invalid' });
  expect(await inference.compare(plan, prompts, 0)).toBeNull();
  expect(await inference.compare(plan, prompts, 1)).toBeNull();
  expect(client.generate).toHaveBeenCalledTimes(4);
  expect(inference.read()).toMatchObject({ completePairs: 0, failures: { invalid_response: 1 }, assessments: { compared: 0 } });
  expect(JSON.stringify(inference.read())).not.toContain('PRIVATE');
});

test('oversized or malformed packets reject before inference, keeping the eight-call ceiling meaningful', async () => {
  const { client, inference } = make();
  for (const passes of [null, [], [null, []], [Array(3), []], [['A', 'B', 'C', 'D'], ['A', 'B', 'C']], [['', 'B', 'C'], ['A', 'B', 'C']]]) {
    await expect(inference.compare(plan, [prompts[0], passes], 0)).rejects.toThrow('packet_invalid');
  }
  expect(client.generate).not.toHaveBeenCalled();
});
