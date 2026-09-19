/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { observationReadinessKey } from './inventoryObservationReadiness.mjs';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';
import { inventoryTmdbObservationDue } from './inventoryTmdbObservation.mjs';

/** Input groups have already passed representative coverage/partition validation. */
export function buildInventoryGroupReadiness(snapshot, references) {
  const summary = { groups: 0, groupsWithCurrentObservations: 0, groupsWithObservationGaps: 0,
    groupsWithUnknownObservations: 0, missingDescriptionIdentities: snapshot.corpus.coverage.missingDescriptions,
    conflictingDescriptionIdentities: snapshot.corpus.coverage.conflictingDescriptions };
  const byHash = new Map(), targets = new Map();
  for (const document of snapshot.corpus.documents) {
    if (!byHash.has(document.hash)) byHash.set(document.hash, []);
    byHash.get(document.hash).push(document);
  }
  for (const [libraryId, reference] of references) for (const hashes of reference.groups) {
    const gaps = [], unknown = [];
    for (const hash of hashes) {
      const documents = (byHash.get(hash) ?? []).filter(document => document.libraryIds.includes(libraryId));
      const states = documents.map(document => snapshot.observationReadiness?.get(observationReadinessKey(document.key, libraryId)));
      if (!states.length || states.some(state => !state || state === 'unknown')) unknown.push(hash);
      else if (states.some(state => state !== 'current')) gaps.push(hash);
    }
    summary.groups++;
    if (unknown.length) summary.groupsWithUnknownObservations++;
    else if (gaps.length) summary.groupsWithObservationGaps++;
    else summary.groupsWithCurrentObservations++;
    // Missing coverage is unknown, not permission to infer which item to repair.
    for (const hash of gaps) for (const document of byHash.get(hash) ?? []) {
      if (!document.libraryIds.includes(libraryId)) continue;
      const state = snapshot.observationReadiness.get(observationReadinessKey(document.key, libraryId));
      if (state !== 'missing_or_invalid' && state !== 'stale') continue;
      targets.set(observationReadinessKey(document.key, libraryId), { hash, fraction: (hashes.length - gaps.length) / hashes.length });
    }
  }
  return { summary, targets };
}

function targetForRow(row, targets) {
  if (row.source_library_active !== true) return null;
  const target = targets.get(observationReadinessKey(`${row.media_type}:${row.tmdb_id}`, row.library_id));
  if (!target) return null;
  const metadata = row.metadata ?? {};
  const overview = [metadata.overview, metadata.summary].find(value => typeof value === 'string' && value.trim());
  const projection = projectInventoryDescription({ metadata: { overview: overview?.slice(0, 4000) } });
  // History-only descriptions cannot be verified from this queue row: ordinary order.
  if (!projection || createHash('sha256').update(projection.text).digest('hex') !== target.hash) return null;
  const checked = new Date(row.inventory_tmdb_checked_at ?? NaN).getTime();
  if (!Number.isFinite(checked) || !inventoryTmdbObservationDue({ media: { media_type: row.media_type },
    inventory_tmdb: metadata.inventory_tmdb, inventory_tmdb_fetched_at: row.inventory_tmdb_fetched_at,
    inventory_tmdb_attempted_at: row.inventory_tmdb_attempted_at }, row.tmdb_id, checked)) return null;
  return target;
}

/** Reorder only already eligible rows; preserve at least half the slots for ordinary work. */
export function orderInventoryReadinessRefill(rows, targets) {
  if (!Array.isArray(rows) || rows.length > 5000) throw new Error('inventory_readiness_refill_budget');
  const priority = [], ordinary = [];
  for (const row of rows) {
    const target = targetForRow(row, targets);
    if (target) priority.push({ row, fraction: target.fraction });
    else ordinary.push(row);
  }
  priority.sort((a, b) => a.fraction - b.fraction || a.row.id - b.row.id);
  const ordered = [];
  for (let index = 0; index < Math.max(priority.length, ordinary.length); index++) {
    if (priority[index]) ordered.push(priority[index].row);
    if (ordinary[index]) ordered.push(ordinary[index]);
  }
  return ordered;
}
