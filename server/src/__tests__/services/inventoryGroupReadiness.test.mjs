/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { collectInventoryObservationReadiness } from '../../services/inventoryObservationReadiness.mjs';
import { buildInventoryGroupReadiness, orderInventoryReadinessRefill } from '../../services/inventoryGroupReadiness.mjs';

const checked = '2026-09-19T12:00:00Z';
const corpusOf = rows => prepareInventoryDescriptionCorpus(rows.map(row => ({ ...row, metadata: undefined })));
function fixture() {
  const rows = Array.from({ length: 12 }, (_, index) => {
    const media_type = index < 6 ? 'movie' : 'tv', library_id = index < 6 ? 1 : 2;
    const tmdb_id = index + 1, overview = `Private synopsis number ${index}`;
    const observation = { version: 1, tmdb_id, media_type, keywords: [], original_language: null };
    const metadata = { overview, inventory_tmdb: observation };
    return { id: index + 1, library_id, media_type, tmdb_id, overview, source_library_active: true,
      metadata, readiness_metadata: metadata,
      inventory_tmdb_checked_at: checked, inventory_tmdb_fetched_at: checked };
  });
  const corpus = corpusOf(rows);
  const snapshot = { corpus, observationReadiness: collectInventoryObservationReadiness(rows) };
  const references = new Map([1, 2].map(id => [id, { groups: [corpus.documents.filter(doc => doc.libraryIds.includes(id)).map(doc => doc.hash)] }]));
  return { rows, snapshot, references };
}

test('empty keywords/unknown language are valid observations, not broken content or retry triggers', () => {
  const { snapshot, references, rows } = fixture();
  const plan = buildInventoryGroupReadiness(snapshot, references);
  expect(plan.summary).toEqual({ groups: 2, groupsWithCurrentObservations: 2, groupsWithObservationGaps: 0,
    groupsWithUnknownObservations: 0, missingDescriptionIdentities: 0, conflictingDescriptionIdentities: 0 });
  expect(plan.targets.size).toBe(0);
  expect(orderInventoryReadinessRefill(rows, plan.targets)).toEqual(rows);
  expect(JSON.stringify(plan.summary)).not.toMatch(/synopsis|movie|tv|keyword|language|tmdb|hash|library/);
});

test.each(['missing', 'identity', 'type', 'stale', 'future', 'malformed'])('%s observations are gaps; due gaps alternate with ordinary work', kind => {
  const { rows, snapshot, references } = fixture();
  for (const row of rows.slice(6)) {
    if (kind === 'missing') delete row.readiness_metadata.inventory_tmdb;
    if (kind === 'identity') row.readiness_metadata.inventory_tmdb.tmdb_id++;
    if (kind === 'type') row.readiness_metadata.inventory_tmdb.media_type = 'movie';
    if (kind === 'stale') row.inventory_tmdb_fetched_at = '2026-08-01T00:00:00Z';
    if (kind === 'future') row.inventory_tmdb_fetched_at = '2026-09-20T00:00:00Z';
    if (kind === 'malformed') row.readiness_metadata.inventory_tmdb.keywords = [' PRIVATE\nTOKEN '];
  }
  snapshot.observationReadiness = collectInventoryObservationReadiness(rows);
  const plan = buildInventoryGroupReadiness(snapshot, references);
  expect(plan.summary).toMatchObject({ groupsWithCurrentObservations: 1, groupsWithObservationGaps: 1 });
  expect(orderInventoryReadinessRefill(rows, plan.targets).map(row => row.id)).toEqual([7, 1, 8, 2, 9, 3, 10, 4, 11, 5, 12, 6]);
  expect(new Set(orderInventoryReadinessRefill(rows, plan.targets))).toEqual(new Set(rows));
});

