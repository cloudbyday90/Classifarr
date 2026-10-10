/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { readSourceIdentityIssues } from '../../services/sourceIdentityIssues.mjs';
import { reviewSourceScope } from '../../services/sourceScopeReview.mjs';
import { readScopeEvidenceTarget } from '../../services/sourceScopeEvidenceRepository.mjs';
import { createSourceScopeEvidenceService } from '../../services/sourceScopeEvidenceService.mjs';
import { createSourceCandidateLookup } from '../../services/sourceCandidateLookup.mjs';
import { withinIdentityTestDeadline } from '../helpers/identityHttpFixture.mjs';

jest.unstable_unmockModule('../../config/database.mjs');
const { createDatabaseModule, DB_ADVISORY_LOCKS } = await import('../../config/database.mjs');

let client, serverId, libraryId, actorId;
beforeEach(async () => {
  client = await getPool().connect(); await client.query('BEGIN');
  actorId = (await client.query(`INSERT INTO users(username,password_hash,role,is_active)
    VALUES ($1,'fixture','admin',true) RETURNING id`, [randomUUID()])).rows[0].id;
  serverId = (await client.query(`INSERT INTO media_server(type,name,url,api_key,is_active)
    VALUES ('plex',$1,'http://fixture.invalid','fixture-secret',true) RETURNING id`, [randomUUID()])).rows[0].id;
  libraryId = (await client.query(`INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active)
    VALUES ($1,'library','tv',$2,true) RETURNING id`, [randomUUID(), serverId])).rows[0].id;
  await client.query(`INSERT INTO media_source_capture_state(library_id,media_server_id,generation,mode,phase,source)
    VALUES ($1,$2,2,'full','complete','media_sync')`, [libraryId, serverId]);
  await client.query(`INSERT INTO media_source_observations
    (library_id,media_server_id,external_id,title,media_type,identity_issue,provider_fields,generation)
    VALUES ($1,$2,'private-source','Fixture','tv','conflicting_provider_ids',ARRAY['tvdb_id'],2)`, [libraryId, serverId]);
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
const inputFor = item => ({ offset: 0, sourceVersion: item.sourceVersion, scope: { kind: 'whole_work', tmdbId: 10 } });
const read = async () => (await readSourceIdentityIssues(client)).items.find(item => item.libraryId === libraryId);

test('candidate lookup uses the shared database lock and never changes retained evidence', async () => {
  await client.query('UPDATE media_source_observations SET source_digest=$2 WHERE library_id=$1', [libraryId, 'b'.repeat(64)]);
  const item = await read(), body = { offset: 0, sourceVersion: item.sourceVersion };
  const before = (await client.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows;
  const database = createDatabaseModule({ pgModule: { Pool: class { constructor() { return getPool(); } } },
    loggerFactory: () => ({ error: jest.fn(), warn: jest.fn() }), environment: { NODE_ENV: 'production' } });
  const ready = Promise.withResolvers(), release = Promise.withResolvers();
  let reads = 0;
  const lookup = createSourceCandidateLookup({ db: client,
    withLock: work => database.withSessionAdvisoryLock(DB_ADVISORY_LOCKS.SOURCE_SCOPE_EVIDENCE_REVIEW, work),
    getMediaServerService: () => ({ getLibraryItemIdentityEvidence: async () => {
      reads++; ready.resolve(); await release.promise;
      return { mediaType: 'tv', snapshotDigest: 'b'.repeat(64), providerIds: { tmdb_id: [10], imdb_id: [], tvdb_id: [] } };
    } }),
    createCatalogProvider: async () => ({ getIdentityDetails: async () => ({ id: 10, name: 'Fixture' }), recheck: async () => {} }),
  });
  const pending = lookup(actorId, item.key, body);
  try {
    await withinIdentityTestDeadline(ready.promise);
    await expect(lookup(actorId, item.key, body)).rejects.toMatchObject({ code: 'candidate_busy' });
    expect(reads).toBe(1);
    release.resolve();
    expect(await withinIdentityTestDeadline(pending)).toMatchObject({ canApply: false, persisted: false, candidates: [{ tmdbId: 10 }] });
    expect((await client.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows).toEqual(before);
    expect(await database.withSessionAdvisoryLock(DB_ADVISORY_LOCKS.SOURCE_SCOPE_EVIDENCE_REVIEW, async () => {})).toBe(true);
  } finally { release.resolve(); }
});
test('reviews real retained evidence and preserves every observation field', async () => {
  const item = await read(); expect(item.sourceVersion).toMatch(/^[a-f0-9]{64}$/);
  const before = (await client.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows;
  const result = await reviewSourceScope(client, actorId, item.key, inputFor(item));
  expect(result).toMatchObject({ canApply: false, persisted: false, parentConflict: { providerFields: ['tvdb_id'] } });
  expect(JSON.stringify(result)).not.toMatch(/fixture-secret|fixture.invalid|private-source/);
  expect((await client.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows).toEqual(before);
});
test.each([
  ["UPDATE libraries SET is_active=false WHERE id=$1", 'library'],
  ["UPDATE media_source_capture_state SET phase='collecting' WHERE library_id=$1", 'library'],
  ["UPDATE media_source_observations SET provider_fields=ARRAY['tmdb_id'] WHERE library_id=$1", 'library'],
  ["UPDATE media_source_observations SET last_seen_at=statement_timestamp()-INTERVAL '31 days' WHERE library_id=$1", 'library'],
  ["UPDATE media_server SET api_key='changed-secret' WHERE id=$1", 'server'],
  ["UPDATE media_server SET url='http://changed.invalid' WHERE id=$1", 'server'],
  ["UPDATE media_server SET is_active=false WHERE id=$1", 'server'],
  ["UPDATE libraries SET external_id='changed' WHERE id=$1", 'library'],
])('rejects stale evidence: %s', async (sql, target) => {
  const item = await read(); await client.query(sql, [target === 'server' ? serverId : libraryId]);
  await expect(reviewSourceScope(client, actorId, item.key, inputFor(item))).rejects.toMatchObject({ statusCode: 409 });
});
test('denies a demoted database actor despite an older administrator session', async () => {
  const item = await read(); await client.query("UPDATE users SET role='user' WHERE id=$1", [actorId]);
  await expect(reviewSourceScope(client, actorId, item.key, inputFor(item))).rejects.toMatchObject({ statusCode: 403 });
});

test('private target query selects only the matching public-page item', async () => {
  const item = await read();
  const target = await readScopeEvidenceTarget(client, item.key, 0);
  expect(target).toMatchObject({ library_id: libraryId, media_server_id: serverId, external_id: 'private-source',
    api_key: 'fixture-secret', server_type: 'plex', media_type: 'tv' });
  expect(await readScopeEvidenceTarget(client, 'f'.repeat(64), 0)).toBeNull();
  expect(await readScopeEvidenceTarget(client, item.key, 50)).toBeNull();
});

test('fresh typed evidence retains PostgreSQL observations and rejects credential drift', async () => {
  const item = await read();
  const before = (await client.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows;
  const source = { identity: { mediaType: 'tv' }, digest: 'stable', seasons: [{ number: 1 }],
    episodes: [{ season: 1, episode: 1, providerIds: { tmdb_id: [101], tvdb_id: [], imdb_id: [] } }] };
  let changeConfig = false;
  const inspect = createSourceScopeEvidenceService({ db: client,
    withLock: async work => { await work({ signal: new AbortController().signal }); return true; },
    getMediaServerService: () => ({ getLibraryItemLayout: async () => source }),
    createCatalogProvider: async () => ({ recheck: async () => {},
      getIdentityDetails: async () => {
        if (changeConfig) await client.query("UPDATE media_server SET api_key='rotated' WHERE id=$1", [serverId]);
        return { id: 10, name: 'Fixture', seasons: [{ id: 50, season_number: 1, episode_count: 1 }] };
      },
      getIdentitySeasonDetails: async () => ({ id: 50, season_number: 1, episodes: [{ id: 101, show_id: 10, season_number: 1, episode_number: 1 }] }),
    }),
  });
  expect(await inspect(actorId, item.key, inputFor(item))).toMatchObject({ canApply: false, comparison: { matched: 1 } });
  expect((await client.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows).toEqual(before);
  changeConfig = true;
  await expect(inspect(actorId, item.key, inputFor(item))).rejects.toMatchObject({ statusCode: 409 });
});

test.each(['complete', 'lost'])('real database session admission: %s', async outcome => {
  const database = createDatabaseModule({ pgModule: { Pool: class { constructor() { return getPool(); } } },
    loggerFactory: () => ({ error: jest.fn(), warn: jest.fn() }), environment: { NODE_ENV: 'production' } });
  const ready = Promise.withResolvers(), release = Promise.withResolvers(), item = await read();
  const source = { identity: { mediaType: 'tv' }, digest: 'stable-empty', seasons: [], episodes: [] };
  let reads = 0;
  const inspect = createSourceScopeEvidenceService({ db: client,
    withLock: fn => database.withSessionAdvisoryLock(DB_ADVISORY_LOCKS.SOURCE_SCOPE_EVIDENCE_REVIEW, fn),
    createCatalogProvider: async () => ({ recheck: async () => {} }),
    getMediaServerService: () => ({ getLibraryItemLayout: async (_url, _key, _library, _item, { signal }) => {
      reads++; ready.resolve();
      if (outcome === 'lost') {
        await new Promise(resolve => { signal.addEventListener('abort', resolve, { once: true }); });
      } else await release.promise;
      return source;
    } }),
  });
  const pending = inspect(actorId, item.key, inputFor(item));
  const result = outcome === 'lost' ? expect(pending).rejects.toMatchObject({ statusCode: 503 })
    : expect(pending).resolves.toMatchObject({ canApply: false, comparison: { total: 0, matched: 0 } });
  try {
    await withinIdentityTestDeadline(ready.promise);
    await expect(inspect(actorId, item.key, inputFor(item))).rejects.toMatchObject({ statusCode: 503, code: 'scope_evidence_busy' });
    expect(reads).toBe(1);
    if (outcome === 'lost') {
      const { rows } = await getPool().query(`SELECT pid FROM pg_locks WHERE locktype='advisory'
        AND database=(SELECT oid FROM pg_database WHERE datname=current_database())
        AND classid=0 AND objid=$1 AND granted`, [DB_ADVISORY_LOCKS.SOURCE_SCOPE_EVIDENCE_REVIEW]);
      expect(rows).toHaveLength(1);
      await getPool().query('SELECT pg_terminate_backend($1)', [rows[0].pid]);
    } else release.resolve();
    await withinIdentityTestDeadline(result);
    expect(await database.withSessionAdvisoryLock(DB_ADVISORY_LOCKS.SOURCE_SCOPE_EVIDENCE_REVIEW, async () => {})).toBe(true);
  } finally { release.resolve(); }
});
