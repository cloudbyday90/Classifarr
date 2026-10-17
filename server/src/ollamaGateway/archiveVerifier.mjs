/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import pg from 'pg';
import { ARCHIVE_TABLES } from './archiveContract.mjs';
import { captureArchiveContent, preservesArchiveContent } from './archiveContent.mjs';
import { archiveDirectory, readVerifiedGatewayArchive } from './archiveFiles.mjs';
import { gatewayError } from './errors.mjs';
import { verifyRestoredRetention } from './archiveRetentionVerification.mjs';
import { stageArchiveRestoreInput } from './archiveRestoreInput.mjs';
import { prepareCatalogRestore, sealCatalogRestore } from './catalogRestore.mjs';
import { captureCatalogContent } from './catalogContent.mjs';
import { checkCatalogRelationships } from './catalogRelationships.mjs';
import { inspectCatalogDependencies } from './catalogDependencies.mjs';
import { requiredCatalogArchives } from './catalogRecoveryFiles.mjs';
import { catalogSemanticRevision } from './catalogSchedule.mjs';

const environment = Object.freeze({ PATH: '/usr/bin:/bin', LANG: 'C', PGPASSFILE: '/dev/null', PGCONNECT_TIMEOUT: '5' });
async function command(executable,args,signal) {
  signal?.throwIfAborted();
  const child = spawn(executable,args,{ env: environment,stdio: 'ignore',shell: false });
  const abort = () => child.kill('SIGKILL');
  const timer = setTimeout(abort,60000); signal?.addEventListener('abort',abort,{ once: true });
  try {
    const code = await new Promise((resolve,reject) => { child.once('error',reject); child.once('close',resolve); });
    signal?.throwIfAborted(); if (code !== 0) throw gatewayError('gateway_archive_restore_failed');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); }
}

