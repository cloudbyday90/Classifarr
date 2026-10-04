/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { getPool } from '../setup.mjs';
import { readRuntime } from '../runtime.mjs';
import { prepareFenceRehearsal, cutOverFenceRehearsal } from '../../../scripts/ingestionWriterFence/install.mjs';
import { fenceRole } from '../../../scripts/ingestionWriterFence/contract.mjs';
import { createFenceRehearsalClient } from '../../../scripts/ingestionWriterFence/client.mjs';

export async function createIngestionFenceFixture() {
  const admin = await getPool().connect(), clients = new Set();
  let identities;
  const close = async () => {
    try {
      await Promise.allSettled([...clients].map(client => client.end()));
      if (identities) {
        const names = Object.values(identities).map(identity => fenceRole(identity.user));
        const { rows } = await admin.query(`SELECT pg_terminate_backend(pid,5000) stopped FROM pg_stat_activity
          WHERE datname=current_database() AND usename=ANY($1::text[]) AND pid<>pg_backend_pid()`, [names]);
        if (rows.some(row => row.stopped !== true)) throw new Error('fence_fixture_sessions_not_drained');
        await admin.query(`REASSIGN OWNED BY ${names.join(',')} TO CURRENT_USER`);
        await admin.query(`DROP OWNED BY ${names.join(',')}`);
        await admin.query(`DROP ROLE ${names.join(',')}`);
      }
    } finally { admin.release(); }
  };
  try {
    identities = await prepareFenceRehearsal(admin);
    await cutOverFenceRehearsal(admin, identities);
    const runtime = readRuntime();
    const database = (await admin.query('SELECT current_database() name')).rows[0].name;
    const connect = async (identity = identities.writer) => {
      const client = new pg.Client({ host: runtime.host, port: runtime.port, database, ...identity,
        connectionTimeoutMillis: 5000, statement_timeout: 5000 });
      clients.add(client);
      client.on('error', () => {}); // Owned fixture sessions may be explicitly terminated.
      await client.connect();
      return { client, api: createFenceRehearsalClient(client) };
    };
    const source = async () => {
      const { rows: [server] } = await admin.query(`INSERT INTO media_server(type,name,url,api_key)
        VALUES ('plex',$1,$2,'synthetic') RETURNING id`, [randomUUID(), `http://${randomUUID()}.invalid`]);
      const { rows: [library] } = await admin.query(`INSERT INTO libraries(name,external_id,media_type,media_server_id)
        VALUES ($1,$1,'movie',$2) RETURNING id`, [randomUUID(), server.id]);
      await admin.query("INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','running')", [library.id]);
      return library.id;
    };
    return { admin, identities, database, connect, source, close };
  } catch (error) { await close(); throw error; }
}
