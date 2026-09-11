/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { HELD_OUT_SEMANTIC_STUDY_STRATA } from './heldOutSemanticStudyInventoryCandidate.mjs';

function summarize(cases) {
  const counts = {
    sampled: cases.length, withDescription: 0, withStoredEmbedding: 0,
    withNeighbors: 0, withCrossLibraryComparison: 0, withObservedMembership: 0,
    withScoredObservedLibrary: 0,
    observedAgreement: 0, observedDisagreement: 0, tiedComparisons: 0,
    neighbors: 0, neighborsWithDescription: 0, neighborsWithAuthorizedOutcome: 0,
    independentlyLabeled: 0, unlabeled: cases.length, accuracy: null,
  };
  for (const entry of cases) {
    counts.withDescription += Number(Boolean(entry.item.metadata.overview));
    counts.withStoredEmbedding += Number(entry.hasStoredEmbedding);
    counts.withObservedMembership += Number(entry.libraries.some(library => library.observedMembership));
    const scored = [];
    for (const library of entry.libraries) {
      counts.neighbors += library.neighbors.length;
      counts.neighborsWithDescription += library.neighbors.filter(neighbor => neighbor.item.metadata.overview).length;
      counts.neighborsWithAuthorizedOutcome += library.neighbors.filter(neighbor => neighbor.hasAuthorizedOutcome).length;
      if (library.neighbors.length) {
        scored.push({
          observedMembership: library.observedMembership,
          score: library.neighbors.reduce((sum, neighbor) => sum + neighbor.similarity, 0) / library.neighbors.length,
        });
      }
    }
    counts.withNeighbors += Number(scored.length > 0);
    counts.withScoredObservedLibrary += Number(scored.some(library => library.observedMembership));
    if (scored.length < 2) continue;
    counts.withCrossLibraryComparison++;
    scored.sort((a, b) => b.score - a.score);
    if (Math.abs(scored[0].score - scored[1].score) <= 1e-9) {
      counts.tiedComparisons++;
    } else if (scored.some(library => library.observedMembership)) {
      counts[scored[0].observedMembership ? 'observedAgreement' : 'observedDisagreement']++;
    }
  }
  return counts;
}

/** Explicit allowlist: never spread case data into the printable report. */
export function buildInventorySemanticSampleReport(cases, { requested, libraryCount }) {
  return {
    version: 'inventory_semantic_sample.v1',
    status: cases.length ? 'complete' : 'empty_inventory',
    requested, activeLibraries: libraryCount,
    representation: 'stored_classification_embedding_input_unverified',
    purposeProvenance: 'inventory_observation_not_declared_intent',
    scoreMeaning: 'mean_neighbor_cosine_similarity_not_confidence',
    referenceLabels: 'unavailable_no_independent_label_adapter',
    summary: summarize(cases),
    strata: Object.fromEntries(HELD_OUT_SEMANTIC_STUDY_STRATA.map(stratum => [
      stratum, summarize(cases.filter(entry => entry.item.stratum === stratum)),
    ])),
  };
}
