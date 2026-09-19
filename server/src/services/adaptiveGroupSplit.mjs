/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { representativeSimilarity as similarity } from './representativeFitSession.mjs';

export const ADAPTIVE_SPLIT_PASSES = 32;
export const ADAPTIVE_SPLIT_GAIN = 0.1;
const rank = (hash, salt) => createHash('sha256').update(`${salt}:${hash}`).digest('hex');

/** Only normalized, bounded, worker/benchmark-private rows may enter these helpers. */
export function groupDirection(items) {
  if (!items.length) return null;
  const sum = Array(items[0].vector.length).fill(0);
  for (const { vector } of items) for (let d = 0; d < sum.length; d++) sum[d] += vector[d];
  const norm = Math.sqrt(sum.reduce((total, value) => total + value * value, 0));
  return norm > 1e-12 ? sum.map(value => value / norm) : null;
}

export function groupLoss(items, centers) {
  return items.reduce((total, row) => total + 1 - Math.max(...centers.map(center => similarity(row.vector, center))), 0) / items.length;
}

function partition(items, centers) {
  const children = [[], []];
  for (const item of items) children[similarity(item.vector, centers[1]) > similarity(item.vector, centers[0]) ? 1 : 0].push(item);
  return children;
}

async function fitPair(items, first, signal) {
  let farthest = items[0], minimum = Infinity;
  for (const item of items) {
    const score = similarity(item.vector, first.vector);
    if (score < minimum) { minimum = score; farthest = item; }
  }
  let centers = [first.vector, farthest.vector], previous = [], children;
  for (let pass = 0; pass < ADAPTIVE_SPLIT_PASSES; pass++) {
    const labels = []; children = [[], []];
    for (let i = 0; i < items.length; i++) {
      if (i % 128 === 0) { await setImmediate(); signal?.throwIfAborted(); }
      const label = similarity(items[i].vector, centers[1]) > similarity(items[i].vector, centers[0]) ? 1 : 0;
      labels.push(label); children[label].push(items[i]);
    }
    if (children.some(rows => rows.length < 3)) return null;
    const updated = children.map(groupDirection);
    if (updated.some(center => !center)) return null;
    centers = updated;
    if (labels.every((label, index) => label === previous[index])) return { centers, loss: groupLoss(items, centers) };
    previous = labels;
  }
  return null;
}

/** Internal validation never includes outer evaluation queries; failure keeps the whole parent. */
export async function proposeAdaptiveSplit(items, signal) {
  signal?.throwIfAborted();
  if (items.length < 8) return { reason: 'insufficient_support' };
  const ordered = items.map(item => ({ item, rank: rank(item.hash, 'adaptive-validation-v1') }))
    .sort((a, b) => a.rank.localeCompare(b.rank));
  const count = Math.max(2, Math.floor(items.length / 5));
  const validation = ordered.slice(0, count).map(row => row.item), training = ordered.slice(count).map(row => row.item);
  const parent = groupDirection(training);
  const trainingLoss = parent ? groupLoss(training, [parent]) : 0;
  if (trainingLoss <= 1e-12) return { reason: 'no_training_variation' };
  const central = training.map(item => ({ item, score: similarity(item.vector, parent) }))
    .sort((a, b) => b.score - a.score || a.item.hash.localeCompare(b.item.hash))[0].item;
  const salted = training.map(item => ({ item, rank: rank(item.hash, 'adaptive-start-v1') }))
    .sort((a, b) => a.rank.localeCompare(b.rank))[0].item;
  const runs = [];
  for (const first of [central, salted]) {
    const run = await fitPair(training, first, signal);
    if (run) runs.push(run);
  }
  if (!runs.length) return { reason: 'unsupported_or_unconverged' };
  const best = runs.sort((a, b) => a.loss - b.loss)[0];
  if (partition(validation, best.centers).some(rows => !rows.length)) return { reason: 'validation_support_missing' };
  const validationLoss = groupLoss(validation, [parent]);
  const trainGain = 1 - best.loss / trainingLoss;
  const validationGain = validationLoss > 1e-12 ? 1 - groupLoss(validation, best.centers) / validationLoss : 0;
  if (trainGain < ADAPTIVE_SPLIT_GAIN || validationGain < ADAPTIVE_SPLIT_GAIN) return { reason: 'insufficient_validation_gain' };
  const children = partition(items, best.centers);
  signal?.throwIfAborted();
  return { reason: 'split', children };
}
