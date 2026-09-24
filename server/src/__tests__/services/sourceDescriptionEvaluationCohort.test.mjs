/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { groupSourceDescriptionEvidence, prepareSourceDescriptionEvaluationCohort } from '../../services/sourceDescriptionEvaluationCohort.mjs';
import { sourcePairFixture, sourcePairSnapshot } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { inventorySourceDescriptionKey } from '../../services/inventorySourceDescriptionIdentity.mjs';

const options = { seed: 'source-pair-test-seed', size: 16 };
test('transitive aliases, conflicting descriptions, and exact synopsis copies are held as one group', () => {
  const { libraries, rows } = sourcePairFixture(6);
  rows.forEach(row => { row.media_type = 'movie'; row.library_id = 1; });
  rows[0].imdb_id = 'tt1'; rows[1].imdb_id = 'tt1'; rows[1].tvdb_id = 10;
  rows[2].tvdb_id = 10; rows[3].overview = rows[2].overview;
  rows[4].media_server_id = rows[3].media_server_id; rows[4].external_id = rows[3].external_id;
  rows.push({ ...rows[1], overview: 'A conflicting synopsis still links the group' });
  const { groupByKey, hashesByGroup } = groupSourceDescriptionEvidence(rows);
  const group = groupByKey.get('movie:1');
  for (const row of rows.slice(0, 5)) expect(groupByKey.get(inventorySourceDescriptionKey(row))).toBe(group);
  expect(groupByKey.get(inventorySourceDescriptionKey(rows[5]))).not.toBe(group);
  expect(hashesByGroup.get(group).size).toBe(5);
  const source = sourcePairSnapshot(rows, libraries.slice(0, 2));
  const cohort = prepareSourceDescriptionEvaluationCohort(source, options);
  expect(cohort.sample).toHaveLength(2);
  expect(cohort.trainingExcludedHashes.size).toBe(6);
});

test('IMDb/TVDB aliases are typed and scoped source anchors do not merge unrelated servers', () => {
  const { rows } = sourcePairFixture(3);
  rows[0].imdb_id = rows[1].imdb_id = 'tt99'; rows[0].media_type = 'movie'; rows[1].media_type = 'tv';
  rows[2] = { ...rows[0], tmdb_id: null, media_server_id: 2, imdb_id: null, overview: 'Another description' };
  expect(groupSourceDescriptionEvidence(rows).hashesByGroup.size).toBe(3);
});

test('300 unique groups are deterministically balanced across movie/TV, library and source strata', () => {
  const source = sourcePairFixture(800);
  const a = prepareSourceDescriptionEvaluationCohort(source, { ...options, size: 300 });
  const b = prepareSourceDescriptionEvaluationCohort({ ...source, rows: [...source.rows].reverse(),
    corpus: { ...source.corpus, documents: [...source.corpus.documents].reverse() } }, { ...options, size: 300 });
  expect(a.sample.map(doc => doc.key)).toEqual(b.sample.map(doc => doc.key));
  expect(a.sample).toHaveLength(300);
  expect(new Set(a.sample.map(doc => `${doc.type}:${doc.libraryIds[0]}:${doc.id === null}`)).size).toBe(8);
  expect(new Set(a.sample.map(doc => doc.hash)).size).toBe(300);
});

test('conflicting feedback removes quality labels, and even unsampled feedback groups never train', () => {
  const source = sourcePairFixture(48);
  source.rows[1].imdb_id = source.rows[0].imdb_id = 'tt11';
  source.operatorFeedbackRows = [1, 2].map(id => ({ media_type: 'movie', tmdb_id: id,
    selected_library_id: id, was_correction: true, origin: 'manual_correction' }));
  const cohort = prepareSourceDescriptionEvaluationCohort(source, { ...options, size: 1 });
  expect(cohort.corrections.size).toBe(0);
  expect(cohort.coverage.conflictingFeedbackGroups).toBe(1);
  for (const doc of source.corpus.documents.filter(doc => [1, 2].includes(doc.id))) expect(cohort.trainingExcludedHashes.has(doc.hash)).toBe(true);
});

test('existing unambiguous corrections are prioritized within a stratum without replacing movie/TV or source coverage', () => {
  const source = sourcePairFixture(80);
  const row = source.rows[72];
  source.operatorFeedbackRows = [{ media_type: row.media_type, tmdb_id: row.tmdb_id,
    selected_library_id: row.library_id, was_correction: true }];
  const result = prepareSourceDescriptionEvaluationCohort(source, { ...options, size: 8 });
  expect(result.sample.some(doc => doc.key === `${row.media_type}:${row.tmdb_id}`)).toBe(true);
  expect(new Set(result.sample.map(doc => `${doc.type}:${doc.libraryIds[0]}:${doc.id === null}`)).size).toBe(8);
});

test.each([{ media_type: 'music', tmdb_id: 1 }, { media_type: 'movie', tmdb_id: -1 },
  { media_type: 'movie', tmdb_id: null, external_id: '' }])('unsupported or malformed evidence fails closed: %j', row => {
  expect(() => groupSourceDescriptionEvidence([row])).toThrow();
});
test('bounded grouping rejects oversize input', () => {
  expect(() => groupSourceDescriptionEvidence(Array(50001).fill({}))).toThrow('row_budget');
});
