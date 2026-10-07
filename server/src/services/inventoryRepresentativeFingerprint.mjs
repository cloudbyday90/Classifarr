/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { assertRepresentativeMetadataBudget } from './inventoryRepresentativeCoverage.mjs';
import { validateInventoryVector } from './inventoryVectorValidation.mjs';

export const INVENTORY_REPRESENTATIVE_PROFILE_VERSION = 'inventory_representative_profile_v4';

/** Private v4 protocol shared by full and streamed reads; callers append hashes in sorted order. */
export function createRepresentativeFingerprint(snapshot, identity, configKey) {
  const representation = validateDescriptionRepresentation(identity);
  assertRepresentativeMetadataBudget(snapshot, identity.dimensions);
  const hash = createHash('sha256');
  let scratch = null;
  let finalized = false;
  const add = value => hash.update(JSON.stringify(value)).update('\n');
  add([INVENTORY_REPRESENTATIVE_PROFILE_VERSION, representation, configKey]);
  add(snapshot.libraries.map(row => [row.id, row.media_type]).sort((a, b) => a[0] - b[0]));
  add(snapshot.corpus.documents.map(row => [row.key, row.type, row.hash, [...row.libraryIds].sort((a, b) => a - b)])
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return {
    append(key, present, value) {
      add([key, present]);
      if (!present) return;
      const vector = validateInventoryVector(value, identity.dimensions);
      const length = vector.length;
      const bytes = scratch?.length === length * 4 ? scratch : Buffer.alloc(length * 4);
      // Borrow, not share: even a reentrant array accessor cannot overwrite this append.
      scratch = null;
      try {
        for (let index = 0; index < length; index++) bytes.writeFloatLE(vector[index], index * 4);
        hash.update(bytes);
      } finally {
        if (!finalized) scratch = bytes;
      }
    },
    finish() {
      try { return hash.digest('hex'); }
      finally { finalized = true; scratch = null; }
    },
  };
}
