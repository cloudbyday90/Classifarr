/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
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
      const bytes = Buffer.allocUnsafe(vector.length * 4);
      vector.forEach((component, index) => bytes.writeFloatLE(component, index * 4));
      hash.update(bytes);
    },
    finish: () => hash.digest('hex'),
  };
}
