/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createOwnedCaptureFixture } from '../helpers/ownedCaptureFixture.mjs';
import { sourceIdentityRecoveryEvidence } from '../../services/sourceIdentityRecoveryEvidence.mjs';
import { createSourceIdentityExternalEvidenceReplayReadService } from '../../services/sourceIdentityExternalEvidenceReplayReadService.mjs';
import { createSourceIdentityCrossReferenceDiagnosis } from '../../services/sourceIdentityCrossReferenceDiagnosis.mjs';
import { createSourceCatalogPreview } from '../../services/sourceCatalogPreview.mjs';

let pool, store, libraryId, serverId, item, context;
beforeEach(async () => {
  pool = getPool(); store = createOwnedCaptureFixture(pool);
  serverId = (await pool.query("INSERT INTO media_server(type,name,url,api_key,is_active) VALUES ('plex',$1,'http://fixture.invalid','fixture',true) RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await pool.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ($1,'fixture-library','tv',$2,true) RETURNING id", [randomUUID(), serverId])).rows[0].id;
  item = { external_id: 'fixture-item', title: 'Fixture', year: 2001, media_type: 'tv',
    provider_identity_invalid: true, provider_identity_issue: 'conflicting_provider_ids', provider_identity_field: 'tvdb_id' };
  item.source_identity_evidence = sourceIdentityRecoveryEvidence(item, 'fixture-library', { tmdb_id: [11], imdb_id: ['tt123'], tvdb_id: [21, 22] });
  context = await store.start(serverId, libraryId); await store.capture(context, [item]);
});
afterEach(async () => {
  await pool.query('DELETE FROM libraries WHERE media_server_id=$1', [serverId]);
  await pool.query('DELETE FROM media_server WHERE id=$1', [serverId]);
});

function setup({ scopePreview = false, episodePreview = false, onDetails = async () => {} } = {}) {
  let inTransaction = false;
  const reader = createSourceIdentityExternalEvidenceReplayReadService({ withTransaction: async fn => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); inTransaction = true;
      const result = await fn(client);
      expect((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
      expect((await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('repeatable read');
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { inTransaction = false; client.release(); }
  } });
  const source = { getLibraryItemIdentityEvidence: jest.fn(async () => {
    expect(inTransaction).toBe(false); return item.source_identity_evidence;
  }), getLibraryItemLayout: jest.fn(async () => {
    expect(inTransaction).toBe(false);
    return { identity: item.source_identity_evidence, digest: 'a'.repeat(64), episodeCount: 1,
      episodes: [{ season: 1, episode: 1, providerIds: { tmdb_id: [100] } }],
      seasons: [{ number: 1, episodes: [1] }] };
  }) };
  const factory = scopePreview || episodePreview ? createSourceCatalogPreview : createSourceIdentityCrossReferenceDiagnosis;
  return { source, replay: factory({ readRows: limits => reader.read(limits),
    getMediaServerService: () => source, ...(episodePreview ? { mode: 'episodes' } : {}),
    tmdbService: { getIdentityDetails: async () => {
      expect(inTransaction).toBe(false); await onDetails();
      return { id: 11, name: 'Synthetic', seasons: [{ id: 12, season_number: 1, episode_count: 1 }] };
    }, getIdentitySeasonDetails: async () => {
      expect(inTransaction).toBe(false);
      return { id: 12, season_number: 1, episodes: [{ id: 100, show_id: 11, season_number: 1, episode_number: 1 }] };
    }, findIdentityByExternalId: async id => {
      expect(inTransaction).toBe(false); return { tv_results: id === 22 ? [] : [{ id: 11 }] };
    } } }) };
}

test('real read-only selection finishes before provider work and preserves every observation field', async () => {
  await store.finish(context);
  const before = (await pool.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows;
  const t = setup();
  expect(await t.replay.replay()).toMatchObject({ status: { id: 'complete' },
    summary: { inspectedObservations: 1, outcomes: { agreement_with_missing_mappings: 1 },
      stableEvidenceByProvider: { imdb_id: { lookups: 1, matched: 1, notFound: 0 },
        tvdb_id: { lookups: 2, matched: 1, notFound: 1 } } } });
  expect(t.source.getLibraryItemIdentityEvidence).toHaveBeenCalledTimes(2);
  expect((await pool.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows).toEqual(before);
  expect((await pool.query('SELECT id FROM media_server_items WHERE library_id=$1', [libraryId])).rowCount).toBe(0);
});

test('incomplete captures perform no provider work', async () => {
  const t = setup();
  expect((await t.replay.replay()).status.id).toBe('no_current_conflicts');
  expect(t.source.getLibraryItemIdentityEvidence).not.toHaveBeenCalled();
});

test('disabled libraries perform no provider work', async () => {
  await store.finish(context);
  await pool.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  const t = setup();
  expect((await t.replay.replay()).status.id).toBe('no_current_conflicts');
  expect(t.source.getLibraryItemIdentityEvidence).not.toHaveBeenCalled();
});

test('layout preview rechecks through real read-only transactions and preserves retained conflicts', async () => {
  await store.finish(context);
  const before = (await pool.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows;
  const t = setup({ scopePreview: true });
  expect(await t.replay.replay()).toMatchObject({ status: { id: 'complete' }, canApply: false,
    summary: { inspectedObservations: 1, comparisons: { equal_season_count_bounds: 1 } } });
  expect(t.source.getLibraryItemLayout).toHaveBeenCalledTimes(2);
  expect((await pool.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows).toEqual(before);
  expect((await pool.query('SELECT id FROM media_server_items WHERE library_id=$1', [libraryId])).rowCount).toBe(0);
});

test('layout preview discards evidence if the source configuration changes during HTTP', async () => {
  await store.finish(context);
  const t = setup({ scopePreview: true, onDetails: async () => {
    await pool.query("UPDATE media_server SET api_key='changed-fixture-key' WHERE id=$1", [serverId]);
  } });
  expect(await t.replay.replay()).toMatchObject({ status: { id: 'selection_changed' }, summary: null });
});

test('layout preview discards evidence if its library is disabled during HTTP', async () => {
  await store.finish(context);
  const t = setup({ scopePreview: true, onDetails: async () => {
    await pool.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  } });
  expect(await t.replay.replay()).toMatchObject({ status: { id: 'selection_changed' }, summary: null });
});

test('layout preview does not inspect incomplete source captures', async () => {
  const t = setup({ scopePreview: true });
  expect((await t.replay.replay()).status.id).toBe('no_current_conflicts');
  expect(t.source.getLibraryItemLayout).not.toHaveBeenCalled();
});

test('episode preview has no database writes and finishes transactions before season HTTP', async () => {
  await store.finish(context);
  const before = (await pool.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows;
  expect(await setup({ episodePreview: true }).replay.replay()).toMatchObject({ status: { id: 'complete' },
    canApply: false, summary: { comparisons: { episode_numbering_agrees: 1 } } });
  expect((await pool.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows).toEqual(before);
  expect((await pool.query('SELECT id FROM media_server_items WHERE library_id=$1', [libraryId])).rowCount).toBe(0);
});
test.each(['configuration', 'disabled'])('episode preview rejects actual %s drift during provider work', async mode => {
  await store.finish(context);
  const t = setup({ episodePreview: true, onDetails: async () => {
    if (mode === 'disabled') await pool.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
    else await pool.query("UPDATE media_server SET api_key='changed-fixture' WHERE id=$1", [serverId]);
  } });
  expect(await t.replay.replay()).toMatchObject({ status: { id: 'selection_changed' }, summary: null });
});
