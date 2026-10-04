/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import { createIngestionFenceFixture } from './helpers/ingestionFenceFixture.mjs';
import { MEDIA_SYNC_OWNER_LOCK } from '../../services/mediaSyncLockKeys.mjs';

describe('effective ingestion-fence authority after cutover', () => {
  let fixture;
  beforeAll(async () => { fixture = await createIngestionFenceFixture(); });
  afterAll(async () => { await fixture?.close(); });

  test.each([
    'UPDATE', 'UPDATE(title)', 'INSERT(title)', 'DELETE', 'TRUNCATE', 'TRIGGER', 'MAINTAIN', 'REFERENCES(id)',
  ])('restored %s grant blocks legacy retirement', async grant => {
    const { admin, identities, source, connect } = fixture;
    const library = await source(), { api } = await connect();
    await admin.query(`GRANT ${grant} ON public.media_server_items TO ${identities.writer.user}`);
    try {
      await expect(api.begin(library)).rejects.toMatchObject({ code: '55000', message: 'ingestion_fence_authority_changed' });
      expect((await admin.query('SELECT status FROM media_server_sync_status WHERE library_id=$1', [library])).rows)
        .toEqual([{ status: 'running' }]);
      expect((await admin.query('SELECT * FROM library_ingestion_state WHERE library_id=$1', [library])).rowCount).toBe(0);
    } finally { await admin.query(`REVOKE ${grant} ON public.media_server_items FROM ${identities.writer.user}`); }
  });

  test.each([
    ['public', 'GRANT UPDATE(title) ON public.media_server_items TO PUBLIC', 'REVOKE UPDATE(title) ON public.media_server_items FROM PUBLIC'],
    ['cascade parent', 'GRANT DELETE ON public.libraries TO WRITER', 'REVOKE DELETE ON public.libraries FROM WRITER'],
    ['private ledger', 'GRANT UPDATE(enabled) ON ingestion_fence_rehearsal.cutover TO WRITER', 'REVOKE UPDATE(enabled) ON ingestion_fence_rehearsal.cutover FROM WRITER'],
    ['private read', 'GRANT SELECT ON ingestion_fence_rehearsal.bindings TO WRITER', 'REVOKE SELECT ON ingestion_fence_rehearsal.bindings FROM WRITER'],
    ['private column read', 'GRANT SELECT(run_id) ON ingestion_fence_rehearsal.bindings TO WRITER', 'REVOKE SELECT(run_id) ON ingestion_fence_rehearsal.bindings FROM WRITER'],
    ['sequence', 'GRANT USAGE ON public.media_server_items_id_seq TO WRITER', 'REVOKE USAGE ON public.media_server_items_id_seq FROM WRITER'],
    ['public schema', 'GRANT CREATE ON SCHEMA public TO WRITER', 'REVOKE CREATE ON SCHEMA public FROM WRITER'],
    ['private schema', 'GRANT CREATE ON SCHEMA ingestion_fence_rehearsal TO WRITER', 'REVOKE CREATE ON SCHEMA ingestion_fence_rehearsal FROM WRITER'],
    ['internal routine', 'GRANT EXECUTE ON FUNCTION ingestion_fence_rehearsal.assert_lock(integer) TO WRITER', 'REVOKE EXECUTE ON FUNCTION ingestion_fence_rehearsal.assert_lock(integer) FROM WRITER'],
    ['retired legacy write', 'GRANT UPDATE(title) ON public.media_server_items TO LEGACY', 'REVOKE UPDATE(title) ON public.media_server_items FROM LEGACY'],
  ])('%s authority drift blocks both an admitted write and completion', async (_label, grant, revoke) => {
    const { admin, identities, source, connect } = fixture;
    const sql = text => text.replaceAll('WRITER', identities.writer.user).replaceAll('LEGACY', identities.legacy.user);
    const library = await source(), { api } = await connect(), run = await api.begin(library);
    await api.write(run, 'preserved', 'Before drift');
    await admin.query(sql(grant));
    try {
      await expect(api.write(run, 'preserved', 'Unsafe overwrite')).rejects.toMatchObject({ code: '55000', message: 'ingestion_fence_authority_changed' });
      await expect(api.finish(run, 1)).rejects.toMatchObject({ code: '55000' });
      expect((await admin.query('SELECT title FROM media_server_items WHERE library_id=$1', [library])).rows)
        .toEqual([{ title: 'Before drift' }]);
      expect((await admin.query('SELECT phase FROM library_ingestion_state WHERE library_id=$1', [library])).rows)
        .toEqual([{ phase: 'running' }]);
    } finally { await admin.query(sql(revoke)); }
    await api.finish(run, 1); // Explicit retry after the fixture administrator restores the boundary.
  });

  test.each([
    ['writer', 'SUPERUSER', 'NOSUPERUSER'], ['writer', 'CREATEDB', 'NOCREATEDB'],
    ['writer', 'CREATEROLE', 'NOCREATEROLE'], ['writer', 'REPLICATION', 'NOREPLICATION'],
    ['writer', 'BYPASSRLS', 'NOBYPASSRLS'], ['writer', 'NOLOGIN', 'LOGIN'],
    ['legacy', 'LOGIN', 'NOLOGIN'], ['owner', 'LOGIN', 'NOLOGIN'], ['owner', 'SUPERUSER', 'NOSUPERUSER'],
  ])('%s %s drift is rejected on an already authenticated connection', async (role, change, restore) => {
    const { admin, identities, source, connect } = fixture;
    const library = await source(), { api } = await connect();
    await admin.query(`ALTER ROLE ${identities[role].user} ${change}`);
    try { await expect(api.begin(library)).rejects.toMatchObject({ code: '55000', message: 'ingestion_fence_authority_changed' }); }
    finally { await admin.query(`ALTER ROLE ${identities[role].user} ${restore}`); }
    const run = await api.begin(library);
    await api.finish(run, 0);
  });

  test.each(['writer', 'legacy', 'owner'])('unexpected %s role membership is not ignored when inheritance is disabled', async role => {
    const { admin, identities, source, connect } = fixture;
    const library = await source(), { api } = await connect();
    await admin.query(`GRANT pg_write_all_data TO ${identities[role].user} WITH INHERIT FALSE`);
    try { await expect(api.begin(library)).rejects.toMatchObject({ code: '55000' }); }
    finally { await admin.query(`REVOKE pg_write_all_data FROM ${identities[role].user}`); }
    await api.finish(await api.begin(library), 0);
  });

  test('NOLOGIN alone is insufficient while a reopened legacy session remains connected', async () => {
    const { admin, identities, source, connect } = fixture;
    const library = await source(), { api } = await connect();
    let legacy;
    await admin.query(`ALTER ROLE ${identities.legacy.user} LOGIN`);
    try { legacy = await connect(identities.legacy); }
    finally { await admin.query(`ALTER ROLE ${identities.legacy.user} NOLOGIN`); }
    try { await expect(api.begin(library)).rejects.toMatchObject({ code: '55000' }); }
    finally {
      const { rows: [row] } = await legacy.client.query('SELECT pg_backend_pid() pid');
      await admin.query('SELECT pg_terminate_backend($1,5000)', [row.pid]);
    }
    await api.finish(await api.begin(library), 0);
  });

  test('cached activity in a READ COMMITTED transaction cannot hide a reopened legacy session', async () => {
    const { admin, identities, source, connect } = fixture;
    const library = await source(), { client, api } = await connect(), run = await api.begin(library);
    await client.query('BEGIN');
    await client.query('SELECT pid FROM pg_catalog.pg_stat_activity');
    let legacy;
    try {
      await admin.query(`ALTER ROLE ${identities.legacy.user} LOGIN`);
      try { legacy = await connect(identities.legacy); }
      finally { await admin.query(`ALTER ROLE ${identities.legacy.user} NOLOGIN`); }
      await expect(api.write(run, 'not-written', 'Unsafe write'))
        .rejects.toMatchObject({ code: '55000', message: 'ingestion_fence_authority_changed' });
    } finally {
      await client.query('ROLLBACK');
      if (legacy) {
        const { rows: [row] } = await legacy.client.query('SELECT pg_backend_pid() pid');
        await admin.query('SELECT pg_terminate_backend($1,5000)', [row.pid]);
      }
    }
    await api.finish(run, 0);
  });

  test.each(['REPEATABLE READ', 'SERIALIZABLE'])('%s cannot retain stale catalog evidence', async isolation => {
    const { source, connect } = fixture;
    const library = await source(), { client, api } = await connect();
    await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    try { await expect(client.query('SELECT ingestion_fence_rehearsal.begin_run($1)', [library]))
      .rejects.toMatchObject({ code: '55000', message: 'ingestion_fence_authority_changed' }); }
    finally { await client.query('ROLLBACK'); }
    await api.finish(await api.begin(library), 0);
  });

  test('an unexpected executable routine blocks admission without invoking it', async () => {
    const { admin, source, connect } = fixture;
    const library = await source(), { api } = await connect();
    await admin.query("CREATE FUNCTION public.fence_unreviewed() RETURNS integer LANGUAGE sql AS 'SELECT 1'");
    try { await expect(api.begin(library)).rejects.toMatchObject({ code: '55000' }); }
    finally { await admin.query('DROP FUNCTION public.fence_unreviewed()'); }
    await api.finish(await api.begin(library), 0);
  });

  test('database creation authority and private table ownership invalidate admission', async () => {
    const { admin, identities, database, source, connect } = fixture;
    const library = await source(), { api } = await connect();
    await admin.query(`GRANT CREATE ON DATABASE ${database} TO ${identities.writer.user}`);
    try { await expect(api.begin(library)).rejects.toMatchObject({ code: '55000' }); }
    finally { await admin.query(`REVOKE CREATE ON DATABASE ${database} FROM ${identities.writer.user}`); }
    await admin.query(`ALTER TABLE ingestion_fence_rehearsal.bindings OWNER TO ${identities.writer.user}`);
    try { await expect(api.begin(library)).rejects.toMatchObject({ code: '55000' }); }
    finally { await admin.query(`ALTER TABLE ingestion_fence_rehearsal.bindings OWNER TO ${identities.owner.user}`); }
    await api.finish(await api.begin(library), 0);
  });

  test('a different authenticated login cannot impersonate the registered writer through a definer call', async () => {
    const { admin, source } = fixture;
    const library = await source();
    await admin.query('SELECT pg_advisory_lock($1::integer,$2::integer)', [MEDIA_SYNC_OWNER_LOCK, library]);
    try { await expect(admin.query('SELECT ingestion_fence_rehearsal.begin_run($1)', [library]))
      .rejects.toMatchObject({ code: '55000', message: 'ingestion_fence_authority_changed' }); }
    finally { await admin.query('SELECT pg_advisory_unlock($1::integer,$2::integer)', [MEDIA_SYNC_OWNER_LOCK, library]); }
    expect((await admin.query('SELECT status FROM media_server_sync_status WHERE library_id=$1', [library])).rows)
      .toEqual([{ status: 'running' }]);
  });

  test('ordinary inventory read privileges and temporary objects remain compatible', async () => {
    const { admin, identities, source, connect } = fixture;
    const library = await source(), { client, api } = await connect();
    await admin.query(`GRANT SELECT ON public.media_server_items TO ${identities.writer.user}`);
    try {
      await client.query('CREATE TEMP TABLE cutover(enabled boolean); INSERT INTO cutover VALUES (true)');
      const run = await api.begin(library);
      await api.write(run, 'readable', 'Read permitted');
      expect((await client.query('SELECT title FROM public.media_server_items WHERE library_id=$1', [library])).rows)
        .toEqual([{ title: 'Read permitted' }]);
      await api.finish(run, 1);
      await expect(client.query('SELECT ingestion_fence_rehearsal.assert_authority()')).rejects.toMatchObject({ code: '42501' });
    } finally { await admin.query(`REVOKE SELECT ON public.media_server_items FROM ${identities.writer.user}`); }
  });
});
