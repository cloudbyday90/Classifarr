/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const db = await import('../../config/database.mjs');
const { captureManualRoutingIntent } = await import('../../services/manualRoutingIntentPersistence.mjs');
const { manualRoutingLibraryFingerprint } = await import('../../services/manualRoutingIntent.mjs');
const { createManualRoutingCheckCoordinator } = await import('../../services/manualRoutingCheckCoordinator.mjs');
const { createManualRoutingCheckState } = await import('../../services/manualRoutingCheckState.mjs');
const { createManualRoutingProviderGuard } = await import('../../services/manualRoutingProviderGuard.mjs');
const { createManualRoutingCheckRepository } = await import('../../services/manualRoutingCheckRepository.mjs');
const { ArrLookupFailure } = await import('../../services/arrLookupFailure.mjs');
let library, providerId, id;
let extraIds = [];
const attemptId = 'c98f1028-cbfc-49c6-9e1b-a137c060dd07';
const read = jest.fn();
const providers = { radarr: { getMovieByTmdbId: read, buildUrl: () => 'http://fixture' } };
const state = () => createManualRoutingCheckState({ db, random: () => 0 });
const service = () => createManualRoutingCheckCoordinator({ db, providers, state: state() });
const due = () => db.query("UPDATE manual_routing_check_state SET next_check_at=NOW()-INTERVAL '1 second' WHERE classification_id=$1", [id]);

