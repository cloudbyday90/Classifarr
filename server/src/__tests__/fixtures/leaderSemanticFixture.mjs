/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function leaderSemanticFixture(count = 5) {
  return { kind: 'ambiguous_nomination', contextId: 'a'.repeat(64),
    metadata: { title: 'PRIVATE TITLE', media_type: 'tv', overview: 'A query about a voyage.', genres: ['Adventure'], keywords: ['voyage'],
      studio: 'Studio', certification: 'TV-PG', original_language: 'en', tmdb_id: 888, secret: 'PRIVATE SECRET' },
    candidateIds: Array.from({ length: count }, (_, index) => index + 1),
    evidence: { statusId: 'available', candidates: Array.from({ length: count }, (_, index) => ({ libraryId: index + 1,
      name: 'PRIVATE LIBRARY', eligible: 10, indexed: 10, items: [0, 1, 2].map(value => ({
        description: `Different example ${index} ${value}.`, sharedAcrossCandidates: false, similarity: .999 })) })) },
    observed: [1], baselineId: 2, vetoed: true };
}
