/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { isMap } from 'node:util/types';
import { createInventoryNeighborhoodIndex } from './inventoryNeighborhoodProfiles.mjs';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Private bindings exclude availability so a missing vector can still be repaired. */
export function inventoryNeighborhoodRecoverySource(corpus, identity, configKey) {
  if (typeof configKey !== 'string' || !configKey.length || configKey.length > 16384 ||
      !Array.isArray(corpus?.documents) || corpus.documents.length > 50000 ||
      !isMap(corpus.texts) || corpus.texts.size > 10000) throw new Error('neighborhood_recovery_source_invalid');
  const representation = digest([validateDescriptionRepresentation(identity), configKey]);
  const scope = new Map();
  for (const doc of corpus.documents) {
    if (!['movie', 'tv'].includes(doc?.type) || !/^[a-f0-9]{64}$/.test(doc.hash ?? '') ||
        !corpus.texts.has(doc.hash) || !Array.isArray(doc.libraryIds) || doc.libraryIds.length > 64) {
      throw new Error('neighborhood_recovery_source_invalid');
    }
    for (const id of doc.libraryIds) {
      if (!Number.isSafeInteger(id) || id < 1 || (scope.has(id) && scope.get(id) !== doc.type)) {
        throw new Error('neighborhood_recovery_source_invalid');
      }
      scope.set(id, doc.type);
    }
    if (scope.size > 64) throw new Error('neighborhood_recovery_source_invalid');
  }
  const index = createInventoryNeighborhoodIndex(corpus.documents, null,
    [...scope].map(([id, media_type]) => ({ id, media_type })));
  const libraries = new Map([...scope].map(([id, type]) => [id, { type, members: [], exclusive: [] }]));
  for (const group of index.groups.values()) {
    const ids = [...group.libraries].sort((a, b) => a - b);
    for (const id of ids) {
      const library = libraries.get(id);
      library.members.push([group.hash, ids]);
      if (ids.length === 1) library.exclusive.push(group.hash);
    }
  }
  for (const library of libraries.values()) {
    library.members.sort((a, b) => a[0].localeCompare(b[0]));
    library.binding = digest([library.type, library.members]);
    delete library.members;
    library.exclusive.sort();
  }
  return { representation, libraries };
}
