/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { enrichWithOmdb } from '../services/enrichmentRetryOmdb.mjs';
import { enrichWithWebSearch } from '../services/enrichmentRetryWebSearch.mjs';
import { WebSearchProviderRoutingError } from '../services/webSearchProviderRouter.mjs';
import { retrySchedule } from '../services/enrichmentRetrySchedulePolicy.mjs';
const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
const item = { queue_id: 1, media_item_id: 2, title: 'Fixture', year: 2026, media_type: 'movie', imdb_id: 'tt0000001' };
test.each(['OMDB_AUTHENTICATION', 'OMDB_ACCESS_DENIED'])('OMDb %s is a provider wait without title fallback', async code => {
  const omdbService = { getByIMDBId: jest.fn().mockRejectedValue({ code }), getByTitle: jest.fn() };
  const result = await enrichWithOmdb({ omdbService, logger }, item);
  expect(result.credentialsRejected).toBe(true);
  expect(retrySchedule(result, 2).chargeAttempt).toBe(false);
  expect(omdbService.getByTitle).not.toHaveBeenCalled();
});
test.each(['auth_failed', 'forbidden'])('routed web %s is a provider wait without spending attempts', async code => {
  const failure = new WebSearchProviderRoutingError('Unavailable', [], {
    attempts: [{ providerKey: 'brave', outcome: 'failed', errorCode: code }], lastError: { provider: 'brave', code },
  });
  const result = await enrichWithWebSearch({ logger, webSearchEnrichmentService: { search: jest.fn().mockRejectedValue(failure) } }, item);
  expect(result.credentialsRejected).toBe(true);
  expect(retrySchedule(result, 2).chargeAttempt).toBe(false);
});
