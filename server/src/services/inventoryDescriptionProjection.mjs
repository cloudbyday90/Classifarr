/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalStudyModel } from './localStudyEmbeddingClient.mjs';

export const INVENTORY_DESCRIPTION_PROJECTION_VERSION = 'synopsis_only_1000_codepoints.v1';

export function projectInventoryDescription(item) {
  const value = item?.metadata?.overview;
  if (typeof value !== 'string') return null;
  const points = [...value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/gu, ' ').trim()];
  if (!points.length) return null;
  return { text: points.slice(0, 1000).join(''), shortened: points.length > 1000 };
}

function identity(item) {
  const { media_type: type, tmdb_id: id } = item?.metadata ?? {};
  if (!['movie', 'tv'].includes(type) || !Number.isInteger(id) || id < 1) throw new Error('description_sample_identity_invalid');
  return `${type}:${id}`;
}

/** Freeze a paired population before inference; all returned text stays private. */
export function prepareInventoryDescriptionComparison(cases, embedder) {
  if (!Array.isArray(cases) || cases.length > 32) throw new Error('description_sample_size_invalid');
  const cohort = new Set(cases.map(entry => identity(entry.item)));
  if (cohort.size !== cases.length) throw new Error('description_sample_identity_duplicate');
  const documents = new Map();
  const paired = [];
  const exclusions = { missingQueryDescription: 0, incompatibleRepresentation: 0, insufficientLibraries: 0, missingNeighborDescriptions: 0 };
  let shortenedOccurrences = 0;
  let dimensions;
  function remember(projection) {
    shortenedOccurrences += Number(projection.shortened);
    if (!documents.has(projection.text)) documents.set(projection.text, documents.size);
    return documents.get(projection.text);
  }
  for (const entry of cases) {
    // Validate the whole neighborhood even when this query will be excluded.
    if (!Array.isArray(entry.libraries) || entry.libraries.length > 64) throw new Error('description_library_limit_exceeded');
    for (const library of entry.libraries) {
      if (!Array.isArray(library.neighbors) || library.neighbors.length > 3) throw new Error('description_neighbor_limit_exceeded');
      for (const neighbor of library.neighbors) {
        if (cohort.has(identity(neighbor.item))) throw new Error('description_cohort_leak');
        if (neighbor.item.metadata.media_type !== entry.item.metadata.media_type) throw new Error('description_media_type_mismatch');
      }
    }
    const query = projectInventoryDescription(entry.item);
    if (!query) { exclusions.missingQueryDescription++; continue; }
    const representation = entry.representation;
    let compatible = false;
    try {
      compatible = entry.hasStoredEmbedding && representation?.provider === embedder.provider &&
        canonicalStudyModel(representation.model) === embedder.model &&
        Number.isInteger(representation.dimensions) && representation.dimensions > 0 && representation.dimensions <= 16000;
    } catch { /* Missing/invalid provenance cannot establish a paired case. */ }
    if (!compatible) { exclusions.incompatibleRepresentation++; continue; }
    const libraries = entry.libraries.map(library => ({
      ...library,
      neighbors: library.neighbors.flatMap(neighbor => {
        const projection = projectInventoryDescription(neighbor.item);
        if (!projection) { exclusions.missingNeighborDescriptions++; return []; }
        return [{ ...neighbor, projection }];
      }),
    }));
    if (libraries.filter(library => library.neighbors.length).length < 2) { exclusions.insufficientLibraries++; continue; }
    if (dimensions !== undefined && dimensions !== representation.dimensions) throw new Error('description_dimensions_changed');
    dimensions = representation.dimensions;
    paired.push({ ...entry, queryIndex: remember(query), libraries: libraries.map(library => ({
      ...library, neighbors: library.neighbors.map(({ projection, ...neighbor }) => ({ ...neighbor, documentIndex: remember(projection) })),
    })) });
  }
  if (documents.size > 512) throw new Error('description_document_budget_exceeded');
  return { paired, texts: [...documents.keys()], dimensions, exclusions, shortenedOccurrences };
}
