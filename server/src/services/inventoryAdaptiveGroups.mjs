/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { representativeSimilarity as similarity } from './representativeFitSession.mjs';
import { groupDirection, groupLoss, proposeAdaptiveSplit } from './adaptiveGroupSplit.mjs';

export const ADAPTIVE_GROUP_LIMIT = 32;
export const ADAPTIVE_GROUP_DEPTH = 6;

/** Content-only, deterministic, bounded discovery. No provider, repository or routing dependency. */
export async function fitAdaptiveGroups(input, dimensions, { signal } = {}) {
  signal?.throwIfAborted();
  if (!Array.isArray(input) || input.length > 10000 || !Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions > 16000 ||
      input.length * dimensions > 8_000_000 || new Set(input.map(row => row?.hash)).size !== input.length ||
      input.some(row => typeof row?.hash !== 'string' || !/^[a-f0-9]{64}$/.test(row.hash))) throw new Error('adaptive_group_input_invalid');
  const items = input.map(({ hash, vector }) => ({ hash, vector: normalizeDescriptionVector(vector, dimensions) }))
    .sort((a, b) => a.hash.localeCompare(b.hash));
  const stops = {}, leaves = [];
  let attemptedSplits = 0, acceptedSplits = 0;
  const stop = reason => { stops[reason] = (stops[reason] ?? 0) + 1; };
  const node = (rows, depth) => {
    const center = groupDirection(rows);
    return { items: rows, depth, center, loss: center ? groupLoss(rows, [center]) : 0 };
  };
  const pending = [node(items, 0)];
  while (pending.length) {
    signal?.throwIfAborted();
    pending.sort((a, b) => b.loss - a.loss || (a.items[0]?.hash ?? '').localeCompare(b.items[0]?.hash ?? ''));
    const current = pending.shift();
    let proposal;
    if (!current.center) proposal = { reason: 'degenerate_direction' };
    else if (current.depth === ADAPTIVE_GROUP_DEPTH) proposal = { reason: 'depth_limit' };
    else if (leaves.length + pending.length + 1 >= ADAPTIVE_GROUP_LIMIT) proposal = { reason: 'group_limit' };
    else { attemptedSplits++; proposal = await proposeAdaptiveSplit(current.items, signal); }
    if (proposal.reason === 'split') {
      acceptedSplits++;
      pending.push(...proposal.children.map(rows => node(rows, current.depth + 1)));
    } else { stop(proposal.reason); leaves.push(current); }
  }
  const groups = [], unassigned = [];
  for (const leaf of leaves) {
    if (!leaf.center || leaf.items.length < 3) { unassigned.push(...leaf.items.map(row => row.hash)); continue; }
    const ranked = leaf.items.map(row => ({ hash: row.hash, score: similarity(row.vector, leaf.center) }))
      .sort((a, b) => b.score - a.score || a.hash.localeCompare(b.hash));
    groups.push({ centroid: leaf.center, support: ranked.length, representatives: ranked.slice(0, 3).map(row => row.hash),
      meanSimilarity: 1 - leaf.loss, hashes: leaf.items.map(row => row.hash) });
  }
  signal?.throwIfAborted();
  return { groups, unassigned, diagnostics: { attemptedSplits, acceptedSplits, stops } };
}