test('current data, retry cooldown, identity/type/library/text change, inactive source and missing clock cannot use old hints', () => {
  const { rows, snapshot, references } = fixture();
  rows.slice(6).forEach(row => { row.inventory_tmdb_fetched_at = '2026-08-01T00:00:00Z'; });
  snapshot.observationReadiness = collectInventoryObservationReadiness(rows);
  const { targets } = buildInventoryGroupReadiness(snapshot, references);
  const changes = [row => { row.inventory_tmdb_fetched_at = checked; },
    row => { row.inventory_tmdb_attempted_at = checked; }, row => { row.tmdb_id = 99; },
    row => { row.media_type = 'movie'; }, row => { row.library_id = 1; },
    row => { row.metadata.overview = 'Changed synopsis'; }, row => { row.metadata = {}; },
    row => { row.source_library_active = false; }, row => { row.inventory_tmdb_checked_at = null; }];
  for (const change of changes) {
    const candidate = structuredClone(rows[6]); change(candidate);
    expect(orderInventoryReadinessRefill([rows[0], candidate], targets)).toEqual([rows[0], candidate]);
  }
  const summaryOnly = structuredClone(rows[6]); summaryOnly.metadata.summary = summaryOnly.metadata.overview;
  summaryOnly.metadata.overview = '  ';
  expect(orderInventoryReadinessRefill([rows[0], summaryOnly], targets)).toEqual([summaryOnly, rows[0]]);
});

test('missing status, invalid clocks and conflicting duplicate rows are unknown, not fresh or priority gaps', () => {
  const { rows, snapshot, references } = fixture();
  rows[0].inventory_tmdb_checked_at = undefined;
  const duplicate = structuredClone(rows[7]); duplicate.inventory_tmdb_fetched_at = null;
  snapshot.observationReadiness = collectInventoryObservationReadiness([...rows, duplicate]);
  const plan = buildInventoryGroupReadiness(snapshot, references);
  expect(plan.summary.groupsWithUnknownObservations).toBe(2);
  expect(plan.targets.size).toBe(0);
  delete snapshot.observationReadiness;
  expect(buildInventoryGroupReadiness(snapshot, references).summary.groupsWithUnknownObservations).toBe(2);
  rows[0].inventory_tmdb_checked_at = checked;
  rows[0].readiness_metadata = null; // Oversized SQL projection is unknown, not a repair target.
  expect(collectInventoryObservationReadiness(rows).get('movie:1:1')).toBe('unknown');
});

test('readiness counts unique descriptions and retains explicit ungrouped coverage', () => {
  const { rows, snapshot, references } = fixture();
  const duplicate = { ...rows[0], tmdb_id: 99 };
  snapshot.corpus = corpusOf([...rows, duplicate,
    { ...rows[0], tmdb_id: 100, overview: '' }, { ...rows[0], tmdb_id: 101 }, { ...rows[0], tmdb_id: 101, overview: 'Different' }]);
  snapshot.observationReadiness = collectInventoryObservationReadiness([...rows, duplicate]);
  const plan = buildInventoryGroupReadiness(snapshot, references);
  expect(plan.summary).toMatchObject({ groups: 2, groupsWithObservationGaps: 1,
    missingDescriptionIdentities: 1, conflictingDescriptionIdentities: 1 });
  expect(plan.targets.size).toBe(1);
});

test('lowest group coverage comes first without dropping ordinary rows; inputs stay unchanged', () => {
  const { rows, snapshot, references } = fixture();
  const pending = [rows[0], ...rows.slice(6)];
  pending.forEach(row => { row.inventory_tmdb_fetched_at = null; });
  snapshot.observationReadiness = collectInventoryObservationReadiness(rows);
  const { targets } = buildInventoryGroupReadiness(snapshot, references), before = structuredClone(rows);
  const result = orderInventoryReadinessRefill(rows, targets);
  expect(result.slice(0, 4).map(row => row.id)).toEqual([7, 2, 8, 3]);
  expect(result.at(-1).id).toBe(1);
  expect(rows).toEqual(before);
  expect(() => orderInventoryReadinessRefill(Array(5001), targets)).toThrow('budget');
  expect(() => collectInventoryObservationReadiness(Array(50001))).toThrow('budget');
  expect(() => collectInventoryObservationReadiness(null)).toThrow('budget');
});
