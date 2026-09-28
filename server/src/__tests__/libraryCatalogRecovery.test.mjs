/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { admitCatalogRecovery, catalogRecoveryPlan, CATALOG_REFRESH_MS } from '../services/libraryCatalogRecoveryPolicy.mjs';
import { catalogRetryAfter } from '../services/libraryCatalogRetryAfter.mjs';
import { withLibraryCatalogSession, LIBRARY_CATALOG_LOCK } from '../services/libraryCatalogSession.mjs';
import { observeLibraryDiscovery } from '../services/libraryDiscoveryObservation.mjs';
import { presentLibraryDiscovery } from '../services/libraryDiscoveryPresentation.mjs';

test.each(['unreachable', 'timeout', 'rate_limited', 'provider_unavailable'])('%s uses bounded increasing jitter without a sleep loop', reason => {
  const plan = attempts => catalogRecoveryPlan({ reason, attempts, random: () => 0.5 });
  expect(plan(1)).toEqual({ state: 'scheduled', delayMs: 375000 });
  expect(plan(4)).toEqual({ state: 'scheduled', delayMs: 3000000 });
  expect(plan(5)).toEqual({ state: 'cooldown', delayMs: CATALOG_REFRESH_MS });
});
test.each(['invalid_catalog', 'endpoint_unavailable', 'response_too_large', 'cancelled', 'local_update_failed', 'unknown'])
  ('%s never becomes an automatic hot retry', reason => expect(catalogRecoveryPlan({ reason, attempts: 1 })).toEqual({ state: 'needs_review', delayMs: null }));
test.each(['authentication', 'forbidden'])('%s waits for configuration', reason => {
  expect(catalogRecoveryPlan({ reason, attempts: 1 })).toEqual({ state: 'waiting_configuration', delayMs: null });
});
test('success has the normal cadence and unsupported server operations are not retried', () => {
  expect(catalogRecoveryPlan({ reason: 'complete', attempts: 5 })).toEqual({ state: 'scheduled', delayMs: CATALOG_REFRESH_MS });
  for (const httpStatus of [501, 505]) expect(catalogRecoveryPlan({ reason: 'provider_unavailable', httpStatus, attempts: 1 }).state).toBe('needs_review');
});
test.each(['120', 'Sun, 27 Sep 2026 12:02:00 GMT', 'Sunday, 27-Sep-26 12:02:00 GMT', 'Sun Sep 27 12:02:00 2026'])
  ('Retry-After %s is parsed without retaining headers', value => {
    expect(catalogRetryAfter({ response: { status: 503, headers: { 'retry-after': value, authorization: 'secret' } } }, Date.parse('2026-09-27T12:00:00Z'))).toEqual({ delayMs: 120000 });
  });
test.each(['secret', '-1', '1.5', '2026-09-27', '', undefined])('invalid Retry-After %s is not used', value => {
  expect(catalogRetryAfter({ response: { status: 429, headers: { 'retry-after': value } } })).toBeNull();
});
test('server waits are honored or suspend automation, never shortened by the local cap', () => {
  expect(catalogRecoveryPlan({ reason: 'rate_limited', attempts: 1, retryAfter: { delayMs: 86400000 } }).delayMs).toBe(86400000);
  const blocked = catalogRetryAfter({ response: { status: 429, headers: { 'retry-after': '9'.repeat(128) } } });
  expect(blocked).toEqual({ blocked: true });
  expect(catalogRecoveryPlan({ reason: 'rate_limited', attempts: 1, retryAfter: blocked }).state).toBe('needs_review');
  expect(catalogRetryAfter({ catalogRetryAfter: { delayMs: 1234 } })).toEqual({ delayMs: 1234 });
});
test('obsolete HTTP dates follow the fifty-year rule instead of JavaScript two-digit year parsing', () => {
  const hint = value => catalogRetryAfter({ response: { status: 503, headers: { 'retry-after': value } } }, Date.parse('2026-09-27T12:00:00Z'));
  expect(hint('Sunday, 27-Sep-68 12:00:00 GMT')).toEqual({ blocked: true });
  expect(hint('Sunday, 27-Sep-99 12:00:00 GMT')).toEqual({ delayMs: 0 });
});
const row = () => ({ configured: true, current_revision: 2, source_revision: 2, recovery_state: 'scheduled', automatic_attempts: 1,
  next_attempt_at: '2026-09-27T12:00:00Z', observed_at: '2026-09-27T12:01:00Z' });
