/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { classifyFixture, readClassificationFixture, waitForClassificationFixture } from '../../scripts/embeddedIsolationDrill/classificationFixture.mjs';

const rows = () => [
  { id: '1', title: 'Isolation movie', media_type: 'movie', method: 'source_library', status: 'completed',
    confidence: 100, external_id: 'isolation-classification-movie', routing: 'threshold_not_met' },
  { id: '2', title: 'Isolation series', media_type: 'tv', method: 'source_library', status: 'completed',
    confidence: 100, external_id: 'isolation-classification-tv', routing: 'threshold_not_met' },
];

test.each([{ libraries: 1, history: 0, embeddings: false }, { libraries: 0, history: 1, embeddings: false },
  { libraries: 0, history: 0, embeddings: true }])('non-empty/provider-enabled state cannot be used: %j', async state => {
  const database = { query: jest.fn(async () => ({ rows: [state] })) }, service = { classify: jest.fn() };
  await expect(classifyFixture(database, service)).rejects.toThrow('classification_fixture_requires_empty_state');
  expect(database.query).toHaveBeenCalledTimes(1);
  expect(service.classify).not.toHaveBeenCalled();
});

test('fixture uses parameterized synthetic libraries and both real-service input contracts', async () => {
  const database = { query: jest.fn().mockResolvedValueOnce({ rows: [{ libraries: 0, history: 0, embeddings: false }] })
    .mockResolvedValueOnce({ rows: [{ id: 10, name: 'Isolation movie' }] })
    .mockResolvedValueOnce({ rows: [{ id: 11, name: 'Isolation series' }] }) };
  const service = { classify: jest.fn(async () => ({ success: true, method: 'source_library', routingOutcome: { shouldRoute: false } })) };
  await classifyFixture(database, service);
  expect(service.classify.mock.calls.map(([input]) => [input.media_type, input.source_library_id])).toEqual([['movie', 10], ['tv', 11]]);
  for (const [input] of service.classify.mock.calls) {
    expect(input.overview).toBeTruthy(); expect(input.genres).toEqual(['Drama']);
    expect(input).not.toHaveProperty('tmdb_id'); expect(input).not.toHaveProperty('itemId');
  }
  expect(database.query.mock.calls[1][0]).toContain('VALUES ($1, $2, $3)');
});

test.each([{ success: false }, { success: true, method: 'fallback' },
  { success: true, method: 'source_library', routingOutcome: { shouldRoute: true } }])('wrong classification result is not a passing fixture: %j', async result => {
  const database = { query: jest.fn().mockResolvedValueOnce({ rows: [{ libraries: 0, history: 0, embeddings: false }] })
    .mockResolvedValue({ rows: [{ id: 1, name: 'Isolation movie' }] }) };
  await expect(classifyFixture(database, { classify: async () => result })).rejects.toThrow();
});

test('reads verify exact persistence without replaying a classification', async () => {
  const database = { query: jest.fn(async () => ({ rows: rows() })) };
  expect(await readClassificationFixture(database)).toEqual(rows());
  expect(database.query.mock.calls[0][0].trim()).toMatch(/^SELECT/);
});

test.each(['duplicate', 'wrong-library', 'wrong-method', 'routed', 'wrong-type', 'invalid-id'])('%s result is rejected', async scenario => {
  const data = rows();
  if (scenario === 'duplicate') data.push(data[0]);
  if (scenario === 'wrong-library') data[0].external_id = 'other';
  if (scenario === 'wrong-method') data[0].method = 'fallback';
  if (scenario === 'routed') data[0].routing = 'routed';
  if (scenario === 'wrong-type') data[0].media_type = 'tv';
  if (scenario === 'invalid-id') data[0].id = '0';
  await expect(readClassificationFixture({ query: async () => ({ rows: data }) })).rejects.toThrow();
});

test('pending or partially persisted decisions wait within deadline, never reissue writes', async () => {
  const pending = rows(); pending[1].routing = null;
  const database = { query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: pending })
    .mockResolvedValue({ rows: rows() }) };
  const wait = jest.fn(async () => {});
  expect(await waitForClassificationFixture(database, { wait })).toEqual(rows());
  expect(wait).toHaveBeenCalledTimes(2);
  let time = 0;
  await expect(waitForClassificationFixture({ query: async () => ({ rows: [] }) },
    { now: () => time++, timeout: 2, wait })).rejects.toThrow('classification_fixture_timeout');
  await expect(waitForClassificationFixture({ query: async () => { throw new Error('permission denied'); } }))
    .rejects.toThrow('permission denied');
});
