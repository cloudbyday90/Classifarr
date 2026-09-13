/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { createInventoryRepresentativeIndex } from './inventoryRepresentativeGroups.mjs';
import { fitStableRepresentativeGeometry } from './inventoryRepresentativeStability.mjs';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { validateEmbedding } from '../utils/embeddingValidation.mjs';

export const INVENTORY_REPRESENTATIVE_PROFILE_VERSION = 'inventory_representative_profile_v1';
export const REPRESENTATIVE_PROFILE_COMPONENT_LIMIT = 8_000_000;

/** Private canonical source digest. Neither the key nor these inputs belong in logs. */
export function inventoryRepresentativeSourceKey(snapshot, identity, configKey) {
  const representation = validateDescriptionRepresentation(identity);
  if (snapshot.corpus.texts.size * identity.dimensions > REPRESENTATIVE_PROFILE_COMPONENT_LIMIT ||
      snapshot.vectors.size !== snapshot.corpus.texts.size) throw new Error('inventory_representative_profile_input_budget');
  const hash = createHash('sha256');
  const add = value => hash.update(JSON.stringify(value)).update('\n');
  add([INVENTORY_REPRESENTATIVE_PROFILE_VERSION, representation, configKey]);
  add(snapshot.libraries.map(row => [row.id, row.media_type]).sort((a, b) => a[0] - b[0]));
  add(snapshot.corpus.documents.map(row => [row.key, row.type, row.hash, [...row.libraryIds].sort((a, b) => a - b)])
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const key of [...snapshot.corpus.texts.keys()].sort()) {
    add(key);
    const vector = validateEmbedding(snapshot.vectors.get(key), identity.dimensions);
    const bytes = Buffer.allocUnsafe(vector.length * 4);
    vector.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
    hash.update(bytes);
  }
  return hash.digest('hex');
}

/** Full inventory only: deliberately lacks the benchmark's held-out model contract. */
export async function buildInventoryRepresentativeProfile({ snapshot, dimensions }, { signal } = {}) {
  if (snapshot.corpus.texts.size * dimensions > REPRESENTATIVE_PROFILE_COMPONENT_LIMIT) {
    throw new Error('inventory_representative_profile_input_budget');
  }
  const index = createInventoryRepresentativeIndex(snapshot, dimensions, 1, { stability: true });
  const buckets = new Map([...index.scope.keys()].sort((a, b) => a - b).map(id => [id, []]));
  const summary = { libraries: buckets.size, trainingDescriptions: 0, sharedDescriptions: 0,
    groups: 0, sparseLibraries: 0, unconvergedStarts: 0, discardedDescriptions: 0 };
  for (const group of index.groups.values()) {
    if (group.libraries.size > 1) { summary.sharedDescriptions++; continue; }
    if (group.libraries.size === 1) {
      buckets.get([...group.libraries][0]).push({ hash: group.hash, vector: index.vectors.get(group.hash) });
      summary.trainingDescriptions++;
    }
  }
  const libraries = new Map();
  let weight = 1024;
  for (const [id, items] of buckets) {
    signal?.throwIfAborted();
    items.sort((a, b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
    const fit = await fitStableRepresentativeGeometry(items, { signal, includeLegacy: false });
    libraries.set(id, { mediaType: index.scope.get(id), selectedStart: fit.stability.selectedStart,
      starts: fit.runs.map(run => ({ groups: run.groups, converged: run.converged })), stability: fit.stability });
    summary.groups += fit.groups.length;
    summary.sparseLibraries += Number(!fit.groups.length);
    summary.unconvergedStarts += fit.runs.filter(run => !run.converged).length;
    summary.discardedDescriptions += fit.discarded;
    weight += 4096 + fit.runs.reduce((sum, run) => sum + run.groups.length * (dimensions * 8 + 2048), 0);
  }
  return { kind: 'full_inventory_shadow', version: INVENTORY_REPRESENTATIVE_PROFILE_VERSION, libraries, summary, weight };
}
