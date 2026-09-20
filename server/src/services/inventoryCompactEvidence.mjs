/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeDescriptionVector, descriptionCosineSimilarity as cosine } from './inventoryDescriptionSimilarity.mjs';
import { projectLiveInventoryDescriptionEvidence } from './liveInventoryDescriptionEvidence.mjs';

export const COMPACT_EVIDENCE_SELECTION = Object.freeze({ version: 'query_mmr_v1', maximumPool: 9,
  maximumExamples: 3, relevanceWeight: 0.8, redundancyCeiling: 0.95, minimumUtility: 0 });
const rank = (a, b) => b.similarity - a.similarity || a.hash.localeCompare(b.hash);
const invalid = () => new Error('compact_inventory_evidence_invalid');

/** Private, bounded extractive selection. The caller must enforce membership and holdouts first. */
export function selectCompactInventoryEvidence(queryVector, rows) {
  if (!Array.isArray(rows) || rows.length > COMPACT_EVIDENCE_SELECTION.maximumPool) throw invalid();
  const query = normalizeDescriptionVector(queryVector), hashes = new Set();
  // Validate the entire pool before filtering: an irrelevant malformed row is still invalid.
  const pool = Array.from(rows, row => {
    if (!row || typeof row.hash !== 'string' || !/^[a-f0-9]{64}$/.test(row.hash) || hashes.has(row.hash)) throw invalid();
    hashes.add(row.hash);
    const vector = normalizeDescriptionVector(row.vector, query.length), similarity = cosine(query, vector);
    const item = projectLiveInventoryDescriptionEvidence({ items: [{ description: row.description, similarity }] }, true).items[0];
    if (!item) throw invalid();
    return { hash: row.hash, vector, ...item };
  }).sort(rank);
  const selected = [], descriptions = new Set();
  while (selected.length < COMPACT_EVIDENCE_SELECTION.maximumExamples) {
    let best = null, bestUtility = COMPACT_EVIDENCE_SELECTION.minimumUtility;
    for (const row of pool) {
      if (row.similarity <= 0 || descriptions.has(row.description)) continue;
      const redundancy = Math.max(0, ...selected.map(other => cosine(row.vector, other.vector)));
      if (redundancy >= COMPACT_EVIDENCE_SELECTION.redundancyCeiling) continue;
      const utility = COMPACT_EVIDENCE_SELECTION.relevanceWeight * row.similarity -
        (1 - COMPACT_EVIDENCE_SELECTION.relevanceWeight) * redundancy;
      // Pool order supplies deterministic relevance/hash tie-breaking.
      if (utility > bestUtility) { best = row; bestUtility = utility; }
    }
    if (!best) break;
    selected.push(best); descriptions.add(best.description);
  }
  // Never retain vectors or arbitrary caller fields in a packet.
  return selected.map(({ hash, description, similarity, sharedAcrossCandidates }) =>
    ({ hash, description, similarity, sharedAcrossCandidates }));
}
