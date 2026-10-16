/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { archiveJobRepository } from '/app/src/ollamaGateway/archiveJobRepository.mjs';
import { cleanupRepository,lockCleanupWorker } from '/app/src/ollamaGateway/cleanupRepository.mjs';
import { archivePolicyHash } from '/app/src/ollamaGateway/archiveSchedule.mjs';
import { checkCleanupRole } from '/app/src/ollamaGateway/cleanupConfiguration.mjs';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';

export async function setupCleanupQualification(client,database) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
  await client.query(await readFile('/app/database/ollama-gateway-cleanup/current.sql','utf8'));
  await client.query(`CREATE ROLE qualification_cleanup LOGIN;
    GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO qualification_cleanup;
    GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO qualification_cleanup;
    GRANT EXECUTE ON FUNCTION gateway_cleanup.admit(uuid,text,text,text),gateway_cleanup.execute_batch(uuid,integer),
      gateway_cleanup.reconcile(uuid) TO qualification_cleanup;
    GRANT USAGE ON SCHEMA gateway_cleanup TO qualification_writer;
    GRANT SELECT ON gateway_cleanup.operation TO qualification_writer`);
  await writeFile('/configuration/cleanup.json',JSON.stringify({ database: { host: '/source-socket',database,user: 'qualification_cleanup' },
    providerHash: 'e'.repeat(64),retentionDays: 90,archives: '/archives',receipts: '/receipts' }),{ mode: 0o600,flag: 'wx' });
}

export async function cleanupQualificationAction(client,action,database) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
  const jobs = await archiveJobRepository(client).list(), held = jobs.filter(job => job.recovery_protection_id);
  const marker = `/archives/gateway-archive-${held[0].id}/protection.json`;
  if (action === 'cleanup-tamper') {
    await writeFile('/configuration/marker-copy.json',await readFile(marker),{ mode: 0o600,flag: 'wx' });
    await writeFile(marker,'{}');
  } else if (action === 'cleanup-repair-fixture') {
    await writeFile(marker,await readFile('/configuration/marker-copy.json'));
  } else if (action === 'cleanup-commit-cut') {
    // A reconstructed post-commit cutpoint using packaged routines, not a production hook or elapsed cooldown.
    await client.query('SELECT pg_advisory_unlock(11435,4)');
    const worker = new pg.Client({ host: '/var/run/postgresql',database,user: 'qualification_cleanup',statement_timeout: 1000 });
    try {
      await worker.connect(); await checkCleanupRole(worker); await lockCleanupWorker(worker); await worker.query('SELECT pg_advisory_lock(11435,4)');
      const repository = cleanupRepository(worker), op = await repository.admit(held.at(-1).protection,archivePolicyHash(90));
      const completed = await repository.execute(op);
      assert.equal(completed.deleted_bindings,100); assert.equal(completed.confirmed_at,null);
    } finally { await worker.end(); }
  } else if (action === 'cleanup-top-up') {
    const ledger = await openGatewayLedger(client,'e'.repeat(64));
    for (let i=0;i<98;i++) {
      const request = await ledger.claim('synthetic'); await ledger.complete(request,false,{ state: 'response_completed',httpStatus: 200 });
    }
  } else if (action === 'cleanup-inspect') {
    return { operations: (await client.query('SELECT * FROM gateway_cleanup.operation ORDER BY id')).rows };
  } else throw new Error('cleanup_qualification_action_invalid');
  return {};
}
