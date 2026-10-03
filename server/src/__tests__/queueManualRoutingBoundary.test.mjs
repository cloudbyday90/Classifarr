/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { QueueAdminService } from '../services/queueAdminService.mjs';
import { normalizeManualRoutingOutcome, MANUAL_ROUTING_MESSAGE } from '../services/queueManualRoutingOutcome.mjs';

const verified = { attempted: true, routed: true, reason: 'routed', arrType: 'radarr', error: null };
function fixture({ task = {}, library = {}, outcome = verified } = {}) {
  const query = jest.fn().mockResolvedValueOnce({ rows: [{ id: 12, task_type: 'classification', status: 'pending',
    payload: { media: { title: 'Fixture', tmdb_id: 42, media_type: 'movie', classification_details: {
      routing: 'routed', routing_error: 'private', manual_routing_attempt_id: 'forged',
      manual_routing_intent: { version: 1 }, manual_routing_observation: { reason: 'verified_present' },
      outcome_link: { routing: { routed: true } }, outcome_path: { latest_type: 'verified' } } } }, ...task }] })
    .mockResolvedValueOnce({ rows: [{ id: 7, name: 'Movies', media_type: 'movie', ...library }] })
    .mockResolvedValueOnce({ rows: [{ id: 10 }] }).mockResolvedValueOnce({ rowCount: 1 });
  const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }), withTransaction: jest.fn(fn => fn({ query })) };
  const routeToArr = jest.fn().mockResolvedValue(outcome);
  const service = new QueueAdminService({ db, classificationService: { routeToArr }, ragGraphExtractor: { extract: () => ({}) } });
  return { service, db, query, routeToArr };
}

test('commit failure forbids provider I/O even if local SQL has run', async () => {
  const f = fixture();
  f.db.withTransaction.mockImplementation(async fn => { await fn({ query: f.query }); throw new Error('commit unknown'); });
  await expect(f.service.manualClassifyTask(12, 7)).rejects.toThrow('commit unknown');
  expect(f.routeToArr).not.toHaveBeenCalled(); expect(f.db.query).not.toHaveBeenCalled();
});

test.each(['reject', 'conflict'])('outcome persistence %s never causes a provider retry or false saved result', async failure => {
  const f = fixture();
  if (failure === 'reject') f.db.query.mockRejectedValueOnce(new Error('private database details'));
  else f.db.query.mockResolvedValueOnce({ rowCount: 0 });
  const result = await f.service.manualClassifyTask(12, 7);
  expect(result).toMatchObject({ success: true, routing: { routed: false, recorded: false }, message: MANUAL_ROUTING_MESSAGE });
  expect(JSON.stringify(result)).not.toContain('private');
  expect(f.routeToArr).toHaveBeenCalledTimes(1); expect(f.db.withTransaction).toHaveBeenCalledTimes(1);
});

test('unconfirmed marker and attempt token replace caller-provided routing claims', async () => {
  const f = fixture({ outcome: { attempted: true, routed: false, arrType: 'radarr', reason: 'arr_add_failed', error: 'private-key' } });
  const result = await f.service.manualClassifyTask(12, 7);
  const history = JSON.parse(f.query.mock.calls[2][1][9]);
  const details = history.classification_details;
  expect(details).toMatchObject({ routing: 'manual_routing_pending', routing_error: MANUAL_ROUTING_MESSAGE,
    candidate_capture: { status: 'not_applicable' } });
  expect(details.manual_routing_attempt_id).toMatch(/^[a-f\d-]{36}$/);
  expect(details.outcome_link).toBeUndefined(); expect(details.outcome_path).toBeUndefined();
  expect(details.manual_routing_intent).toBeUndefined(); expect(details.manual_routing_observation).toBeUndefined();
  expect(f.db.query.mock.calls[0][1]).toEqual(['arr_add_failed', MANUAL_ROUTING_MESSAGE, null, 10, 7,
    'manual_routing_pending', details.manual_routing_attempt_id]);
  expect(result.routing).toMatchObject({ routed: false, recorded: true, reason: 'arr_add_failed' });
  expect(JSON.stringify(result)).not.toContain('private-key');
});

