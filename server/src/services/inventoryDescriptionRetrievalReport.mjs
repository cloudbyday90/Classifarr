/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inventoryDescriptionIdentity } from './inventoryDescriptionCorpus.mjs';
import { normalizeDescriptionVector, descriptionCosineSimilarity } from './inventoryDescriptionSimilarity.mjs';
import { buildInventorySemanticSampleReport, inventorySemanticLibraryWinner as winner } from './inventorySemanticSampleReport.mjs';

/** Exact, shadow-only retrieval. Returns aggregates, never neighbor content. */
export function buildInventoryDescriptionRetrievalReport(snapshot, rawVectors, dimensions) {
  const { cases, corpus } = snapshot;
  const held = new Set(cases.map(entry => inventoryDescriptionIdentity(entry.item)));
  if (held.size !== cases.length) throw new Error('inventory_description_cohort_duplicate');
  const documents = new Map(corpus.documents.map(doc => [doc.key, doc]));
  const vectors = new Map([...corpus.texts.keys()].map(hash => [hash, normalizeDescriptionVector(rawVectors.get(hash), dimensions)]));
  const fixedCases = [];
  const fullCases = [];
  let missingQueries = 0;
  let missingFixedNeighbors = 0;
  let overlappingNeighbors = 0;
  for (const entry of cases) {
    const queryDoc = documents.get(inventoryDescriptionIdentity(entry.item));
    if (!queryDoc) { missingQueries++; continue; }
    const queryVector = vectors.get(queryDoc.hash);
    const item = { ...entry.item, metadata: { ...entry.item.metadata, overview: corpus.texts.get(queryDoc.hash) } };
    const libraryBase = entry.libraries.map(library => ({
      ...library, observedMembership: queryDoc.libraryIds.includes(library.id), neighbors: [],
    }));
    const neighbors = new Map(libraryBase.map(library => [library.id, []]));
    const score = doc => descriptionCosineSimilarity(queryVector, vectors.get(doc.hash));
    const neighbor = (doc, similarity) => ({ similarity, hasAuthorizedOutcome: false,
      item: { metadata: { media_type: doc.type, tmdb_id: doc.id, overview: corpus.texts.get(doc.hash) } } });
    for (const doc of corpus.documents) {
      if (doc.type !== queryDoc.type || held.has(doc.key)) continue;
      const similarity = score(doc);
      for (const libraryId of doc.libraryIds) {
        const selected = neighbors.get(libraryId);
        if (!selected) continue;
        selected.push({ doc, similarity });
        selected.sort((a, b) => b.similarity - a.similarity || a.doc.id - b.doc.id);
        if (selected.length > 3) selected.pop();
      }
    }
    const fixed = { ...entry, item, libraries: libraryBase.map((library, index) => ({
      ...library, neighbors: entry.libraries[index].neighbors.flatMap(previous => {
        const key = inventoryDescriptionIdentity(previous.item);
        if (held.has(key)) throw new Error('inventory_description_cohort_leak');
        const doc = documents.get(key);
        if (!doc || doc.type !== queryDoc.type || !doc.libraryIds.includes(library.id)) { missingFixedNeighbors++; return []; }
        return [neighbor(doc, score(doc))];
      }),
    })) };
    const full = { ...entry, item, libraries: libraryBase.map(library => ({
      ...library, neighbors: neighbors.get(library.id).map(({ doc, similarity }) => neighbor(doc, similarity)),
    })) };
    for (let index = 0; index < fixed.libraries.length; index++) {
      const keys = new Set(fixed.libraries[index].neighbors.map(n => inventoryDescriptionIdentity(n.item)));
      overlappingNeighbors += full.libraries[index].neighbors.filter(n => keys.has(inventoryDescriptionIdentity(n.item))).length;
    }
    fixedCases.push(fixed);
    fullCases.push(full);
  }
  const changes = fixedCases.map((entry, index) => ({ stratum: entry.item.stratum, before: winner(entry), after: winner(fullCases[index]) }));
  const changed = row => row.before !== null && row.after !== null && row.before !== row.after;
  const context = { requested: cases.length, libraryCount: snapshot.report.activeLibraries };
  const summarize = entries => ({ ...buildInventorySemanticSampleReport(entries, context).summary,
    neighborsWithAuthorizedOutcome: null }); // This retrieval path does not query outcome receipts.
  return {
    sampled: cases.length, compared: fullCases.length, missingQueryDescriptions: missingQueries,
    missingFixedNeighbors, overlappingNeighbors,
    changedWinners: changes.filter(changed).length,
    newTiesOrInsufficientLibraries: changes.filter(row => row.before !== null && row.after === null).length,
    resolvedTiesOrInsufficientLibraries: changes.filter(row => row.before === null && row.after !== null).length,
    currentDescriptionFixedNeighbors: summarize(fixedCases),
    currentDescriptionFullInventory: summarize(fullCases),
    historicalStoredBaseline: snapshot.report.summary,
    strata: Object.fromEntries(Object.keys(snapshot.report.strata).map(stratum => [stratum, {
      compared: changes.filter(row => row.stratum === stratum).length,
      changedWinners: changes.filter(row => row.stratum === stratum && changed(row)).length,
    }])),
    independentLabels: 0, accuracy: null,
  };
}
