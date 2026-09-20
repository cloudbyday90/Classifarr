/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fixture } from './inventoryMultiScaleFixture.mjs';

export function linearFixture() {
  const snapshot = fixture();
  snapshot.trainingExclusions = new Set();
  snapshot.candidateMetadata = new Map(snapshot.corpus.documents.map(doc => [doc.key,
    { genres: [`synthetic-${doc.libraryIds[0]}`], studio: '', rating: '' }]));
  return snapshot;
}