test('admission waits for configuration, durable due time and remaining budget', () => {
  expect(admitCatalogRecovery(null).allowed).toBe(false);
  expect(admitCatalogRecovery({ ...row(), configured: false }).allowed).toBe(false);
  expect(admitCatalogRecovery(row()).allowed).toBe(true);
  for (const next_attempt_at of [null, 'invalid', '2026-09-27T12:02:00Z']) expect(admitCatalogRecovery({ ...row(), next_attempt_at }).allowed).toBe(false);
  expect(admitCatalogRecovery({ ...row(), automatic_attempts: 5, recovery_state: 'cooldown', next_attempt_at: '2026-09-27T18:00:00Z' }).allowed).toBe(false);
  expect(admitCatalogRecovery({ ...row(), recovery_state: 'waiting_configuration' }).allowed).toBe(false);
  expect(admitCatalogRecovery({ ...row(), recovery_state: 'waiting_configuration', current_revision: 3 }).allowed).toBe(true);
  expect(admitCatalogRecovery({ configured: true }).allowed).toBe(true);
});
test('presentation exposes retry timing or review without exposing private fields', () => {
  expect(presentLibraryDiscovery({ ...row(), reason: 'timeout' }).recovery).toEqual({ state: 'scheduled', attempts: 1, maxAttempts: 5, nextAttemptAt: '2026-09-27T12:00:00.000Z' });
  expect(presentLibraryDiscovery({ ...row(), automatic_attempts: 5, recovery_state: 'cooldown' }).recovery).toMatchObject({ state: 'cooldown', nextAttemptAt: '2026-09-27T12:00:00.000Z' });
});
function session(acquired = true) {
  const client = new EventEmitter();
  client.query = jest.fn().mockResolvedValue({ rows: [{ acquired }] });
  client.release = jest.fn();
  return { client, pool: { connect: jest.fn().mockResolvedValue(client) } };
}
test('catalog ownership uses one checked-out session through transaction commit and unlock', async () => {
  const { pool, client } = session(); let saved;
  expect(await withLibraryCatalogSession(pool, async db => {
    saved = db; return db.withTransaction(async tx => { await tx.query('merge'); return 7; });
  })).toBe(7);
  expect(client.query.mock.calls).toEqual([
    ['SELECT pg_try_advisory_lock($1) AS acquired', [LIBRARY_CATALOG_LOCK]], ['BEGIN'], ['merge'], ['COMMIT'],
    ['SELECT pg_advisory_unlock($1)', [LIBRARY_CATALOG_LOCK]],
  ]);
  expect(client.release).toHaveBeenCalledWith();
  await expect(saved.query('late write')).rejects.toThrow('session_closed');
});
test('busy ownership never runs callbacks; transaction failures roll back', async () => {
  const busy = session(false), callback = jest.fn();
  await expect(withLibraryCatalogSession(busy.pool, callback)).rejects.toMatchObject({ code: 'library_catalog_busy' });
  expect(callback).not.toHaveBeenCalled();
  const { pool, client } = session();
  await expect(withLibraryCatalogSession(pool, db => db.withTransaction(() => { throw new Error('failed'); }))).rejects.toThrow('failed');
  expect(client.query.mock.calls.map(call => call[0])).toContain('ROLLBACK');
});
test('lost ownership cancels requests and prevents all subsequent writes, discarding the client', async () => {
  const { pool, client } = session();
  await expect(withLibraryCatalogSession(pool, async (db, signal) => {
    client.emit('error', new Error('disconnected'));
    expect(signal.aborted).toBe(true);
    await expect(db.query('must not write')).rejects.toThrow('disconnected');
  })).rejects.toThrow('disconnected');
  expect(client.query).toHaveBeenCalledTimes(1);
  expect(client.release).toHaveBeenCalledWith(true);
});
test('automatic discovery fails closed before provider work if durable admission cannot be saved', async () => {
  const db = { query: jest.fn().mockResolvedValueOnce({ rows: [row()] })
    .mockResolvedValueOnce({ rows: [{ id: 1, catalog_revision: 2, url: 'http://synthetic.invalid', api_key: 'synthetic' }] })
    .mockRejectedValue(new Error('storage unavailable')) };
  const resolve = jest.fn(), consume = jest.fn();
  await expect(observeLibraryDiscovery(db, resolve, consume, { automatic: true })).rejects.toThrow('storage unavailable');
  expect(resolve).not.toHaveBeenCalled(); expect(consume).not.toHaveBeenCalled();
});
