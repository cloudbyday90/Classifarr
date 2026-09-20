/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { LINEAR_RANKER_SETTINGS, validateLinearTraining, linearRankerObjective, trainLinearRanker,
  scoreLinearRanker, chooseLinearRank } from '../../services/inventoryLinearRankerMath.mjs';
import { fitLinearRanker } from '../../services/inventoryLinearRankerFit.mjs';

function input(counts = [3, 3, 3]) {
  const labels = Uint16Array.from(counts.flatMap((n, c) => new Array(n).fill(c))), dimensions = counts.length;
  return { labels, dimensions, classCount: dimensions,
    matrix: Float64Array.from([...labels].flatMap(c => counts.map((_, d) => Number(c === d)))) };
}

test('objective gradient matches central finite differences including unregularized bias', () => {
  const data = input(), { counts } = validateLinearTraining(data);
  const weights = Float64Array.from({ length: 12 }, (_, i) => (i - 6) / 20);
  const { gradient } = linearRankerObjective(data, weights, counts), epsilon = 1e-6;
  weights.forEach((value, i) => {
    weights[i] = value + epsilon; const plus = linearRankerObjective(data, weights, counts).loss;
    weights[i] = value - epsilon; const minus = linearRankerObjective(data, weights, counts).loss;
    weights[i] = value;
    expect(gradient[i]).toBeCloseTo((plus - minus) / (2 * epsilon), 7);
  });
  expect(LINEAR_RANKER_SETTINGS).toMatchObject({ epochs: 80, learningRate: 0.5, l2: 0.01 });
});

test('fixed fitting learns separable classes, is repeatable, and balances class duplication', () => {
  const data = input(), model = trainLinearRanker(data), imbalanced = trainLinearRanker(input([30, 3, 3]));
  expect(trainLinearRanker(data)).toEqual(model);
  expect(model.summary.loss).toBeLessThan(model.summary.initialLoss);
  expect(model.summary.initialLoss).toBeCloseTo(Math.log(3), 10);
  expect(model.summary.gradientNorm).toBeGreaterThan(0); // Fixed budget is not a convergence certificate.
  for (let c = 0; c < 3; c++) {
    const vector = [0, 0, 0]; vector[c] = 1;
    expect(chooseLinearRank(scoreLinearRanker(model, vector), [11, 22, 33]).id).toBe([11, 22, 33][c]);
    model.weights.forEach((value, i) => expect(imbalanced.weights[i]).toBeCloseTo(value, 10));
  }
});

test('class relabeling permutes scores instead of changing semantic choice', () => {
  const original = input(), relabeled = { ...original, labels: Uint16Array.from(original.labels, c => (c + 1) % 3) };
  const first = scoreLinearRanker(trainLinearRanker(original), [1, 0, 0]);
  const second = scoreLinearRanker(trainLinearRanker(relabeled), [1, 0, 0]);
  first.forEach((value, c) => expect(second[(c + 1) % 3]).toBeCloseTo(value, 10));
});

test('identical evidence ties abstain without identifier or position tie-breaks', () => {
  const data = input(); data.matrix = Float64Array.from({ length: data.matrix.length }, (_, i) => Number(i % 3 === 0));
  const scores = scoreLinearRanker(trainLinearRanker(data), [1, 0, 0]);
  expect(chooseLinearRank(scores, [99, 1, 500])).toMatchObject({ id: null });
  expect(chooseLinearRank([1, 1 + 1e-12], [1, 2]).id).toBeNull();
  expect(chooseLinearRank([], [])).toEqual({ id: null, margin: null });
  expect(chooseLinearRank([1], [99]).id).toBeNull();
  expect(() => chooseLinearRank([NaN, 1], [1, 2])).toThrow('rank_invalid');
  expect(() => chooseLinearRank([1], [])).toThrow('rank_invalid');
});

test.each([
  data => { data.matrix = []; }, data => { data.labels = []; }, data => { data.dimensions = 0; },
  data => { data.classCount = 65; }, data => { data.matrix = new Float64Array(2); },
  data => { data.labels[0] = 99; }, data => { data.matrix[0] = NaN; },
  data => { data.matrix[0] = Infinity; }, data => { data.matrix[0] = 0; },
  data => { data.matrix[0] = 10; }, data => { data.labels[0] = 1; },
])('rejects malformed, non-unit or sparse training input', change => {
  const data = input(); change(data); expect(() => trainLinearRanker(data)).toThrow();
});

test('rejects excessive work before iterating a large array', () => {
  const data = { matrix: new Float64Array(2_000_000), labels: new Uint16Array(2000), dimensions: 1000, classCount: 64 };
  expect(() => trainLinearRanker(data)).toThrow('work_budget');
});

test('nonfinite objective and malformed scoring cannot escape as candidates', () => {
  const data = input(), model = trainLinearRanker(data);
  expect(() => scoreLinearRanker(model, [1])).toThrow('score_shape');
  expect(() => scoreLinearRanker(model, [NaN, 0, 0])).toThrow('score_nonfinite');
  expect(() => linearRankerObjective(data, new Float64Array(12).fill(Infinity), new Uint32Array([3, 3, 3]))).toThrow('fit_nonfinite');
});

test('real worker matches local fitting, cancels in flight and permits subsequent work', async () => {
  const data = input(); expect(await fitLinearRanker(data)).toEqual(trainLinearRanker(data));
  const controller = new AbortController(), pending = fitLinearRanker(input([1000, 1000, 1000]), { signal: controller.signal });
  controller.abort(); await expect(pending).rejects.toThrow('cancelled');
  await expect(fitLinearRanker(data, { signal: controller.signal })).rejects.toThrow();
  expect(await fitLinearRanker(data)).toEqual(trainLinearRanker(data));
});
