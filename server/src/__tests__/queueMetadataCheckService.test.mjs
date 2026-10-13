/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createQueueMetadataCheckService } from '../services/queueMetadataCheckService.mjs';

let task, actor, provider, db, readProvider, service;
beforeEach(() => {
  task = { id: '23', revision: '1', task_type: 'classification', status: 'failed',
    current_stage: 'metadata_fetch', error_message: 'task_metadata_not_found',
    claim_token: null, routing_classification_id: null, tmdb_id: '42', media_type: 'movie' };
  actor = { role: 'admin', is_active: true };
  provider = { revision: 'config-one', configured: true,
    getDetails: jest.fn().mockResolvedValue({ id: 42, title: 'Verified record', private: 'not returned' }) };
  db = { query: jest.fn(async sql => ({ rows: sql.includes('FROM users') ? [actor] : task ? [{ ...task }] : [] })) };
  readProvider = jest.fn(async () => ({ ...provider }));
  service = createQueueMetadataCheckService({ db, readProvider, now: () => new Date('2026-10-13T12:00:00Z') });
});
const check = () => service.check(7, '23', {});

describe('failed task metadata check', () => {
  test('checks the saved typed ID once, does not write, and only projects safe evidence', async () => {
    const result = await check();
    expect(result).toMatchObject({ taskId: '23', tmdbId: 42, mediaType: 'movie',
      checkedAt: '2026-10-13T12:00:00.000Z', observation: { category: 'available', httpStatus: 200 } });
    expect(provider.getDetails).toHaveBeenCalledWith(42, 'movie', expect.any(AbortSignal));
    expect(provider.getDetails).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/private|config-one|revision/);
    expect(result.candidate).toEqual({ tmdbId: 42, mediaType: 'movie', title: 'Verified record',
      originalTitle: null, releaseDate: null, overview: null });
  });
  test('does not confuse the movie and TV namespaces', async () => {
    task.media_type = 'tv';
    provider.getDetails.mockResolvedValue({ id: 42, name: 'TV fixture' });
    expect((await check()).candidate.mediaType).toBe('tv');
    expect(provider.getDetails).toHaveBeenCalledWith(42, 'tv', expect.any(AbortSignal));
  });
  test.each([
    [404, 'not_found'], [401, 'authentication'], [403, 'authentication'],
    [429, 'rate_limited'], [503, 'upstream_error'], [400, 'request_rejected'],
  ])('projects HTTP %s without leaking the upstream error', async (status, category) => {
    provider.getDetails.mockRejectedValue(Object.assign(new Error('secret-url'), {
      response: { status, data: 'private-body', headers: { 'retry-after': '3', secret: 'private' } },
    }));
    const result = await check();
    expect(result.observation).toMatchObject({ category, httpStatus: status });
    expect(JSON.stringify(result)).not.toMatch(/private|secret/);
    expect(result.candidate).toBeNull();
  });
  test.each(['ETIMEDOUT', 'ECONNRESET', 'CERT_HAS_EXPIRED', 'HTTP_RESPONSE_TOO_LARGE'])('keeps allowlisted transport context %s', async code => {
    provider.getDetails.mockRejectedValue({ code });
    expect((await check()).observation.transportCode).toBe(code);
  });
  test.each([null, {}, { id: 43, title: 'Wrong ID' }, { id: 42, title: 'Wrong type', media_type: 'tv' }])('rejects invalid successful evidence %j', async data => {
    provider.getDetails.mockResolvedValue(data);
    expect((await check()).observation.category).toBe('invalid_response');
  });
  test('unknown exceptions stay unknown; old failures are not relabeled', async () => {
    task.error_message = 'task_processing_failed';
    provider.getDetails.mockRejectedValue(new Error('secret'));
    expect(await check()).toMatchObject({ savedFailure: 'task_processing_failed', observation: { category: 'unknown' } });
    expect(task.error_message).toBe('task_processing_failed');
  });
  test('a missing configuration never calls TMDb', async () => {
    provider.configured = false;
    expect((await check()).observation.category).toBe('not_configured');
    expect(provider.getDetails).not.toHaveBeenCalled();
  });
  test.each([200, 401, 429, 503])('only original 404 admits external-ID lookup, not %s', async status => {
    task.task_imdb_id = 'tt123';
    provider.findByExternalId = jest.fn();
    if (status !== 200) provider.getDetails.mockRejectedValue({ response: { status } });
    expect((await check()).identityEvidence).toBeNull();
    expect(provider.findByExternalId).not.toHaveBeenCalled();
  });
  test.each(['source_revision', 'source_id', 'revision', 'config', 'actor'])('rejects %s changes during candidate reads', async kind => {
    Object.assign(task, { task_imdb_id: 'tt123', webhook_log_id: 9, source_id: 9,
      source_revision: '1', source_tmdb_id: 42, source_media_type: 'movie' });
    provider.getDetails.mockRejectedValueOnce({ response: { status: 404 } }).mockResolvedValue({ id: 99, title: 'Candidate' });
    provider.findByExternalId = jest.fn().mockResolvedValue({ movie_results: [{ id: 99 }] });
    provider.getExternalIds = jest.fn(async () => {
      if (kind === 'config') provider.revision = 'changed';
      else if (kind === 'actor') actor.is_active = false;
      else task[kind] = kind === 'source_id' ? null : 'changed';
      return { id: 99, imdb_id: 'tt123' };
    });
    await expect(check()).rejects.toMatchObject({ statusCode: kind === 'actor' ? 403 : 409 });
  });
  test.each([{ status: 'processing' }, { status: 'completed' }, { current_stage: 'decision' },
    { claim_token: 'owned' }, { routing_classification_id: 9 }, { error_message: 'another_failure' },
    { task_type: 'enrichment' }, { media_type: 'person' }])('rejects ineligible source %j before I/O', async patch => {
    Object.assign(task, patch);
    await expect(check()).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.getDetails).not.toHaveBeenCalled();
  });
  test.each([null, '0', '-1', '42x', '2147483648'])('rejects invalid provider ID %j', async id => {
    task.tmdb_id = id;
    await expect(check()).rejects.toMatchObject({ statusCode: 400 });
    expect(provider.getDetails).not.toHaveBeenCalled();
  });
  test('missing task has no side effects', async () => {
    task = null;
    await expect(check()).rejects.toMatchObject({ statusCode: 404 });
  });
  test.each([null, [], { tmdbId: 99 }, { mediaType: 'tv' }, { actorId: 1 }, { url: 'http://private' }])('rejects caller overrides %j', async body => {
    await expect(service.check(7, '23', body)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.query).not.toHaveBeenCalled();
  });
  test.each(['0', '-1', '1.1', '1x', '9007199254740992'])('rejects invalid task ID %s', async id => {
    await expect(service.check(7, id, {})).rejects.toMatchObject({ statusCode: 400 });
  });
  test.each(['revision', 'config', 'actor', 'claimed', 'removed'])('rejects %s changes during I/O', async kind => {
    provider.getDetails.mockImplementation(async () => {
      if (kind === 'revision') task.revision = '2';
      if (kind === 'config') provider.revision = 'config-two';
      if (kind === 'actor') actor.role = 'user';
      if (kind === 'claimed') task.claim_token = 'claim';
      if (kind === 'removed') task = null;
      return { id: 42, title: 'Fresh result' };
    });
    await expect(check()).rejects.toMatchObject({ statusCode: kind === 'actor' ? 403 : kind === 'removed' ? 404 : 409 });
  });
  test('rejects inactive actors before checking', async () => {
    actor.is_active = false;
    await expect(check()).rejects.toMatchObject({ statusCode: 403 });
    expect(provider.getDetails).not.toHaveBeenCalled();
  });
  test('bounds concurrent work and releases admission after completion', async () => {
    let finish;
    const started = new Promise(resolve => { provider.getDetails.mockImplementation(() => {
      resolve(); return new Promise(done => { finish = done; });
    }); });
    const first = check();
    await started;
    await expect(check()).rejects.toMatchObject({ statusCode: 409 });
    finish({ id: 42, title: 'First' });
    await first;
    provider.getDetails.mockResolvedValue({ id: 42, title: 'Next' });
    expect((await check()).observation.category).toBe('available');
  });
  test('aborts provider work on deadline and reports timeout', async () => {
    service = createQueueMetadataCheckService({ db, readProvider, deadlineMs: 15 });
    provider.getDetails.mockImplementation((_id, _type, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    expect((await check()).observation.category).toBe('timeout');
  });
  test('caller cancellation discards the result and permits a subsequent check', async () => {
    const controller = new AbortController();
    provider.getDetails.mockImplementation(async () => { controller.abort(); return { id: 42, title: 'Late' }; });
    await expect(service.check(7, '23', {}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    provider.configured = false;
    expect((await check()).observation.category).toBe('not_configured');
  });
});
