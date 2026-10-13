/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { readQueueIdentityEvidence } from '../services/queueIdentityEvidenceService.mjs';

let task, provider, controller, deadline;
beforeEach(() => {
  task = { tmdb_id: '42', media_type: 'tv', task_imdb_id: 'tt123', task_tvdb_id: 7 };
  provider = {
    findByExternalId: jest.fn().mockResolvedValue({ tv_results: [{ id: 99 }], movie_results: [{ id: 88 }] }),
    getDetails: jest.fn().mockResolvedValue({ id: 99, name: 'Candidate', private: 'secret' }),
    getExternalIds: jest.fn().mockResolvedValue({ id: 99, imdb_id: 'tt123', tvdb_id: 7, private: 'secret' }),
  };
  controller = new AbortController(); deadline = new AbortController();
});
const read = () => readQueueIdentityEvidence(task, provider, {
  signal: AbortSignal.any([controller.signal, deadline.signal]), deadline: deadline.signal, callerSignal: controller.signal,
});

test('all saved IDs, typed details and reverse IDs must agree; source data is not exported', async () => {
  const result = await read();
  expect(result).toMatchObject({ reason: 'candidate_for_review', candidate: { tmdbId: 99, mediaType: 'tv', title: 'Candidate' },
    sources: ['imdb_id', 'tvdb_id'] });
  expect(provider.findByExternalId.mock.calls.map(call => call.slice(0, 2))).toEqual([['tt123', 'imdb_id'], [7, 'tvdb_id']]);
  expect(provider.getDetails).toHaveBeenCalledWith(99, 'tv', expect.any(AbortSignal));
  expect(provider.getExternalIds).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result)).not.toMatch(/secret|tt123|revision/);
});
test('movie lookup ignores TV results and unsupported TVDB evidence', async () => {
  task.media_type = 'movie';
  provider.findByExternalId.mockResolvedValue({ movie_results: [{ id: 99 }], tv_results: [{ id: 88 }] });
  provider.getDetails.mockResolvedValue({ id: 99, title: 'Movie' });
  expect((await read()).candidate.mediaType).toBe('movie');
  expect(provider.findByExternalId).toHaveBeenCalledTimes(1);
});
test('no supported saved IDs means no additional I/O', async () => {
  task.task_imdb_id = null; task.task_tvdb_id = null;
  expect((await read()).reason).toBe('external_ids_missing');
  expect(provider.findByExternalId).not.toHaveBeenCalled();
});
test.each([
  [null, 'invalid_response'], [{ movie_results: [{ id: 99 }] }, 'invalid_response'],
  [{ tv_results: [] }, 'external_id_not_found'],
  [{ tv_results: [{ id: 99 }, { id: 100 }] }, 'ambiguous_external_id'],
  [{ tv_results: [{ id: 99 }, { id: 99 }] }, 'duplicate_external_results'],
  [{ tv_results: [{ id: 99 }, { id: 'invalid' }] }, 'invalid_response'],
  [{ tv_results: [{ id: 99, media_type: 'movie' }] }, 'invalid_response'],
  [{ tv_results: Array.from({ length: 21 }, (_, i) => ({ id: i + 1 })) }, 'external_result_limit'],
])('rejects %j without fetching candidate details', async (data, reason) => {
  provider.findByExternalId.mockResolvedValue(data);
  expect(await read()).toMatchObject({ reason, candidate: null });
  expect(provider.getDetails).not.toHaveBeenCalled();
});
test.each([
  [{ tv_results: [] }, 'external_id_not_found'],
  [{ tv_results: [{ id: 100 }] }, 'conflicting_external_ids'],
])('one successful lookup is not enough when the second disagrees', async (data, reason) => {
  provider.findByExternalId.mockResolvedValueOnce({ tv_results: [{ id: 99 }] }).mockResolvedValueOnce(data);
  expect((await read()).reason).toBe(reason);
  expect(provider.getDetails).not.toHaveBeenCalled();
});
test('does not treat the original missing ID as a replacement', async () => {
  provider.findByExternalId.mockResolvedValue({ tv_results: [{ id: 42 }] });
  expect((await read()).reason).toBe('original_id_only');
  expect(provider.getDetails).not.toHaveBeenCalled();
});
test.each([null, [], { id: '99' }, { id: 100 }])('rejects invalid reverse response %j', async data => {
  provider.getExternalIds.mockResolvedValue(data);
  expect(await read()).toMatchObject({ reason: 'invalid_response', candidate: null });
});
test.each([{ id: 99, imdb_id: 'tt123' }, { id: 99, imdb_id: 'tt456', tvdb_id: 7 }])('rejects incomplete/disagreeing reverse IDs %j', async data => {
  provider.getExternalIds.mockResolvedValue(data);
  expect(await read()).toMatchObject({ reason: 'reverse_id_conflict', candidate: null });
});
test('invalid candidate details prevent reverse lookup', async () => {
  provider.getDetails.mockResolvedValue({ id: 100, name: 'Wrong' });
  expect(await read()).toMatchObject({ reason: 'provider_unavailable', observation: { category: 'invalid_response' } });
  expect(provider.getExternalIds).not.toHaveBeenCalled();
});
test.each(['findByExternalId', 'getDetails', 'getExternalIds'])('sanitizes provider errors at %s and discards partial candidates', async method => {
  provider[method].mockRejectedValue(Object.assign(new Error('private credential'), { response: { status: 429, data: 'secret' } }));
  const result = await read();
  expect(result).toMatchObject({ reason: 'provider_unavailable', candidate: null, observation: { category: 'rate_limited' } });
  expect(JSON.stringify(result)).not.toMatch(/private|secret/);
});
test('unknown exceptions retain a bounded unknown outcome', async () => {
  provider.findByExternalId.mockRejectedValue(new Error('private'));
  expect((await read()).observation.category).toBe('unknown');
});
test('deadline during follow-up stops remaining reads', async () => {
  provider.findByExternalId.mockImplementation(async () => { deadline.abort(); return { tv_results: [{ id: 99 }] }; });
  expect(await read()).toMatchObject({ candidate: null, observation: { category: 'timeout' } });
  expect(provider.findByExternalId).toHaveBeenCalledTimes(1);
  expect(provider.getDetails).not.toHaveBeenCalled();
});
test('caller cancellation propagates and discards evidence', async () => {
  provider.getExternalIds.mockImplementation(async () => { controller.abort(); throw new Error('private'); });
  await expect(read()).rejects.toMatchObject({ name: 'AbortError' });
});
