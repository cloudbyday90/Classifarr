/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { prepareClassificationRetrievalStudy } from '../../scripts/classificationRetrievalStudy.mjs';
import { resourceStudyEnvironment } from '../helpers/resourceStudyEnvironment.mjs';

const libraries = Array.from({ length: 4 }, (_, i) => ({ id: i + 1 }));
let saved, db;
beforeEach(() => {
  saved = process.env; process.env = { ...saved, ...resourceStudyEnvironment };
  db = { query: jest.fn(async sql => {
    if (sql.includes('populated')) return { rows: [{ n: 50000, populated: 0, first: 1, last: 50000 }] };
    if (sql.includes('format_type')) return { rows: [{ type: 'vector(1024)' }] };
    return { rows: [] };
  }) };
});
afterEach(() => { process.env = saved; });

test('preparation requires isolation and exactly the untouched synthetic cohort', async () => {
  delete process.env.CLASSIFARR_RESOURCE_STUDY;
  await expect(prepareClassificationRetrievalStudy(db, libraries)).rejects.toThrow();
  expect(db.query).not.toHaveBeenCalled();
  process.env.CLASSIFARR_RESOURCE_STUDY = resourceStudyEnvironment.CLASSIFARR_RESOURCE_STUDY;
  db.query.mockResolvedValueOnce({ rows: [{ n: 50000, populated: 1, first: 1, last: 50000 }] });
  await expect(prepareClassificationRetrievalStudy(db, libraries)).rejects.toThrow();
  expect(db.query).toHaveBeenCalledTimes(1);
});

test('bounded preparation, separate profiling and production reads yield truthful aggregates', async () => {
  const session = await prepareClassificationRetrievalStudy(db, libraries);
  const updates = db.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE classification_embeddings'));
  expect(updates).toHaveLength(500);
  expect(updates[0][1]).toEqual([1, 100]); expect(updates.at(-1)[1]).toEqual([49901, 50000]);
  const assignments = db.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE classification_history'));
  expect(assignments).toHaveLength(500); expect(assignments.at(-1)[1]).toEqual([[1, 2, 3, 4], 49901, 50000]);
  const rows = Array.from({ length: 5 }, (_, id) => ({ id, status: 'completed', text_similarity: 0.8,
    image_similarity: 0.5, combined_similarity: 0.71 }));
  const query = jest.fn(async sql => sql.startsWith('EXPLAIN') ? { rows: [{ 'QUERY PLAN': [{ 'Execution Time': 1,
    Plan: { 'Node Type': 'Limit', 'Actual Rows': 50, 'Shared Hit Blocks': 2, 'Shared Read Blocks': 0 } }] }] } : { rows });
  const reader = session({ query });
  await reader.measurePlan();
  for (let n = 0; n < 40; n++) await reader.retrieve();
  expect(reader.receipt()).toMatchObject({ queries: 40, imageScoredRows: 200, statusPreserved: true, weightedScoresVerified: true });
  expect(query.mock.calls.filter(([sql]) => sql === 'BEGIN READ ONLY')).toHaveLength(41);
  expect(query.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(41);
  expect(query.mock.calls.filter(([sql]) => sql.startsWith('EXPLAIN'))).toHaveLength(1);
});

test('failed reads roll back and cannot count as successful evidence', async () => {
  const session = await prepareClassificationRetrievalStudy(db, libraries);
  const query = jest.fn(async sql => {
    if (sql.includes('WITH candidates')) throw new Error('query_failed');
    return { rows: [] };
  });
  const reader = session({ query });
  await expect(reader.retrieve()).rejects.toThrow('query_failed');
  expect(query).toHaveBeenLastCalledWith('ROLLBACK'); expect(reader.receipt().queries).toBe(0);
});

test.each(['status', 'image_similarity', 'combined_similarity'])('invalid %s does not certify retrieval', async key => {
  const session = await prepareClassificationRetrievalStudy(db, libraries);
  const row = { status: 'completed', text_similarity: 0.8, image_similarity: 0.5, combined_similarity: 0.71, [key]: null };
  const reader = session({ query: async () => ({ rows: Array(5).fill(row) }) });
  await expect(reader.retrieve()).rejects.toThrow(); expect(reader.receipt().queries).toBe(0);
});