test.each(['processing', 'completed', 'failed', 'cancelled'])('non-pending task %s cannot route', async status => {
  const f = fixture({ task: { status } });
  expect(await f.service.manualClassifyTask(12, 7)).toMatchObject({ success: false, code: 'invalid_state' });
  expect(f.routeToArr).not.toHaveBeenCalled(); expect(f.query).toHaveBeenCalledTimes(1);
});

test.each(['tv', 'music'])('movie selection refuses %s library', async media_type => {
  const f = fixture({ library: { media_type } });
  expect(await f.service.manualClassifyTask(12, 7)).toMatchObject({ success: false, code: 'invalid_media_type' });
  expect(f.routeToArr).not.toHaveBeenCalled(); expect(f.query).toHaveBeenCalledTimes(2);
});

test('wrong task type and inactive/missing library cannot route', async () => {
  const wrong = fixture({ task: { task_type: 'metadata_enrichment' } });
  expect(await wrong.service.manualClassifyTask(12, 7)).toMatchObject({ code: 'invalid_task_type' });
  expect(wrong.routeToArr).not.toHaveBeenCalled();
  const missing = fixture();
  missing.query.mockReset().mockResolvedValueOnce({ rows: [{ task_type: 'classification', status: 'pending' }] })
    .mockResolvedValueOnce({ rows: [] });
  expect(await missing.service.manualClassifyTask(12, 7)).toMatchObject({ code: 'library_not_found' });
  expect(missing.query.mock.calls[1][0]).toContain('is_active IS TRUE');
  expect(missing.routeToArr).not.toHaveBeenCalled();
});

test.each([null, undefined, {}, { ...verified, attempted: false }, { ...verified, arrType: 'private' },
  { ...verified, reason: 'private' }, { ...verified, routed: 'true' }])('unknown or malformed result cannot be success: %j', input => {
  expect(normalizeManualRoutingOutcome(input)).toMatchObject({ routed: false, error: MANUAL_ROUTING_MESSAGE });
});

test.each(['routed', 'already_in_arr'])('accepts verified %s only', reason => {
  expect(normalizeManualRoutingOutcome({ ...verified, reason })).toEqual({ ...verified, reason });
});

test('manual provider I/O runs only after selection commit and transaction release', async () => {
  let inTransaction = false;
  const query = jest.fn().mockResolvedValueOnce({ rows: [{ id: 12, task_type: 'classification', status: 'pending',
    payload: { media: { title: 'Fixture', tmdb_id: 42, media_type: 'movie' } } }] })
    .mockResolvedValueOnce({ rows: [{ id: 7, name: 'Movies', media_type: 'movie', is_active: true }] })
    .mockResolvedValueOnce({ rows: [{ id: 10 }] }).mockResolvedValueOnce({ rowCount: 1 });
  const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }),
    withTransaction: async fn => { inTransaction = true; try { return await fn({ query }); } finally { inTransaction = false; } } };
  const routeToArr = jest.fn(async () => {
    expect(inTransaction).toBe(false);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO classification_history'), expect.any(Array));
    return { attempted: true, routed: true, reason: 'routed', arrType: 'radarr', error: null };
  });
  const service = new QueueAdminService({ db, classificationService: { routeToArr },
    ragGraphExtractor: { extract: () => ({}) }, logger: { info: jest.fn(), warn: jest.fn() } });
  const result = await service.manualClassifyTask(12, 7);
  expect(routeToArr).toHaveBeenCalledTimes(1);
  expect(result.routing).toMatchObject({ routed: true, recorded: true });
});

test.each([true, false])('manual capture hook gates provider reconciliation, capture succeeds=%s', async saved => {
  const f = fixture();
  const providerReconciliation = jest.fn().mockResolvedValue(verified);
  f.db.query.mockResolvedValueOnce({ rowCount: saved ? 1 : 0 });
  f.routeToArr.mockImplementation(async (_metadata, _library, options) => {
    await options.beforeReconcile({ arrType: 'radarr', configId: 2, baseUrl: 'http://fixture',
      expected: { identityKey: 'tmdbId', identity: 42, rootFolderPath: '/movies' }, libraryFingerprint: 'a'.repeat(64) });
    return providerReconciliation();
  });
  const result = await f.service.manualClassifyTask(12, 7);
  expect(providerReconciliation).toHaveBeenCalledTimes(saved ? 1 : 0);
  expect(result.routing.routed).toBe(saved);
  expect(f.db.query.mock.calls[0][0]).toContain('manual_routing_intent');
});
