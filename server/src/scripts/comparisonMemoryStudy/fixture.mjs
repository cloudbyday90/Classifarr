/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import pg from 'pg';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createInventoryRepresentativeProfileRepository } from '../../services/inventoryRepresentativeProfileRepository.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { INVENTORY_DESCRIPTION_PROJECTION_VERSION } from '../../services/inventoryDescriptionProjection.mjs';

const execute = promisify(execFile);
const run = (command, args) => execute(command, args, { timeout: 30_000, maxBuffer: 1024 * 1024 });

export async function withPrivateStudyLock(pool, key, callback) {
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query('SELECT pg_try_advisory_lock($1) AS locked', [key])).rows[0].locked;
    if (locked) await callback({});
    return locked;
  } finally {
    try { if (locked) await client.query('SELECT pg_advisory_unlock($1)', [key]); }
    finally { client.release(); }
  }
}

/** Synthetic catalog adapter; vector SQL, transactions and advisory locks are real. */
export async function createComparisonMemoryFixture() {
  const directory = await mkdtemp('/tmp/comparison-memory-');
  const rows = Array.from({ length: 5776 }, (_, i) => ({ media_type: i % 10 < 5 ? 'movie' : 'tv',
    tmdb_id: i + 1, library_id: 1 + i % 10, overview: `Synthetic refresh description ${i}` }));
  const identity = { provider: 'ollama', model: 'study:latest', digest: 'a'.repeat(64), dimensions: 1024 };
  const state = { rag_enabled: true, busy: false, primary_provider: 'ollama', embedding_provider_mode: 'same',
    embedding_model: 'study', ollama_host: 'localhost' };
  let child, pool, childError;
  const close = async () => {
    try { await pool?.end(); }
    finally {
      if (child?.pid && child.exitCode === null) await run('pg_ctl', ['-D', directory, '-m', 'fast', '-w', 'stop']);
    }
  };
  try {
    await run('initdb', ['-D', directory, '-U', 'study', '-A', 'trust', '--no-locale']);
    child = spawn('postgres', ['-D', directory, '-k', directory, '-c', 'listen_addresses=',
      '-c', 'shared_buffers=32MB'], { stdio: 'ignore' });
    child.on('error', error => { childError = error; });
    pool = new pg.Pool({ host: directory, user: 'study', database: 'postgres', max: 3, connectionTimeoutMillis: 1000 });
    for (let attempt = 0; ; attempt++) {
      if (childError) throw childError;
      if (child.exitCode !== null) throw new Error('comparison_memory_database_exited');
      try { await pool.query('SELECT 1'); break; }
      catch (error) { if (attempt >= 60) throw error; await delay(100); }
    }
    await pool.query('CREATE EXTENSION vector');
    await pool.query(`CREATE TABLE inventory_description_vector_cache
      (projection_version text, model_name text, model_digest text, dimensions int,
       description_hash text PRIMARY KEY, embedding vector, created_at timestamptz default now())`);
    await pool.query(`INSERT INTO inventory_description_vector_cache SELECT $1,$2,$3,$4,h,
      ARRAY(SELECT (sin(d * (1 + i % 10)) + 0.05 * cos(d + i))::real
        FROM generate_series(1,1024) d)::vector,now()
      FROM unnest($5::text[]) WITH ORDINALITY AS x(h,i)`,
    [INVENTORY_DESCRIPTION_PROJECTION_VERSION, identity.model, identity.digest, identity.dimensions,
      [...prepareInventoryDescriptionCorpus(rows).texts.keys()]]);
    const database = {
      async withTransaction(callback) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await callback({ query: async (sql, params) => {
            if (sql.includes('FROM inventory_description_vector_cache')) return client.query(sql, params);
            if (sql.includes('FROM ai_provider_config')) return { rows: [state] };
            if (sql.includes('FROM libraries') && !sql.includes('FROM media_server_items')) {
              return { rows: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, media_type: i < 5 ? 'movie' : 'tv' })) };
            }
            if (sql.includes('FROM media_server_items')) return { rows };
            return client.query(sql, params);
          } });
          await client.query('COMMIT'); return result;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      },
      withSessionAdvisoryLock: (key, callback) => withPrivateStudyLock(pool, key, callback),
    };
    return { identity, state, database, repository: createInventoryRepresentativeProfileRepository(database), close,
      async omitDescriptions() {
        const hashes = [...prepareInventoryDescriptionCorpus(rows).texts.keys()].slice(-1000);
        await pool.query('DELETE FROM inventory_description_vector_cache WHERE description_hash=ANY($1::text[])', [hashes]);
      },
      async changeDescription(cycle) {
        const oldHash = prepareInventoryDescriptionCorpus([rows[0]]).documents[0].hash;
        rows[0].overview = `Synthetic changed refresh description ${cycle}`;
        const newHash = prepareInventoryDescriptionCorpus([rows[0]]).documents[0].hash;
        await pool.query('UPDATE inventory_description_vector_cache SET description_hash=$2 WHERE description_hash=$1', [oldHash, newHash]);
      } };
  } catch (error) { await close(); throw error; }
}