beforeEach(async () => {
  extraIds = [];
  read.mockReset().mockResolvedValue(null);
  providerId = (await db.query(`INSERT INTO radarr_config(name,url,api_key,is_active)
    VALUES('Background fixture','http://fixture','synthetic-key',true) RETURNING id`)).rows[0].id;
  library = (await db.query(`INSERT INTO libraries(name,external_id,media_type,arr_type,arr_id,root_folder,is_active)
    VALUES('Background fixture','background-fixture','movie','radarr',$1,'/movies',true) RETURNING *`, [providerId])).rows[0];
  id = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,method,status,metadata)
    VALUES(42,'movie','Background fixture',$1,'manual_classification','completed',$2) RETURNING id`, [library.id,
    JSON.stringify({ classification_details: { routing: 'manual_routing_pending', manual_routing_attempt_id: attemptId } })])).rows[0].id;
  await captureManualRoutingIntent(db, { classificationId: id, library, attemptId }, {
    arrType: 'radarr', configId: providerId, baseUrl: 'http://fixture', libraryFingerprint: manualRoutingLibraryFingerprint(library),
    expected: { identityKey: 'tmdbId', identity: 42, rootFolderPath: '/movies' },
  });
});
afterEach(async () => {
  for (const extraId of extraIds) await db.query('DELETE FROM classification_history WHERE id=$1', [extraId]);
  await db.query('DELETE FROM classification_history WHERE id=$1', [id]);
  await db.query('DELETE FROM libraries WHERE id=$1', [library.id]);
  await db.query('DELETE FROM radarr_config WHERE id=$1', [providerId]);
});

test('fresh setup is off, repeatable migration enrolls nothing, enablement survives restart', async () => {
  const migration = readFileSync(new URL('../../../../database/migrations/20261003_120000_manual_routing_checks.sql', import.meta.url), 'utf8');
  await db.query(migration); await db.query(migration);
  expect(await service().read(id)).toMatchObject({ enabled: false, attempts: 0 });
  expect(await service().next()).toBeNull();
  expect((await service().check(id, { automatic: true })).reason).toBe('not_eligible');
  expect(read).not.toHaveBeenCalled();
  await service().setEnabled(id, true);
  expect(await service().next()).toBe(id);
  expect((await service().check(id, { automatic: true })).reason).toBe('not_present');
  expect(await service().read(id)).toMatchObject({ enabled: true, attempts: 1, lastResult: 'not_present' });
});

test('persistent cooldown and three-attempt limit cannot be reset by toggles or restart', async () => {
  await service().setEnabled(id, true);
  for (let count = 1; count <= 3; count++) {
    await due();
    expect((await service().check(id, { automatic: true })).reason).toBe('not_present');
    expect(await service().read(id)).toMatchObject({ attempts: count, enabled: count < 3 });
    expect((await service().check(id)).reason).toBe('cooldown');
    const before = await service().read(id);
    await service().setEnabled(id, false); await service().setEnabled(id, true);
    expect((await service().read(id)).nextCheckAt).toEqual(before.nextCheckAt);
  }
  await due();
  expect((await service().check(id, { automatic: true })).reason).toBe('off');
  expect(read).toHaveBeenCalledTimes(3);
});

test('manual and background instances share a nonblocking lock, released only after the read settles', async () => {
  await service().setEnabled(id, true);
  let release, started;
  const entered = new Promise(resolve => { started = resolve; });
  read.mockImplementation(() => { started(); return new Promise(resolve => { release = resolve; }); });
  const running = service().check(id, { automatic: true });
  await Promise.race([entered, running.then(result => { throw new Error(`Check never reached provider: ${JSON.stringify(result)}`); })]);
  try {
    expect((await service().check(id)).reason).toBe('busy');
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM classification_history WHERE id=$1 FOR UPDATE NOWAIT', [id]);
    } finally { await client.query('ROLLBACK'); client.release(); }
    await service().setEnabled(id, false);
  } finally { release(null); await running; }
  expect((await service().read(id)).enabled).toBe(false);
  expect((await service().check(id)).reason).toBe('cooldown');
  expect(read).toHaveBeenCalledTimes(1);
});

test('admission without a completed read still spends the durable budget', async () => {
  await service().setEnabled(id, true);
  expect(await state().claim(id, attemptId, true)).toEqual({ admitted: true });
  expect((await service().check(id, { automatic: true })).reason).toBe('cooldown');
  expect(await service().read(id)).toMatchObject({ attempts: 1, lastResult: 'checking' });
  expect(read).not.toHaveBeenCalled();
  await db.query('UPDATE manual_routing_check_state SET automatic_attempts=2 WHERE classification_id=$1', [id]);
  await due();
  await state().claim(id, attemptId, true); // Crash during the third admission must display exhausted, not active.
  expect(await service().read(id)).toMatchObject({ enabled: false, attempts: 3, lastResult: 'checking' });
  expect(await service().next()).toBeNull();
});

test.each(['endpoint', 'legacy', 'attempt'])('changed %s stops automatic work without provider I/O', async change => {
  await service().setEnabled(id, true);
  if (change === 'endpoint') await db.query("UPDATE radarr_config SET url='http://changed' WHERE id=$1", [providerId]);
  if (change === 'legacy') await db.query("UPDATE classification_history SET metadata='{}' WHERE id=$1", [id]);
  if (change === 'attempt') await db.query(`UPDATE classification_history SET metadata=jsonb_set(metadata,
    '{classification_details,manual_routing_attempt_id}','"a98f1028-cbfc-49c6-9e1b-a137c060dd07"') WHERE id=$1`, [id]);
  await service().check(id, { automatic: true });
  expect((await service().read(id)).enabled).toBe(false);
  expect(read).not.toHaveBeenCalled();
});

test.each([
  [{ id: 7, tmdbId: 42, path: '/movies/Fixture' }, 'verified_present'],
  [{ id: 7, tmdbId: 42, path: '/other/Fixture' }, 'mismatch'],
])('terminal observations stop automatically without rewriting the routing decision', async (item, reason) => {
  await service().setEnabled(id, true); read.mockResolvedValue(item);
  expect((await service().check(id, { automatic: true })).reason).toBe(reason);
  expect((await service().read(id)).enabled).toBe(false);
  const { rows: [row] } = await db.query('SELECT * FROM classification_history WHERE id=$1', [id]);
  expect(row.status).toBe('completed');
  expect(row.metadata.classification_details.routing).toBe('manual_routing_pending');
  expect(row.metadata.classification_details.manual_routing_observation.reason).toBe(reason);
});

test('provider failures retain a bounded retry; history pruning removes only associated state', async () => {
  await service().setEnabled(id, true); read.mockRejectedValue(new Error('synthetic-private-url'));
  expect((await service().check(id, { automatic: true })).reason).toBe('unavailable');
  expect(await service().read(id)).toMatchObject({ enabled: true, attempts: 0, provider: { reason: 'provider_paused' } });
  await db.query('DELETE FROM classification_history WHERE id=$1', [id]);
  expect((await state().read(id)).attempts).toBe(0);
  expect((await db.query('SELECT id FROM libraries WHERE id=$1', [library.id])).rowCount).toBe(1);
});

async function cloneItem() {
  const result = await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,method,status,metadata)
    SELECT tmdb_id,media_type,title,library_id,method,status,metadata FROM classification_history WHERE id=$1 RETURNING id`, [id]);
  const clone = result.rows[0].id; extraIds.push(clone); return clone;
}
const providerDue = () => db.query("UPDATE manual_routing_provider_state SET next_check_at=NOW()-INTERVAL '1 second' WHERE radarr_id=$1", [providerId]);

test('one authentication failure pauses other items across instances without spending either allowance', async () => {
  const clone = await cloneItem();
  await service().setEnabled(id, true); await service().setEnabled(clone, true);
  read.mockRejectedValue(new ArrLookupFailure('safe', { response: { status: 401 } }));
  expect((await service().check(id, { automatic: true })).reason).toBe('provider_auth_required');
  expect((await service().check(clone, { automatic: true })).reason).toBe('provider_auth_required');
  expect((await service().read(clone)).attempts).toBe(0);
  expect((await service().read(id)).attempts).toBe(0);
  await providerDue(); await due();
  expect((await service().check(id, { automatic: true })).reason).toBe('provider_auth_required');
  expect(read).toHaveBeenCalledTimes(1);
  expect(await service().next()).toBeNull(); // Blocked rows were deferred, not left at the head forever.
  read.mockResolvedValue(null); await due();
  expect((await service().check(id)).reason).toBe('not_present'); // Explicit repair check can close the guard.
  expect((await service().read(clone)).provider).toBeNull();
});

