/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { tmdbObservationFailure, wrapTmdbDetailsFailure } from '../services/tmdbObservationFailure.mjs';
import { QueueInventoryTmdbEnrichmentService } from '../services/queueInventoryTmdbEnrichmentService.mjs';

test.each([[404, 'not_found'], [401, 'authentication'], [403, 'authentication'], [429, 'rate_limited'],
  [500, 'upstream_error'], [503, 'upstream_error'], [400, 'request_rejected']])
('preserves HTTP %i without leaking provider data', async (status, category) => {
  const original = Object.assign(new Error('private URL?api_key=secret'), { response: { status, data: 'private', headers: { token: 'secret' } } });
  const error = wrapTmdbDetailsFailure(original);
  expect(error.message).toBe('TMDb details are unavailable');
  expect(error.cause).toBeUndefined();
  expect(error.response).toEqual({ status });
  expect(tmdbObservationFailure(error)).toEqual({ category, httpStatus: status, transportCode: null });
  const logger = { warn: jest.fn() }, data = { inventory_tmdb: { prior: true } };
  const service = new QueueInventoryTmdbEnrichmentService({ logger, tmdbService: {
    getApiKey: async () => 'fixture', getMovieDetails: async () => { throw error; },
  } });
  expect(await service.enrich({ media: { media_type: 'movie' } }, data, 7)).toBe(true);
  expect(data).toEqual({ inventory_tmdb: { prior: true } });
  expect(logger.warn).toHaveBeenCalledWith('Inventory TMDb observation unavailable', {
    reason: status === 404 ? 'identity_not_found' : 'provider_unavailable', category, httpStatus: status,
    transportCode: null, mediaType: 'movie', tmdbId: 7,
  });
  expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(/private|secret/);
});
test.each([['ETIMEDOUT', 'timeout'], ['ECONNREFUSED', 'network'], ['ENOTFOUND', 'network'],
  ['CERT_HAS_EXPIRED', 'tls'], ['ABORT_ERR', 'cancelled'], ['HTTP_RESPONSE_TOO_LARGE', 'response_too_large'],
  ['private-secret', 'unknown']])('classifies bounded transport metadata: %s', (code, category) => {
  const error = wrapTmdbDetailsFailure(Object.assign(new Error('private'), { code }));
  expect(tmdbObservationFailure(error).category).toBe(category);
  expect(JSON.stringify(error)).not.toContain('private');
});
