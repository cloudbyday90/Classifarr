/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const LINEAR_RANKER_SETTINGS = Object.freeze({ epochs: 80, learningRate: 0.5, l2: 0.01,
  minClassDescriptions: 3, maxFitComponents: 12_000_000_000, maxBenchmarkComponents: 120_000_000_000 });

export function validateLinearTraining({ matrix, labels, dimensions, classCount }) {
  if (!(matrix instanceof Float64Array) || !(labels instanceof Uint16Array) ||
      !Number.isInteger(dimensions) || dimensions < 1 || dimensions > 16000 ||
      !Number.isInteger(classCount) || classCount < 2 || classCount > 64 || !labels.length || labels.length > 10000 ||
      matrix.length !== labels.length * dimensions || matrix.length > 8_000_000) throw new Error('inventory_linear_training_shape');
  const work = matrix.length * classCount * 2 * (LINEAR_RANKER_SETTINGS.epochs + 1);
  if (work > LINEAR_RANKER_SETTINGS.maxFitComponents) throw new Error('inventory_linear_fit_work_budget');
  const counts = new Uint32Array(classCount);
  for (let row = 0; row < labels.length; row++) {
    if (labels[row] >= classCount) throw new Error('inventory_linear_training_label');
    counts[labels[row]]++;
    let norm = 0;
    for (let d = 0; d < dimensions; d++) norm += matrix[row * dimensions + d] ** 2;
    if (!Number.isFinite(norm) || Math.abs(norm - 1) > 1e-6) throw new Error('inventory_linear_training_vector');
  }
  if (counts.some(count => count < LINEAR_RANKER_SETTINGS.minClassDescriptions)) throw new Error('inventory_linear_training_sparse');
  return { counts, work };
}

/** Full-batch class-balanced objective; weights use class-major (dimensions + bias) layout. */
export function linearRankerObjective({ matrix, labels, dimensions, classCount }, weights, counts) {
  const stride = dimensions + 1, gradient = new Float64Array(weights.length), logits = new Float64Array(classCount);
  let loss = 0;
  for (let row = 0; row < labels.length; row++) {
    const x = row * dimensions, weight = 1 / (classCount * counts[labels[row]]);
    let maximum = -Infinity;
    for (let c = 0; c < classCount; c++) {
      const offset = c * stride;
      let logit = weights[offset + dimensions];
      for (let d = 0; d < dimensions; d++) logit += weights[offset + d] * matrix[x + d];
      logits[c] = logit; maximum = Math.max(maximum, logit);
    }
    const target = logits[labels[row]];
    let sum = 0;
    for (let c = 0; c < classCount; c++) { logits[c] = Math.exp(logits[c] - maximum); sum += logits[c]; }
    loss += weight * (maximum + Math.log(sum) - target);
    for (let c = 0; c < classCount; c++) {
      const error = weight * (logits[c] / sum - Number(c === labels[row])), offset = c * stride;
      for (let d = 0; d < dimensions; d++) gradient[offset + d] += error * matrix[x + d];
      gradient[offset + dimensions] += error;
    }
  }
  for (let c = 0; c < classCount; c++) for (let d = 0; d < dimensions; d++) {
    const i = c * stride + d;
    loss += LINEAR_RANKER_SETTINGS.l2 * weights[i] ** 2 / 2;
    gradient[i] += LINEAR_RANKER_SETTINGS.l2 * weights[i];
  }
  if (!Number.isFinite(loss) || gradient.some(value => !Number.isFinite(value))) throw new Error('inventory_linear_fit_nonfinite');
  return { loss, gradient };
}

/** Fixed schedule, no randomness, early-stop tuning or access to held-out labels. */
export function trainLinearRanker(input) {
  const { counts, work } = validateLinearTraining(input);
  const weights = new Float64Array(input.classCount * (input.dimensions + 1));
  let objective = linearRankerObjective(input, weights, counts);
  const initialLoss = objective.loss;
  for (let epoch = 0; epoch < LINEAR_RANKER_SETTINGS.epochs; epoch++) {
    for (let i = 0; i < weights.length; i++) weights[i] -= LINEAR_RANKER_SETTINGS.learningRate * objective.gradient[i];
    const next = linearRankerObjective(input, weights, counts);
    if (next.loss > objective.loss + 1e-10) throw new Error('inventory_linear_fit_diverged');
    objective = next;
  }
  return { weights, dimensions: input.dimensions, classCount: input.classCount,
    summary: { epochs: LINEAR_RANKER_SETTINGS.epochs, initialLoss, loss: objective.loss,
      gradientNorm: Math.sqrt(objective.gradient.reduce((sum, value) => sum + value * value, 0)), workComponents: work } };
}

export function scoreLinearRanker(model, vector) {
  const { dimensions, classCount, weights } = model;
  if (vector.length !== dimensions || weights.length !== classCount * (dimensions + 1)) throw new Error('inventory_linear_score_shape');
  const scores = [];
  for (let c = 0; c < classCount; c++) {
    const offset = c * (dimensions + 1);
    let score = weights[offset + dimensions];
    for (let d = 0; d < dimensions; d++) score += weights[offset + d] * vector[d];
    if (!Number.isFinite(score)) throw new Error('inventory_linear_score_nonfinite');
    scores.push(score);
  }
  return scores;
}

/** No identifier/order tie-break and no conversion of logits into claimed confidence. */
export function chooseLinearRank(scores, classes) {
  if (scores.length !== classes.length || scores.some(score => !Number.isFinite(score))) throw new Error('inventory_linear_rank_invalid');
  if (scores.length < 2) return { id: null, margin: null };
  const ranked = scores.map((score, index) => ({ score, id: classes[index] })).sort((a, b) => b.score - a.score);
  const margin = ranked[0].score - ranked[1].score;
  return { id: margin > 1e-10 ? ranked[0].id : null, margin };
}
