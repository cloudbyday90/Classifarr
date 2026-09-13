/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { fitRepresentativeGeometry, REPRESENTATIVE_MAX_GROUPS, REPRESENTATIVE_MAX_PASSES, REPRESENTATIVE_STABILITY_PASSES } from './inventoryRepresentativeGeometry.mjs';

export const INVENTORY_REPRESENTATIVE_STABILITY_VERSION = 'inventory_representative_stability_v1';
export const REPRESENTATIVE_STABILITY_STARTS = 3;
// Assignment + mean updates, seeding and final diagnostics for the control and all starts.
export const REPRESENTATIVE_STABILITY_WORK_COMPONENTS = REPRESENTATIVE_MAX_GROUPS * (REPRESENTATIVE_MAX_PASSES + 4) + REPRESENTATIVE_MAX_PASSES +
  REPRESENTATIVE_STABILITY_STARTS * (REPRESENTATIVE_MAX_GROUPS * (REPRESENTATIVE_STABILITY_PASSES + 4) + REPRESENTATIVE_STABILITY_PASSES);
const round = value => Math.round(value * 1_000_000) / 1_000_000;
const pairs = count => count * (count - 1) / 2;

/** Internal partition comparison; labels are group assignments, never destination answers. */
export function representativePartitionAgreement(left, right) {
  if (left.length !== right.length) throw new Error('inventory_representative_partition_length');
  if (left.length < 2) return 1;
  const rows = new Map(), columns = new Map(), cells = new Map();
  for (let i = 0; i < left.length; i++) {
    const a = left[i], b = right[i], key = `${a}:${b}`;
    rows.set(a, (rows.get(a) ?? 0) + 1); columns.set(b, (columns.get(b) ?? 0) + 1);
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }
  const sumPairs = counts => [...counts.values()].reduce((sum, count) => sum + pairs(count), 0);
  const rowPairs = sumPairs(rows), columnPairs = sumPairs(columns);
  const expected = rowPairs * columnPairs / pairs(left.length), maximum = (rowPairs + columnPairs) / 2;
  return maximum === expected ? 1 : (sumPairs(cells) - expected) / (maximum - expected);
}

/** Prefer convergence, then training fit; exact ties keep fixed start order. */
export function selectRepresentativeFit(runs) {
  if (!runs.length || runs.some(run => !Number.isFinite(run.objective) || typeof run.converged !== 'boolean')) {
    throw new Error('inventory_representative_fit_invalid');
  }
  let best = 0;
  for (let i = 1; i < runs.length; i++) {
    if ((runs[i].converged && !runs[best].converged) ||
        (runs[i].converged === runs[best].converged && runs[i].objective > runs[best].objective)) best = i;
  }
  return best;
}

function saltedFirst(items, start) {
  let best = null, index = null;
  items.forEach((item, i) => {
    const digest = createHash('sha256').update(`classifarr-representative-start-${start}:${item.hash}`).digest('hex');
    if (best === null || digest < best) { best = digest; index = i; }
  });
  return index;
}

/** Sorted, validated, training-only items supplied by the scoped learner. */
export async function fitStableRepresentativeGeometry(items, { signal } = {}) {
  const legacy = await fitRepresentativeGeometry(items, { signal });
  const runs = [];
  for (let start = 0; start < REPRESENTATIVE_STABILITY_STARTS; start++) {
    signal?.throwIfAborted();
    runs.push(await fitRepresentativeGeometry(items, { signal, maxPasses: REPRESENTATIVE_STABILITY_PASSES,
      firstIndex: start ? saltedFirst(items, start) : null, diagnostics: true }));
  }
  const selectedStart = selectRepresentativeFit(runs), agreements = [];
  for (let a = 0; a < runs.length; a++) for (let b = a + 1; b < runs.length; b++) {
    agreements.push(representativePartitionAgreement(runs[a].labels, runs[b].labels));
  }
  const stability = { selectedStart, legacyIterations: legacy.iterations, legacyConverged: legacy.converged,
    totalIterations: legacy.iterations + runs.reduce((sum, run) => sum + run.iterations, 0),
    minimumPartitionAgreement: round(Math.min(...agreements)),
    starts: runs.map(run => ({ iterations: run.iterations, converged: run.converged, objective: round(run.objective),
      groups: run.groups.length, discardedDescriptions: run.discarded })) };
  // Individual assignments are needed only for the local partition comparison.
  const privateRuns = runs.map(({ labels: _labels, ...run }) => run);
  return { ...privateRuns[selectedStart], runs: privateRuns, legacy, stability };
}
