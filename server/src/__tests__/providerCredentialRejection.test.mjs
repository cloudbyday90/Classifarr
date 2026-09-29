/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { providerCredentialContext, rejectProviderCredential, isProviderCredentialRejection } from '../services/providerCredentialRejection.mjs';
import { retrySchedule } from '../services/enrichmentRetrySchedulePolicy.mjs';
import { maskProviderApiKey } from '../routes/helpers/providerConfigHelpers.mjs';
const generation = 'fd276191-258e-4767-9f2e-5f1c833c5c7f';
test.each(['omdb', 'web_search', 'legacy_tavily'])('scopes %s rejection to a fixed table and exact generation', async source => {
  const context = providerCredentialContext(source, { id: 7, credential_generation: generation, api_key: 'private-fixture' });
  expect(context).toEqual({ source, id: 7, generation }); expect(Object.isFrozen(context)).toBe(true);
  const db = { query: jest.fn().mockResolvedValue({ rows: [{ id: 7 }] }) };
  expect(await rejectProviderCredential(db, context)).toBe(true);
  expect(db.query.mock.calls[0][1]).toEqual([7, generation]);
  expect(db.query.mock.calls[0][0]).toContain('credential_generation = $2::uuid');
  db.query.mockResolvedValue({ rows: [] }); expect(await rejectProviderCredential(db, context)).toBe(false);
});
test.each([null, {}, { source: 'arbitrary', id: 7, generation }, { source: 'omdb', id: -1, generation },
  { source: 'omdb', id: 7, generation: 'not-uuid' }])('invalid context cannot write: %j', async context => {
  const db = { query: jest.fn() };
  await expect(rejectProviderCredential(db, context)).rejects.toThrow('provider_credential_context_missing');
  expect(db.query).not.toHaveBeenCalled();
});
test.each(['OMDB_AUTHENTICATION', 'OMDB_ACCESS_DENIED', 'auth_failed', 'forbidden'])('classifies %s without body heuristics', code => {
  expect(isProviderCredentialRejection({ code })).toBe(true);
  expect(retrySchedule({ credentialsRejected: true }, 2)).toMatchObject({ chargeAttempt: false, reason: 'provider_credentials_rejected' });
});
test.each([null, {}, { code: 'not_found' }, { code: 'quota_exhausted' }, { message: 'invalid API key' }])('does not treat %j as credential evidence', error => {
  expect(isProviderCredentialRejection(error)).toBe(false);
});
test('settings expose rejection status but not internal generation', () => {
  expect(maskProviderApiKey({ credential_generation: generation, credential_rejected_at: 'now' }))
    .toEqual({ credential_rejected_at: 'now' });
});
