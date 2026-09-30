/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { persistScopedRetryWait } from '../services/enrichmentRetryScopedWait.mjs';
import { rememberProviderRequest } from '../services/providerRequestEvidence.mjs';
const context = { source: 'omdb', id: 1, generation: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', providerKey: 'omdb' };
const schedule = { cooldown: true, delayMs: 40000, reason: 'provider_transient' };
const result = () => rememberProviderRequest({}, [context]);
const client = config => ({ query: jest.fn(async sql => ({ rows: sql.startsWith('SELECT *') ? [config] : [] })) });

test.each([
  ['missing provenance', 'omdb', schedule, {}],
  ['quota is not reset by rotation', 'omdb', { ...schedule, reset: 'day' }, result()],
  ['item-local failure', 'omdb', { ...schedule, cooldown: false }, result()],
  ['wrong dependency', 'web_search', schedule, result()],
])('%s keeps legacy scheduling', async (_name, type, policy, outcome) => {
  const db = client();
  expect(await persistScopedRetryWait(db, 1, type, policy, outcome)).toBe(false);
  expect(db.query).not.toHaveBeenCalled();
});
test('admission waits save their deadline but never extend provider pacing', async () => {
  const db = client();
  expect(await persistScopedRetryWait(db, 1, 'omdb', { cooldown: false, reason: 'provider_admission_wait' }, result())).toBe(true);
  expect(db.query).toHaveBeenCalledTimes(1);
});
test.each([undefined, { credential_generation: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }])('late results do not delay new configuration: %p', async config => {
  const db = client(config);
  expect(await persistScopedRetryWait(db, 1, 'omdb', schedule, result())).toBe(true);
  expect(db.query.mock.calls.some(([sql]) => sql.includes('UPDATE omdb_request_pacing'))).toBe(false);
});
test('matching OMDb context extends only its existing pacing', async () => {
  const db = client({ credential_generation: context.generation });
  expect(await persistScopedRetryWait(db, 1, 'omdb', schedule, result())).toBe(true);
  expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('UPDATE omdb_request_pacing'), [1, context.generation, 40]);
});
test('matching web context takes provider lock; mismatched provider cannot borrow authority', async () => {
  for (const key of ['brave', 'serper']) {
    const db = client({ credential_generation: context.generation, provider_key: key });
    const outcome = rememberProviderRequest({}, [{ ...context, source: 'web_search', providerKey: 'brave' }]);
    expect(await persistScopedRetryWait(db, 1, 'web_search', schedule, outcome)).toBe(true);
    expect(db.query.mock.calls.some(([sql]) => sql.includes('UPDATE web_search_provider_pacing'))).toBe(key === 'brave');
  }
});
test('legacy and native provider locks follow a stable order', async () => {
  const contexts = [{ ...context, id: 3, source: 'web_search', providerKey: 'serper' },
    { ...context, id: 2, source: 'web_search', providerKey: 'brave' },
    { ...context, source: 'legacy_tavily', providerKey: 'tavily' }];
  const db = client();
  await persistScopedRetryWait(db, 1, 'web_search', schedule, rememberProviderRequest({}, contexts));
  expect(db.query.mock.calls.filter(([sql]) => sql.startsWith('SELECT *')).map(([, args]) => args[0])).toEqual([1, 2, 3]);
});