test('credential rotation releases the old guard without weakening the frozen destination', async () => {
  await service().setEnabled(id, true);
  read.mockRejectedValueOnce(new ArrLookupFailure('safe', { response: { status: 403 } }));
  await service().check(id, { automatic: true });
  await db.query("UPDATE radarr_config SET api_key='rotated-synthetic' WHERE id=$1", [providerId]);
  await due();
  expect((await service().check(id, { automatic: true })).reason).toBe('not_present');
  expect(read.mock.calls[1][1]).toBe('rotated-synthetic');
  expect(await service().read(id)).toMatchObject({ attempts: 1, provider: null });
});

test('transient half-open checks honor Retry-After, survive restart, and preserve third allowance and opt-out', async () => {
  await service().setEnabled(id, true);
  await db.query('UPDATE manual_routing_check_state SET automatic_attempts=2 WHERE classification_id=$1', [id]);
  read.mockRejectedValueOnce(new ArrLookupFailure('safe', { response: { status: 503, headers: { 'retry-after': '7200' } } }));
  await service().check(id, { automatic: true });
  expect(await service().read(id)).toMatchObject({ enabled: true, attempts: 2 });
  const { rows: [pause] } = await db.query('SELECT EXTRACT(EPOCH FROM(next_check_at-NOW())) AS seconds FROM manual_routing_provider_state WHERE radarr_id=$1', [providerId]);
  expect(Number(pause.seconds)).toBeGreaterThan(7190);
  await due(); expect((await service().check(id)).reason).toBe('provider_paused');
  expect(read).toHaveBeenCalledTimes(1);
  await providerDue(); await due();
  read.mockImplementationOnce(async () => {
    await service().setEnabled(id, false);
    throw new ArrLookupFailure('safe', { response: { status: 429 } });
  });
  await service().check(id, { automatic: true });
  expect(await service().read(id)).toMatchObject({ enabled: false, attempts: 2 });
  await service().setEnabled(id, true); await providerDue(); await due();
  expect((await service().check(id, { automatic: true })).reason).toBe('not_present');
  expect(await service().read(id)).toMatchObject({ enabled: false, attempts: 3 });
});

test('provider state is bounded by configuration lifetime, isolated by type, and logs only transitions', async () => {
  const migration = readFileSync(new URL('../../../../database/migrations/20261003_140000_manual_routing_provider_guard.sql', import.meta.url), 'utf8');
  await db.query(migration); await db.query(migration);
  const context = await createManualRoutingCheckRepository({ db, providers }).load(id);
  const logger = { info: jest.fn() }, guard = createManualRoutingProviderGuard({ db, random: () => 0, logger });
  const sonarrId = (await db.query("INSERT INTO sonarr_config(name,url,api_key) VALUES('guard fixture','http://fixture','synthetic') RETURNING id")).rows[0].id;
  const sonarr = { ...context, intent: { ...context.intent, arrType: 'sonarr', configId: sonarrId } };
  try {
    expect(await guard.prepare(context, true)).toBeNull();
    const first = await guard.reserve(context);
    expect((await guard.prepare(context, true)).reason).toBe('provider_paused'); // Crashed read reservation.
    const second = await guard.reserve(context);
    await expect(guard.finish(context, null, first)).rejects.toThrow('changed');
    await guard.finish(context, { kind: 'transient', retryAfterSeconds: null }, second);
    await guard.finish(context, { kind: 'transient', retryAfterSeconds: null }, await guard.reserve(context));
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(await guard.prepare(sonarr, true)).toBeNull();
    await guard.finish(sonarr, { kind: 'configuration', retryAfterSeconds: null }, await guard.reserve(sonarr));
    expect((await guard.read(sonarr)).reason).toBe('provider_configuration_required');
    expect((await guard.read(context)).reason).toBe('provider_paused');
    await guard.finish(context, null, await guard.reserve(context));
    expect(await guard.read(context)).toBeNull();
    expect(JSON.stringify(logger.info.mock.calls)).not.toMatch(/synthetic|http:|revision|reservation/);
  } finally { await db.query('DELETE FROM sonarr_config WHERE id=$1', [sonarrId]); }
  expect((await db.query('SELECT * FROM manual_routing_provider_state WHERE sonarr_id=$1', [sonarrId])).rowCount).toBe(0);
});
