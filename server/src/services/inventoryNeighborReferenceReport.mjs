/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const round = value => Math.round(value * 1_000_000) / 1_000_000;
function summarize(pairs) {
  const arm = key => {
    const values = pairs.map(pair => pair[key]), expected = values.reduce((sum, row) => sum + row.expected, 0);
    const recovered = values.reduce((sum, row) => sum + row.recovered, 0);
    const gaps = values.map(row => row.meanSimilarityGap).filter(value => value !== null);
    const statuses = [...new Set(values.map(row => row.selectionStatus))].sort();
    return { expected, recovered, recall: expected ? round(recovered / expected) : null,
      fullTopThree: values.filter(row => row.expected === 3 && row.recovered === 3).length,
      meanSimilarityGap: gaps.length ? round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : null,
      selectionStatuses: Object.fromEntries(statuses.map(status => [status, values.filter(row => row.selectionStatus === status).length])) };
  };
  const comparable = pairs.filter(pair => pair.ordered.meanSimilarityGap !== null && pair.representative.meanSimilarityGap !== null);
  return { candidateComparisons: pairs.length, ordered: arm('ordered'), representative: arm('representative'),
    improvedMean: comparable.filter(pair => pair.ordered.meanSimilarityGap - pair.representative.meanSimilarityGap > 1e-8).length,
    worsenedMean: comparable.filter(pair => pair.representative.meanSimilarityGap - pair.ordered.meanSimilarityGap > 1e-8).length,
    unchangedMean: comparable.filter(pair => Math.abs(pair.representative.meanSimilarityGap - pair.ordered.meanSimilarityGap) <= 1e-8).length };
}

/** Internal paired diagnostics; serialize aggregate counts only, never IDs or item hashes. */
export function buildNeighborReferenceReport(rows, libraries) {
  const pairs = rows.flatMap(row => row.ordered.map(ordered => {
    const representative = row.representative.find(value => value.libraryId === ordered.libraryId);
    if (!representative || representative.expected !== ordered.expected) throw new Error('neighbor_reference_report_scope_mismatch');
    return { mediaType: row.mediaType, libraryId: ordered.libraryId, ordered, representative };
  }));
  return { nominatedQueries: rows.length, ...summarize(pairs),
    byMedia: ['movie', 'tv'].map(mediaType => ({ mediaType, ...summarize(pairs.filter(pair => pair.mediaType === mediaType)) })),
    byLibrary: [...libraries].sort((a, b) => a.id - b.id).map((library, index) => ({ stratum: index + 1, mediaType: library.media_type,
      ...summarize(pairs.filter(pair => pair.libraryId === library.id)) })) };
}
