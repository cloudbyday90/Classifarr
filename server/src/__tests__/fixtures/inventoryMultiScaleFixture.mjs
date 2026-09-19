/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { buildInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfile.mjs';
export const representation = { model: 'local:test', digest: 'a'.repeat(64), dimensions: 4 };
export const localFit = (snapshot, dimensions, dependencies) => buildInventoryRepresentativeProfile({ snapshot, dimensions }, dependencies);
export function fixture() {
  const libraries = [1, 2, 3, 4].map(id => ({ id, media_type: id < 3 ? 'movie' : 'tv', name: `PRIVATE library ${id}` }));
  const corpus = prepareInventoryDescriptionCorpus(libraries.flatMap(library => Array.from({ length: 12 }, (_, index) => ({
    tmdb_id: library.id * 100 + index, media_type: library.media_type, library_id: library.id, overview: `PRIVATE overview ${library.id} ${index}`,
  }))));
  return { libraries, corpus, vectors: new Map(corpus.documents.map(doc => [doc.hash,
    [1, 2, 3, 4].map(id => id === doc.libraryIds[0] ? 1 : 0)])) };
}
