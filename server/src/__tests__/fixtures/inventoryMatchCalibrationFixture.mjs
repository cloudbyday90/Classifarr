/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

export const calibrationHash = value => createHash('sha256').update(String(value)).digest('hex');
export function matchCalibrationFixture() {
  const libraries = [{ id: 1, media_type: 'movie', name: 'Private A' }, { id: 2, media_type: 'movie', name: 'Private B' },
    { id: 3, media_type: 'tv', name: 'Private TV' }];
  const documents = [], vectors = new Map();
  for (let index = 0; index < 180; index++) {
    const library = libraries[Math.floor(index / 60)], id = index + 1, hash = calibrationHash(id);
    const angle = (index % 60) / 200 + (library.id === 2 ? Math.PI : 0);
    documents.push({ key: `${library.media_type}:${id}`, id, type: library.media_type, hash, libraryIds: [library.id] });
    vectors.set(hash, [Math.cos(angle), Math.sin(angle)]);
  }
  const entry = { mediaType: 'movie', itemIdentity: { mediaType: 'movie', tmdbId: 1 },
    descriptionHash: documents[0].hash, heldDescriptionHashes: new Set([documents[0].hash]) };
  return { documents, vectors, libraries, entry,
    representation: { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 } };
}
