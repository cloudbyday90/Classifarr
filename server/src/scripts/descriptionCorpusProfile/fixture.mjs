/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const TABLES = new Set(['libraries', 'media_server_items', 'classification_history',
  'media_source_observations', 'source_catalog_mappings']);
const INDEXES = new Set(['idx_classification_history_tmdb', 'idx_media_items_library_order',
  'idx_media_items_tmdb', 'idx_media_items_media_type', 'idx_libraries_active_order',
  'idx_media_source_observations_recent']);

export async function requireProfileDatabase(db) {
  const { rows: [row] } = await db.query('SELECT current_database() AS name');
  if (row?.name !== 'scan_recovery_benchmark' && !/^classifarr_suite_[a-f0-9]{12}$/.test(row?.name ?? '')) {
    throw new Error('corpus_profile_disposable_database_required');
  }
}

export async function installCorpusProfileFixture(db, size, fallback) {
  if (!Number.isInteger(size) || size < 100 || size > 6500 || !['sparse', 'all'].includes(fallback)) {
    throw new Error('corpus_profile_fixture_invalid');
  }
  await requireProfileDatabase(db);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Fixed checked-in schema, no caller-supplied path.
  const source = (await readFile(new URL('../../../../database/schema/current.sql', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  // eslint-disable-next-line security/detect-unsafe-regex -- Fixed local schema (not user input), anchored DDL extraction; shape counts fail closed.
  const tables = [...source.matchAll(/^CREATE TABLE public\.(\w+) \([\s\S]*?^\)(?:\nWITH \([^\n]*\))?;/gm)]
    .filter(match => TABLES.has(match[1]));
  const keys = [...source.matchAll(/^ALTER TABLE ONLY public\.(\w+)\n\s+ADD CONSTRAINT \w+ (?:PRIMARY KEY|UNIQUE) [^;]+;/gm)]
    .filter(match => TABLES.has(match[1]));
  const indexes = [...source.matchAll(/^CREATE (?:UNIQUE )?INDEX (\w+) ON public\.\w+ [^\n]+;/gm)]
    .filter(match => INDEXES.has(match[1]));
  if (tables.length !== TABLES.size || indexes.length !== INDEXES.size || keys.length < TABLES.size) {
    throw new Error('corpus_profile_schema_changed');
  }
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='2s'");
    await db.query('CREATE SCHEMA description_corpus_profile; SET LOCAL search_path=description_corpus_profile,pg_catalog');
    for (const match of [...tables, ...keys, ...indexes]) {
      await db.query(match[0].replaceAll('public.', 'description_corpus_profile.'));
    }
    await db.query(`INSERT INTO libraries(id,external_id,name,media_type,is_active)
      SELECT i,i::text,'Synthetic '||i,CASE WHEN i<=5 THEN 'movie' ELSE 'tv' END,true FROM generate_series(1,10) i`);
    await db.query(`INSERT INTO media_server_items(id,media_server_id,library_id,external_id,tmdb_id,title,media_type,metadata)
      SELECT i,1,(i-1)%10+1,i::text,i,'Synthetic',CASE WHEN (i-1)%10<5 THEN 'movie' ELSE 'tv' END,
        CASE WHEN i <= $2 THEN '{}'::jsonb ELSE jsonb_build_object('overview',
          'Synthetic description '||i||' '||repeat(md5(i::text),32)) END
      FROM generate_series(1,$1::integer) i`, [size, fallback === 'all' ? size : 20]);
    await db.query(`INSERT INTO classification_history(id,tmdb_id,media_type,title,library_id,metadata,created_at)
      SELECT (i-1)*3+n,i,CASE WHEN (i-1)%10<5 THEN 'movie' ELSE 'tv' END,'Synthetic',(i-1)%10+1,
        jsonb_build_object('overview','Synthetic description '||i||' '||repeat(md5(i::text),32)),
        timestamp '2026-10-01' + n*interval '1 second'
      FROM generate_series(1,$1::integer) i CROSS JOIN generate_series(1,3) n`, [size]);
    await db.query(`INSERT INTO media_source_observations(library_id,media_server_id,external_id,identity_issue,generation)
      SELECT (i-1)%10+1,1,i::text,'conflicting_provider_ids',1 FROM generate_series(500,$1::integer,500) i`, [size]);
    for (const table of TABLES) await db.query(`ANALYZE description_corpus_profile.${table}`);
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  return { schemaSha256: createHash('sha256').update(source).digest('hex'), tables: tables.length,
    constraints: keys.length, indexes: indexes.length, size, fallback, expectedRows: size - Math.floor(size / 500) };
}

export async function removeCorpusProfileFixture(db) {
  await requireProfileDatabase(db);
  await db.query('DROP SCHEMA description_corpus_profile CASCADE');
  const { rows: [row] } = await db.query("SELECT to_regnamespace('description_corpus_profile') IS NULL AS clean");
  if (row?.clean !== true) throw new Error('corpus_profile_cleanup_failed');
}
