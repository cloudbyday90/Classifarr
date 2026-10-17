/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { ARCHIVE_TABLES } from './archiveTables.mjs';
import { CATALOG_TABLES } from './catalogContract.mjs';
import { gatewayError } from './errors.mjs';

const guards = Object.freeze([
  ['gateway_archive.protection', 'archive_protection_guard'],
  ['gateway_archive.protection', 'archive_protection_fence'],
  ['gateway_archive.protection', 'protection_cleanup_exclusion'],
  ['gateway_archive.job', 'archive_job_protection_guard'],
  ['gateway_archive.job', 'archive_cleanup_exclusion'],
]);

/** Only on the fresh, private verifier database. Never install these changes on a source. */
export async function prepareCatalogRestore(client) {
  await client.query(await readFile('/app/database/ollama-gateway-archive/current.sql', 'utf8'));
  await client.query(await readFile('/app/database/ollama-gateway-cleanup/current.sql', 'utf8'));
  for (const [table, trigger] of guards) await client.query(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
  await client.query(`DO $$ DECLARE r record; BEGIN FOR r IN
    SELECT conrelid::regclass AS relation,conname FROM pg_constraint
    WHERE connamespace IN ('gateway_archive'::regnamespace,'gateway_cleanup'::regnamespace) AND contype='f'
    LOOP EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED',r.relation,r.conname); END LOOP; END $$`);
}

export async function sealCatalogRestore(client, restricted) {
  for (const [table, trigger] of guards) await client.query(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
  await client.query('REVOKE INSERT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup FROM archive_restore');
  if ((await client.query(`SELECT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('ollama_gateway','gateway_archive','gateway_cleanup')
    AND NOT t.tgisinternal AND t.tgenabled<>'O') AS disabled`)).rows[0].disabled) throw gatewayError('gateway_catalog_restore_guards');
  // This is the actual unprivileged login, not SET ROLE on the owner connection.
  await restricted.connect();
  try {
    for (const table of [...ARCHIVE_TABLES.map(name => `ollama_gateway.${name}`), ...CATALOG_TABLES]) {
      for (const query of [`DELETE FROM ${table} WHERE false`, `UPDATE ${table} SET id=id WHERE false`]) {
        try { await restricted.query(query); throw gatewayError('gateway_catalog_restore_guards'); }
        catch (error) { if (error.code !== '42501') throw error; }
      }
    }
    try { await restricted.query('SELECT gateway_cleanup.reconcile(NULL)'); throw gatewayError('gateway_catalog_restore_guards'); }
    catch (error) { if (error.code !== '42501') throw error; }
  } finally { await restricted.end(); }
}
