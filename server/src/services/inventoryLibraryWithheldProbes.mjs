/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Pre-outcome selection: at most three exclusive groups per library, one outer fold per library, thirty probes total. */
export function selectLibraryWithheldProbes(documents, sample, foldByHash) {
  const membership = new Map();
  for (const doc of documents) {
    if (!membership.has(doc.hash)) membership.set(doc.hash, new Set());
    for (const id of doc.libraryIds) membership.get(doc.hash).add(`${doc.type}:${id}`);
  }
  const byLibrary = new Map();
  for (const doc of sample) {
    if (membership.get(doc.hash).size !== 1) continue;
    const id = doc.libraryIds[0];
    if (!byLibrary.has(id)) byLibrary.set(id, []);
    byLibrary.get(id).push({ doc, omittedLibraryId: id, fold: foldByHash.get(doc.hash) });
  }
  const groups = [...byLibrary].sort(([a], [b]) => a - b).map(([, rows]) => {
    const firstFold = Math.min(...rows.map(row => row.fold));
    return rows.filter(row => row.fold === firstFold).slice(0, 3);
  });
  const selected = [];
  for (let index = 0; index < 3; index++) for (const group of groups) {
    if (group[index] && selected.length < 30) selected.push(group[index]);
  }
  return selected;
}

/** Library withholding is a novelty proxy, not proof that another destination is semantically wrong. */
export function assessLibraryWithheldProbe(calibration, omittedLibraryId) {
  const { contextId, crossFitMatch: match, exactNeighbor: neighbor } = calibration;
  if (typeof contextId !== 'string' || !/^[a-f0-9]{64}$/.test(contextId) || match?.contextId !== contextId || neighbor?.contextId !== contextId ||
      !Array.isArray(match?.candidates) || !Array.isArray(neighbor?.candidates) ||
      [...match.candidates, ...neighbor.candidates].some(row => row.libraryId === omittedLibraryId)) throw new Error('withheld_probe_context_invalid');
  if (neighbor.status !== 'evaluated' || neighbor.candidates.length < 2 ||
      neighbor.candidates.length !== match.candidates.length ||
      neighbor.candidates.some(row => row.status !== 'available' || !row.referenceComplete) ||
      match.candidates.some(row => !['familiar', 'unusual'].includes(row.status))) return { status: 'unavailable', supported: 0 };
  const familiar = new Set(match.candidates.filter(row => row.status === 'familiar').map(row => row.libraryId));
  const supported = neighbor.candidates.filter(row => row.calibrated && familiar.has(row.libraryId)).length;
  return { status: supported ? 'supported_elsewhere' : familiar.size ? 'familiar_not_distinct' : 'no_familiar_library', supported };
}

export function buildLibraryWithheldProbeReport(rows, libraries) {
  const summarize = values => ({ sampled: values.length, unavailable: values.filter(row => row.status === 'unavailable').length,
    noFamiliarLibrary: values.filter(row => row.status === 'no_familiar_library').length,
    familiarNotDistinct: values.filter(row => row.status === 'familiar_not_distinct').length,
    supportedElsewhere: values.filter(row => row.status === 'supported_elsewhere').length });
  return { protocol: 'library_withheld_novelty_proxy_v1', ...summarize(rows), semanticGroundTruth: false, falseAcceptanceRate: null,
    byMedia: ['movie', 'tv'].map(mediaType => ({ mediaType, ...summarize(rows.filter(row => row.mediaType === mediaType)) })),
    byLibrary: [...libraries].sort((a, b) => a.id - b.id).map((library, index) => ({ stratum: index + 1, mediaType: library.media_type,
      ...summarize(rows.filter(row => row.omittedLibraryId === library.id)) })) };
}
