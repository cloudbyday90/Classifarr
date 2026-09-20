/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CROSS_ENCODER_BATCH_SIZE } from './localCrossEncoderConfig.mjs';

export const CROSS_ENCODER_TOLERANCE = 0.0001;
export function crossEncoderWinner(pairs, scores) {
  if (!Array.isArray(scores) || pairs.length !== scores.length || scores.some(score => !Number.isFinite(score))) {
    throw new Error('cross_encoder_response_invalid');
  }
  const grouped = new Map();
  pairs.forEach((pair, index) => grouped.set(pair.id, [...(grouped.get(pair.id) ?? []), scores[index]]));
  if (grouped.size < 2 || [...grouped.values()].some(values => values.length < 2)) throw new Error('cross_encoder_examples_missing');
  const ranked = [...grouped].map(([id, values]) => ({ id, score: values.sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a / 2 + b / 2) }))
    .sort((a, b) => b.score - a.score || a.id - b.id);
  return ranked[0].score - ranked[1].score <= CROSS_ENCODER_TOLERANCE ? null : ranked[0].id;
}

/** Three uncached passes: original, identical repeat, reversed pairs. Never convert logits to confidence. */
export async function runCrossEncoderTrial(plan, { client, signal, checkpoint = () => {}, onScoringCall = () => {} }) {
  const pairs = plan.candidates.flatMap(candidate => candidate.examples.map(text => ({ id: candidate.id, text })));
  const passes = [], latencies = [];
  let identity;
  for (const reverse of [false, false, true]) {
    const ordered = reverse ? [...pairs].reverse() : pairs, scores = [];
    for (let offset = 0; offset < ordered.length; offset += CROSS_ENCODER_BATCH_SIZE) {
      checkpoint(); signal?.throwIfAborted();
      const result = await client.score({ query: plan.query.overview, texts: ordered.slice(offset, offset + CROSS_ENCODER_BATCH_SIZE).map(pair => pair.text) }, { signal, onScoringCall });
      signal?.throwIfAborted(); checkpoint();
      if (identity && JSON.stringify(identity) !== JSON.stringify(result.identity)) throw new Error('cross_encoder_identity_invalid');
      identity = result.identity;
      if (!Array.isArray(result.scores) || result.scores.length !== Math.min(CROSS_ENCODER_BATCH_SIZE, ordered.length - offset) ||
          result.scores.some(score => typeof score !== 'number' || !Number.isFinite(score)) ||
          !Number.isFinite(result.latencyMs) || result.latencyMs < 0) throw new Error('cross_encoder_response_invalid');
      scores.push(...result.scores); latencies.push(result.latencyMs);
    }
    passes.push(reverse ? scores.reverse() : scores);
  }
  const winners = passes.map(scores => crossEncoderWinner(pairs, scores));
  const maxDelta = Math.max(...passes.slice(1).flatMap(scores => scores.map((score, index) => Math.abs(score - passes[0][index]))));
  const stable = maxDelta <= CROSS_ENCODER_TOLERANCE && winners.every(id => id === winners[0]);
  return { status: !stable ? 'unstable' : winners[0] === null ? 'abstained' : 'supported',
    winner: stable ? winners[0] : null, maxDelta, latencies, identity };
}
