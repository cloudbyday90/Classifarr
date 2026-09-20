/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { assertRepresentativeSnapshotBudget } from './inventoryRepresentativeCoverage.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { inventoryDescriptionIdentity } from './inventoryDescriptionCorpus.mjs';
import { describeMultiScaleAiInputs } from './inventoryMultiScaleAiInputs.mjs';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';
import { LINEAR_RANKER_SETTINGS } from './inventoryLinearRankerMath.mjs';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function describeLinearRankerInputs(snapshot) {
  if (!(snapshot.trainingExclusions instanceof Set)) throw new Error('inventory_linear_provenance_required');
  const components = describeMultiScaleAiInputs(snapshot);
  return { ...components, version: 'inventory_linear_inputs_v1', hashes: { ...components.hashes,
    metadata: describeInventorySnapshotDigests(snapshot, new Map()).hashes.metadata,
    provenance: digest([...snapshot.trainingExclusions].sort(compare)) } };
}

/** Validate the complete source, including rows later excluded, before allocating training matrices. */
export function prepareLinearRankerSource(snapshot, dimensions) {
  assertRepresentativeSnapshotBudget(snapshot, dimensions);
  if (!(snapshot.trainingExclusions instanceof Set) || snapshot.trainingExclusions.size > 50000 ||
      !(snapshot.candidateMetadata instanceof Map) || snapshot.candidateMetadata.size > 50000) throw new Error('inventory_linear_source_invalid');
  const libraries = new Map();
  for (const library of snapshot.libraries) {
    if (!Number.isInteger(library.id) || library.id < 1 || library.id > 2147483647 ||
        !['movie', 'tv'].includes(library.media_type) || libraries.has(library.id)) throw new Error('inventory_linear_library_invalid');
    libraries.set(library.id, { id: library.id, media_type: library.media_type });
  }
  const vectors = new Map();
  for (const hash of snapshot.corpus.texts.keys()) vectors.set(hash, normalizeDescriptionVector(snapshot.vectors.get(hash), dimensions));
  const groups = new Map(), keys = new Set();
  for (const doc of snapshot.corpus.documents) {
    const identity = inventoryDescriptionIdentity({ media_type: doc.type, tmdb_id: doc.id });
    if (identity !== doc.key || keys.has(doc.key) || !doc.libraryIds.length ||
        new Set(doc.libraryIds).size !== doc.libraryIds.length || doc.libraryIds.some(id => libraries.get(id)?.media_type !== doc.type)) {
      throw new Error('inventory_linear_document_invalid');
    }
    keys.add(doc.key);
    if (!groups.has(doc.hash)) groups.set(doc.hash, []);
    groups.get(doc.hash).push(doc);
  }
  if ([...snapshot.trainingExclusions].some(key => !keys.has(key))) throw new Error('inventory_linear_provenance_invalid');
  return { groups: new Map([...groups].sort(([a], [b]) => compare(a, b))), libraries, vectors, dimensions,
    metadata: snapshot.candidateMetadata, exclusions: snapshot.trainingExclusions };
}

/** Whole-description exclusion prevents a second identity/media copy leaking into training. */
export function selectLinearRankerTraining(source, held) {
  const counts = { held: 0, retainedHistory: 0, shared: 0, conflictingMetadata: 0, sparse: 0, admitted: 0 };
  const rows = [];
  for (const [hash, documents] of source.groups) {
    if (held.has(hash)) { counts.held++; continue; }
    if (documents.some(doc => source.exclusions.has(doc.key))) { counts.retainedHistory++; continue; }
    if (new Set(documents.flatMap(doc => doc.libraryIds)).size !== 1 || new Set(documents.map(doc => doc.type)).size !== 1) {
      counts.shared++; continue;
    }
    const metadata = documents.map(doc => source.metadata.get(doc.key));
    if (metadata.some(value => value === null) || new Set(metadata.map(value => JSON.stringify(value ?? {}))).size !== 1) {
      counts.conflictingMetadata++; continue;
    }
    rows.push([...documents].sort((a, b) => compare(a.key, b.key))[0]);
  }
  const libraryCounts = new Map();
  for (const doc of rows) libraryCounts.set(doc.libraryIds[0], (libraryCounts.get(doc.libraryIds[0]) ?? 0) + 1);
  const documents = rows.filter(doc => {
    if (libraryCounts.get(doc.libraryIds[0]) < LINEAR_RANKER_SETTINGS.minClassDescriptions) { counts.sparse++; return false; }
    counts.admitted++; return true;
  });
  return { documents, counts };
}

export function buildLinearRankerMatrix(source, documents, type) {
  const rows = documents.filter(doc => doc.type === type);
  const classes = [...new Set(rows.map(doc => doc.libraryIds[0]))].sort((a, b) => a - b);
  const matrix = new Float64Array(rows.length * source.dimensions), labels = new Uint16Array(rows.length);
  for (const [index, doc] of rows.entries()) {
    matrix.set(source.vectors.get(doc.hash), index * source.dimensions);
    labels[index] = classes.indexOf(doc.libraryIds[0]);
  }
  return { matrix, labels, dimensions: source.dimensions, classes };
}
