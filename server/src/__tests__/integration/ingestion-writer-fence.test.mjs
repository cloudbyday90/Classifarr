/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { getPool } from './setup.mjs';
import { readRuntime } from './runtime.mjs';
import { prepareFenceRehearsal, cutOverFenceRehearsal } from '../../scripts/ingestionWriterFence/install.mjs';
import { createFenceRehearsalClient } from '../../scripts/ingestionWriterFence/client.mjs';
import { FENCE_TABLES, fenceRole } from '../../scripts/ingestionWriterFence/contract.mjs';
import { MEDIA_SYNC_OWNER_LOCK } from '../../services/mediaSyncLockKeys.mjs';

describe('authenticated-role ingestion writer boundary candidate', () => {
  let admin, identities, config, interruptedLibrary;
  const clients = new Set();
  async function connect(identity = identities.writer) {
    const client = new pg.Client({ ...config, ...identity });
    client.on('error', () => {}); // Expected for the explicitly terminated legacy/crashed connection.
    clients.add(client);
    await client.connect();
    return client;
  }
  async function source(provider = 'plex', type = 'movie', active = true) {
    const { rows: [server] } = await admin.query(`INSERT INTO media_server(type,name,url,api_key)
      VALUES ($1,$2,$3,'synthetic') RETURNING id`, [provider, randomUUID(), `http://${randomUUID()}.invalid`]);
    const { rows: [library] } = await admin.query(`INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active)
      VALUES ($1,$1,$2,$3,$4) RETURNING id`, [randomUUID(), type, server.id, active]);
    await admin.query(`INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','running')`, [library.id]);
    await admin.query(`INSERT INTO media_source_capture_state(library_id,media_server_id,generation,mode,phase,source)
      VALUES ($1,$2,1,'full','collecting','media_sync')`, [library.id, server.id]);
    await admin.query(`INSERT INTO media_source_observations(library_id,media_server_id,external_id,generation,identity_issue)
      VALUES ($1,$2,'unresolved-synthetic',1,'invalid_provider_ids')`, [library.id, server.id]);
    await admin.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type,metadata)
      VALUES ($1,$2,$3,'Preserved inventory',$4,'{"preserved":true}')`, [server.id, library.id, `existing-${library.id}`, type === 'music' ? 'movie' : type]);
    return { id: library.id, serverId: server.id, external: `existing-${library.id}` };
  }
  beforeAll(async () => {
    admin = await getPool().connect();
    const runtime = readRuntime();
    const database = (await admin.query('SELECT current_database() database')).rows[0].database;
    config = { host: runtime.host, port: runtime.port, database, connectionTimeoutMillis: 5000,
      statement_timeout: 5000, application_name: 'isolated_ingestion_fence' };
    identities = await prepareFenceRehearsal(admin);
    interruptedLibrary = await source();
    // Real superuser login and table ownership, not SET ROLE. This is NOT the bootstrap role:
    // PostgreSQL forbids demoting that role; production bootstrap retirement needs a separate cutover.
    await admin.query(`ALTER TABLE public.media_server_items OWNER TO ${fenceRole(identities.legacy.user)}`);
    const legacy = await connect(identities.legacy);
    await legacy.query('BEGIN');
    await legacy.query("UPDATE public.media_server_items SET title='Uncommitted old write' WHERE library_id=$1", [interruptedLibrary.id]);
    await cutOverFenceRehearsal(admin, identities);
    await legacy.end(); clients.delete(legacy);
  }, 30000);
  afterAll(async () => {
    await Promise.allSettled([...clients].map(client => client.end()));
    try {
      if (identities) {
        const roles = Object.values(identities).map(value => fenceRole(value.user)).join(',');
        await admin.query(`REASSIGN OWNED BY ${roles} TO CURRENT_USER`);
        await admin.query(`DROP OWNED BY ${roles}`);
        await admin.query(`DROP ROLE ${roles}`);
      }
    } finally { admin?.release(); }
  });

  test('cutover drains uncommitted legacy writes and permanently removes that login and ownership', async () => {
    expect((await admin.query('SELECT title,metadata FROM media_server_items WHERE library_id=$1', [interruptedLibrary.id])).rows)
      .toEqual([{ title: 'Preserved inventory', metadata: { preserved: true } }]);
    await expect(connect(identities.legacy)).rejects.toMatchObject({ code: '28000' });
    await expect(connect(identities.owner)).rejects.toMatchObject({ code: '28000' });
    const role = (await admin.query('SELECT rolcanlogin,rolsuper,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=$1', [identities.legacy.user])).rows[0];
    expect(Object.values(role)).toEqual([false, false, false, false]);
    expect((await admin.query('SELECT count(*)::integer n FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=$1)', [identities.legacy.user])).rows[0].n).toBe(0);
  });

  test.each(FENCE_TABLES)('worker cannot directly mutate, truncate or disable protection on %s', async table => {
    const client = await connect();
    for (const sql of [`DELETE FROM public.${table}`, `TRUNCATE public.${table} CASCADE`,
      `ALTER TABLE public.${table} DISABLE TRIGGER ALL`]) {
      await expect(client.query(sql)).rejects.toMatchObject({ code: '42501' });
    }
  });

  test('worker has no owner escalation, parent cascade, private state or definer creation capability', async () => {
    const client = await connect();
    for (const sql of [`SET ROLE ${fenceRole(identities.owner.user)}`, 'DELETE FROM public.libraries',
      'DELETE FROM public.media_server', 'UPDATE ingestion_fence_rehearsal.cutover SET enabled=true',
      'SELECT * FROM ingestion_fence_rehearsal.bindings',
      'SELECT ingestion_fence_rehearsal.assert_lock(1)',
      'CALL ingestion_fence_rehearsal.retire_legacy()',
      'CREATE TABLE public.fence_escape(id integer)',
      'CREATE TABLE ingestion_fence_rehearsal.fence_escape(id integer)',
      "SET session_replication_role='replica'"]) {
      await expect(client.query(sql)).rejects.toMatchObject({ code: '42501' });
    }
  });

  test('retirement cannot hide NOLOGIN inside an outer transaction', async () => {
    await admin.query('BEGIN');
    try {
      await expect(admin.query('CALL ingestion_fence_rehearsal.retire_legacy()')).rejects.toMatchObject({ code: '2D000' });
    } finally { await admin.query('ROLLBACK'); }
  });

  test('a bounded cutover lock failure never enables adoption and can be retried after drain', async () => {
    const blocker = await getPool().connect();
    await admin.query('UPDATE ingestion_fence_rehearsal.cutover SET enabled=false');
    await blocker.query('BEGIN; LOCK TABLE public.media_server_items IN ACCESS SHARE MODE');
    try {
      await expect(cutOverFenceRehearsal(admin, identities)).rejects.toMatchObject({ code: '55P03' });
      expect((await admin.query('SELECT enabled FROM ingestion_fence_rehearsal.cutover')).rows[0].enabled).toBe(false);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); }
    await cutOverFenceRehearsal(admin, identities);
    expect((await admin.query('SELECT enabled FROM ingestion_fence_rehearsal.cutover')).rows[0].enabled).toBe(true);
    await expect(cutOverFenceRehearsal(admin, identities)).rejects.toThrow('cutover_not_pending');
  });

  test.each(['plex', 'emby', 'jellyfin'].flatMap(provider => ['movie', 'tv'].map(type => [provider, type])))
    ('%s %s legacy adoption is atomic, library-agnostic, scoped and preserves partial inventory', async (provider, type) => {
      const library = await source(provider, type), client = await connect(), api = createFenceRehearsalClient(client);
      const before = (await admin.query('SELECT id,metadata FROM media_server_items WHERE library_id=$1', [library.id])).rows;
      const run = await api.begin(library.id);
      await expect(api.begin(library.id)).rejects.toThrow('already_active');
      expect((await admin.query('SELECT status FROM media_server_sync_status WHERE library_id=$1', [library.id])).rows[0].status).toBe('failed');
      expect((await admin.query('SELECT verification,retired_syncs,retired_captures FROM ingestion_fence_rehearsal.receipts WHERE run_id=$1', [run.token])).rows)
        .toEqual([{ verification: 'isolated_database_cutover', retired_syncs: 1, retired_captures: 1 }]);
      expect((await admin.query('SELECT phase FROM media_source_capture_state WHERE library_id=$1', [library.id])).rows[0].phase).toBe('failed');
      expect((await admin.query('SELECT count(*)::integer n FROM media_source_observations WHERE library_id=$1', [library.id])).rows[0].n).toBe(1);
      await api.write(run, `new-${library.id}`, 'New synthetic item');
      await expect(api.finish(run, 2)).rejects.toMatchObject({ code: '55000' });
      expect((await admin.query('SELECT id,metadata FROM media_server_items WHERE id=$1', [before[0].id])).rows).toEqual(before);
      await api.write(run, library.external, 'Reviewed title');
      await api.finish(run, 2);
      expect((await admin.query('SELECT items_processed,phase FROM library_ingestion_state WHERE library_id=$1', [library.id])).rows[0])
        .toMatchObject({ items_processed: 2, phase: 'complete' });
      await expect(api.write(run, 'late', 'Late callback')).rejects.toMatchObject({ code: '55000' });
    });

  test('other sessions, libraries, invented tokens and changed source revisions cannot use a run', async () => {
    const library = await source(), other = await source(), first = await connect(), second = await connect();
    const api = createFenceRehearsalClient(first), peer = createFenceRehearsalClient(second);
    const run = await api.begin(library.id);
    expect(await peer.begin(library.id)).toEqual({ deferred: true, reason: 'ingestion_owned' });
    await expect(peer.write(run, 'wrong-session', 'Wrong')).rejects.toMatchObject({ code: '55000' });
    await expect(api.write({ ...run, token: randomUUID() }, 'forged', 'Wrong')).rejects.toMatchObject({ code: '55000' });
    await expect(api.write({ ...run, libraryId: other.id }, 'wrong-library', 'Wrong')).rejects.toMatchObject({ code: '55000' });
    await admin.query("UPDATE media_server SET api_key='changed synthetic' WHERE id=$1", [library.serverId]);
    await expect(api.write(run, 'changed-source', 'Wrong')).rejects.toMatchObject({ code: '55000' });
  });

  test('released lock fences late writes; reacquisition cannot resurrect an old token', async () => {
    const library = await source(), first = await connect(), second = await connect();
    const api = createFenceRehearsalClient(first), peer = createFenceRehearsalClient(second);
    const run = await api.begin(library.id);
    await api.write(run, 'partial-before-crash', 'Partial');
    await first.query('SELECT pg_advisory_unlock($1::integer,$2::integer)', [MEDIA_SYNC_OWNER_LOCK, library.id]);
    await expect(api.write(run, 'lost-lock', 'Wrong')).rejects.toMatchObject({ code: '55000' });
    const replacement = await peer.begin(library.id);
    expect(replacement.token).not.toBe(run.token);
    await peer.finish(replacement, 0);
    // Even reacquiring the lock cannot resurrect the old token after the other session settled.
    await first.query('SELECT pg_advisory_lock($1::integer,$2::integer)', [MEDIA_SYNC_OWNER_LOCK, library.id]);
    await expect(api.write(run, 'stale', 'Wrong')).rejects.toMatchObject({ code: '55000' });
    await first.end(); clients.delete(first);
    const recovery = await peer.begin(library.id);
    await peer.write(recovery, 'partial-before-crash', 'Replayed');
    await peer.finish(recovery, 1);
    expect((await admin.query('SELECT count(*)::integer n FROM media_server_items WHERE library_id=$1', [library.id])).rows[0].n).toBe(2);
  });

  test('a terminated active owner releases its lock; replacement replays partial writes without duplicate rows', async () => {
    const library = await source(), first = await connect(), second = await connect();
    const api = createFenceRehearsalClient(first), peer = createFenceRehearsalClient(second);
    const run = await api.begin(library.id);
    await api.write(run, 'partial-before-termination', 'Partial');
    const pid = (await first.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    // PostgreSQL waits for this backend to exit, rather than depending on sleeps or row age.
    expect((await admin.query('SELECT pg_terminate_backend($1,5000) stopped', [pid])).rows[0].stopped).toBe(true);
    await expect(api.write(run, 'after-termination', 'Wrong')).rejects.toThrow();
    const replacement = await peer.begin(library.id);
    expect(replacement.token).not.toBe(run.token);
    await expect(peer.write(run, 'old-token', 'Wrong')).rejects.toMatchObject({ code: '55000' });
    await peer.write(replacement, 'partial-before-termination', 'Replayed');
    await peer.write(replacement, 'partial-before-termination', 'Replayed again');
    await peer.finish(replacement, 1);
    expect((await admin.query('SELECT count(*)::integer n FROM media_server_items WHERE library_id=$1', [library.id])).rows[0].n).toBe(2);
  });

  test('shared advisory locks and a missing cutover receipt never authorize adoption', async () => {
    const library = await source(), client = await connect();
    await client.query('SELECT pg_advisory_lock_shared($1::integer,$2::integer)', [MEDIA_SYNC_OWNER_LOCK, library.id]);
    await expect(client.query('SELECT ingestion_fence_rehearsal.begin_run($1)', [library.id])).rejects.toMatchObject({ code: '55000' });
    await client.query('SELECT pg_advisory_unlock_shared($1::integer,$2::integer)', [MEDIA_SYNC_OWNER_LOCK, library.id]);
    await admin.query('UPDATE ingestion_fence_rehearsal.cutover SET enabled=false');
    try {
      await expect(createFenceRehearsalClient(client).begin(library.id)).rejects.toMatchObject({ code: '55000' });
    } finally { await admin.query('UPDATE ingestion_fence_rehearsal.cutover SET enabled=true'); }
    expect((await admin.query('SELECT * FROM library_ingestion_state WHERE library_id=$1', [library.id])).rows).toEqual([]);
  });

  test('bounded writes cannot steal another library identity or exceed the run item budget', async () => {
    const library = await source(), other = await source();
    await admin.query('UPDATE libraries SET media_server_id=$1 WHERE id=$2', [library.serverId, other.id]);
    await admin.query('UPDATE media_server_items SET media_server_id=$1 WHERE library_id=$2', [library.serverId, other.id]);
    const api = createFenceRehearsalClient(await connect()), run = await api.begin(library.id);
    await expect(api.write(run, other.external, 'Steal')).rejects.toMatchObject({ code: '55000' });
    // Seed only the private budget ledger to exercise its boundary without 1000 network round trips.
    await admin.query(`INSERT INTO ingestion_fence_rehearsal.seen(library_id,run_id,external_id)
      SELECT $1,$2,'synthetic-'||n FROM generate_series(1,1000) n`, [library.id, run.token]);
    await expect(api.write(run, 'over-budget', 'Wrong')).rejects.toMatchObject({ code: '54000' });
    await api.write(run, 'synthetic-1', 'Permitted replay');
    expect((await admin.query('SELECT title FROM media_server_items WHERE library_id=$1', [other.id])).rows[0].title).toBe('Preserved inventory');
    await expect(api.finish(run, 1001)).rejects.toMatchObject({ code: '55000' });
  });

  test('failed receipt rolls back adoption; temporary objects cannot shadow privileged relations', async () => {
    const library = await source(), client = await connect(), api = createFenceRehearsalClient(client);
    await admin.query("ALTER TABLE ingestion_fence_rehearsal.receipts ADD CONSTRAINT test_reject CHECK (retired_syncs=0) NOT VALID");
    try { await expect(api.begin(library.id)).rejects.toMatchObject({ code: '23514' }); }
    finally { await admin.query('ALTER TABLE ingestion_fence_rehearsal.receipts DROP CONSTRAINT test_reject'); }
    expect((await admin.query('SELECT status FROM media_server_sync_status WHERE library_id=$1', [library.id])).rows[0].status).toBe('running');
    expect((await admin.query('SELECT * FROM library_ingestion_state WHERE library_id=$1', [library.id])).rows).toEqual([]);
    await client.query('CREATE TEMP TABLE libraries(id integer); CREATE TEMP TABLE media_server_items(id integer)');
    const run = await api.begin(library.id);
    await expect(api.write(run, '', 'Invalid')).rejects.toMatchObject({ code: '22023' });
    await expect(api.write(run, 'x', 'x'.repeat(501))).rejects.toMatchObject({ code: '22023' });
    await api.write(run, 'valid', 'Valid');
    await api.finish(run, 1);
    expect((await admin.query("SELECT count(*)::integer n FROM media_server_items WHERE library_id=$1 AND external_id='valid'", [library.id])).rows[0].n).toBe(1);
  });

  test('music library creation stays rejected by the authoritative schema', async () => {
    await expect(source('jellyfin', 'music')).rejects.toMatchObject({ code: '23514' });
  });

  test.each(['disabled', 'unconfigured'])('fresh %s source remains idle with legacy inventory preserved', async state => {
    const library = await source('jellyfin', 'movie', state !== 'disabled');
    if (state === 'unconfigured') await admin.query("UPDATE media_server SET api_key='' WHERE id=$1", [library.serverId]);
    const api = createFenceRehearsalClient(await connect());
    await expect(api.begin(library.id)).rejects.toMatchObject({ code: '55000' });
    expect((await admin.query('SELECT * FROM library_ingestion_state WHERE library_id=$1', [library.id])).rows).toEqual([]);
    expect((await admin.query('SELECT status FROM media_server_sync_status WHERE library_id=$1', [library.id])).rows[0].status).toBe('running');
  });
});