/** Only invoke in the network-none verifier container, never in the coordinator or live DB container. */
export async function verifyArchiveRestore(directory,scratch,signal,catalog = null) {
  const { manifest,manifestSha256 } = await readVerifiedGatewayArchive(directory,signal);
  if (![3, 4, 5, 6].includes(manifest.version) || ([5, 6].includes(manifest.version) &&
      (!catalog || Object.keys(catalog).sort().join(',') !== 'archives,receipts')) || (![5, 6].includes(manifest.version) && catalog)) {
    throw gatewayError('gateway_archive_restore_contract');
  }
  scratch = await archiveDirectory(scratch);
  const workspace = await mkdtemp(join(scratch,'gateway-verify-'));
  let postgres, client, closed, retentionSha256 = null, verified = false, catalogRestored = false; const preserves = [];
  try {
    const restoreInput = await stageArchiveRestoreInput(directory,workspace,manifest.dump,signal);
    const databaseDirectory = join(workspace,'postgres');
    await command('/usr/libexec/postgresql18/initdb',['-D',databaseDirectory,'-U','archive_owner','-A','trust','--no-locale','--encoding=UTF8'],signal);
    postgres = spawn('/usr/libexec/postgresql18/postgres',['-D',databaseDirectory,'-k',workspace,'-c','listen_addresses=',
      '-c','shared_buffers=32MB','-c','max_connections=8','-c','work_mem=4MB','-c','temp_file_limit=131072'],
    { env: environment,stdio: 'ignore',shell: false });
    closed = new Promise(resolve => { postgres.once('error',() => resolve(null)); postgres.once('close',resolve); });
    for (let tries = 0; ; tries++) {
      signal?.throwIfAborted();
      client = new pg.Client({ host: workspace,user: 'archive_owner',database: 'postgres',connectionTimeoutMillis: 1000,
        statement_timeout: 4000,query_timeout: 5000 });
      client.on('error',() => {});
      try { await client.connect(); break; } catch {
        await client.end(); client = null;
        if (tries >= 100 || postgres.exitCode !== null || postgres.signalCode !== null) throw gatewayError('gateway_archive_restore_failed');
        await delay(100,undefined,{ signal });
      }
    }
    const schema = await readFile('/app/database/ollama-gateway/current.sql','utf8');
    await client.query(schema);
    if (catalog) await prepareCatalogRestore(client, manifest.catalog.version);
    await client.query('DELETE FROM ollama_gateway.admission');
    // Fixed packaged schema, not SQL from the archive. FK cycles are checked at restore commit.
    await client.query(`DO $$ DECLARE r record; BEGIN FOR r IN
      SELECT conrelid::regclass AS relation,conname FROM pg_constraint
      WHERE connamespace='ollama_gateway'::regnamespace AND contype='f'
      LOOP EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED',r.relation,r.conname); END LOOP; END $$`);
    await client.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC; REVOKE TEMP ON DATABASE postgres FROM PUBLIC;
      CREATE ROLE archive_restore LOGIN; GRANT CONNECT ON DATABASE postgres TO archive_restore;
      GRANT USAGE ON SCHEMA ollama_gateway TO archive_restore;
      GRANT INSERT,SELECT ON ALL TABLES IN SCHEMA ollama_gateway TO archive_restore`);
    if (catalog) await client.query(`GRANT USAGE ON SCHEMA gateway_archive,gateway_cleanup TO archive_restore;
      GRANT INSERT,SELECT ON ALL TABLES IN SCHEMA gateway_archive,gateway_cleanup TO archive_restore`);
    if (manifest.version === 6) await client.query('GRANT USAGE ON SCHEMA gateway_catalog TO archive_restore; GRANT INSERT,SELECT ON gateway_catalog.job TO archive_restore');
    await command('/usr/bin/pg_restore',['--data-only','--no-owner','--no-acl','--no-comments','--no-security-labels',
      '--exit-on-error','--single-transaction','--no-password','-h',workspace,'-U','archive_restore','-d','postgres',restoreInput],signal);
    if (catalog) await sealCatalogRestore(client, new pg.Client({ host: workspace,user: 'archive_restore',database: 'postgres',
      connectionTimeoutMillis: 1000,statement_timeout: 4000,query_timeout: 5000 }), manifest.catalog.version);
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
    const budget = { bytes: 0, ...(catalog ? { rowLimit: 131072 } : {}) };
    if (!isDeepStrictEqual(await captureArchiveContent(client,signal,null,budget),manifest.content)) throw gatewayError('gateway_archive_restore_mismatch');
    if ([4, 5, 6].includes(manifest.version)) retentionSha256 = await verifyRestoredRetention(client,manifest,signal);
    if (catalog) {
      if (!isDeepStrictEqual(await captureCatalogContent(client,signal,budget,manifest.catalog.version),manifest.catalog.tables)) throw gatewayError('gateway_archive_restore_mismatch');
      if (manifest.version === 6 && catalogSemanticRevision(manifest.catalog.tables) !== manifest.catalog.semanticSha256) throw gatewayError('gateway_archive_restore_mismatch');
      await checkCatalogRelationships(client,manifest.archiveId,manifest.report,manifest.catalog.version);
      catalogRestored = true;
      const selected = manifest.version === 6 ? await requiredCatalogArchives(client) : null;
      if (!isDeepStrictEqual(await inspectCatalogDependencies(client,catalog.archives,catalog.receipts,signal,null,selected),manifest.catalog.dependencies)) {
        throw gatewayError('gateway_catalog_dependency');
      }
    }
    for (const prior of manifest.predecessors) {
      const prefix = await captureArchiveContent(client,signal,prior.content);
      if (preservesArchiveContent(prefix,prior.content)) preserves.push(prior.archiveId);
    }
    await client.query('COMMIT');
    for (const name of ARCHIVE_TABLES.filter(table => table !== 'admission')) {
      try { await client.query(`DELETE FROM ollama_gateway.${name} WHERE false`); throw gatewayError('gateway_archive_restore_mutable'); }
      catch (error) { if (error.code !== '42501') throw error; }
    }
    const after = await readVerifiedGatewayArchive(directory,signal);
    if (after.manifestSha256 !== manifestSha256) throw gatewayError('gateway_archive_restore_mismatch');
    verified = true;
  } catch { verified = false; }
  finally {
    try { await client?.end(); } finally {
      let timer;
      if (postgres && postgres.exitCode === null && postgres.signalCode === null) {
        postgres.kill('SIGINT'); timer = setTimeout(() => postgres.kill('SIGKILL'),10000);
      }
      try { await closed; } finally { clearTimeout(timer); }
      if (postgres?.signalCode) throw gatewayError('gateway_archive_restore_stop_unconfirmed');
      // Only this invocation's mkdtemp directory, after its postgres process has exited.
      if (dirname(workspace) !== scratch || !workspace.startsWith(join(scratch,'gateway-verify-'))) throw gatewayError('gateway_archive_file_invalid');
      await rm(workspace,{ recursive: true,force: false });
    }
  }
  signal?.throwIfAborted();
  if (catalog) return { kind: 'catalog_verification',version: 1,archiveId: manifest.archiveId,manifestSha256,
    dumpSha256: manifest.dump.sha256,rowsRestored: catalogRestored,dependenciesAvailable: verified,
    runtimeEnabled: false,purgeAuthorized: false };
  return { version: manifest.version === 4 ? 2 : 1,archiveId: manifest.archiveId,manifestSha256,dumpSha256: manifest.dump.sha256,
    verified,preserves: verified ? preserves : [],purgeAuthorized: false,
    ...(manifest.version === 4 ? { retentionSha256: verified ? retentionSha256 : null } : {}) };
}
