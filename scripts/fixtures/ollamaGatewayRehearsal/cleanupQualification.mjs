/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { archiveJobRepository } from '/app/src/ollamaGateway/archiveJobRepository.mjs';
import { cleanupRepository,lockCleanupWorker } from '/app/src/ollamaGateway/cleanupRepository.mjs';
import { archivePolicyHash } from '/app/src/ollamaGateway/archiveSchedule.mjs';
import { checkCleanupRole } from '/app/src/ollamaGateway/cleanupConfiguration.mjs';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';
import { checkManagedArchive,readArchiveReceipt,archiveStorageAvailable,managedArchivePath } from '/app/src/ollamaGateway/archiveManagedFiles.mjs';
import { ensureArchiveProtection } from '/app/src/ollamaGateway/archiveProtectionFiles.mjs';

async function diagnoseCleanup(client,jobs,database) {
  let stage = 'files',worker,settings; const timings = [];
  const operations = (await client.query('SELECT id,status,attempt FROM gateway_cleanup.operation ORDER BY id')).rows;
  try {
    for (const summary of jobs.filter(row => row.status === 'verified')) {
      const job=await archiveJobRepository(client).evidence(summary);
      stage = 'archive'; await checkManagedArchive('/archives',job);
      stage = 'receipt'; assert.deepEqual(await readArchiveReceipt('/receipts',job.id),job.receipt);
      stage = 'marker'; await ensureArchiveProtection(managedArchivePath('/archives',job.id),job);
    }
    stage = 'storage'; assert.equal(await archiveStorageAvailable('/archives','/receipts',jobs),true);
    const op = operations.find(row => row.status === 'admitted');
    if (op) {
      await client.query('SELECT pg_advisory_unlock(11435,4)');
      worker = new pg.Client({ host: '/var/run/postgresql',database,user: 'classifarr',statement_timeout: 1000 });
      await worker.connect(); await lockCleanupWorker(worker); await worker.query('SELECT pg_advisory_lock(11435,4)');
      worker.on('notice',notice => {
        const match = notice.message.match(/^duration: ([0-9.]+) ms\s+plan:\s+([\s\S]+)/);
        if (!match) return;
        const plan = JSON.parse(match[2]), root = plan.Plan;
        if (Number(match[1]) < 10 || timings.length >= 20) return;
        timings.push({ milliseconds: Number(match[1]),type: root['Node Type'],rows: root['Actual Rows'],
          jit: plan.JIT,triggers: plan.Triggers,ioRead: root['I/O Read Time'],ioWrite: root['I/O Write Time'],
          children: root.Plans?.map(child => ({ type: child['Node Type'],
            relation: child['Relation Name'],rows: child['Actual Rows'],loops: child['Actual Loops'],time: child['Actual Total Time'] })) });
      });
      settings = (await worker.query("SELECT current_setting('jit') AS jit,pg_jit_available() AS available,current_setting('shared_buffers') AS buffers")).rows[0];
      await worker.query("LOAD 'auto_explain'; SET auto_explain.log_min_duration=0; SET auto_explain.log_nested_statements=on; SET auto_explain.log_analyze=on; SET auto_explain.log_level=notice; SET auto_explain.log_format=json; SET auto_explain.log_parameter_max_length=0; SET auto_explain.log_triggers=on; SET auto_explain.log_buffers=on; SET track_io_timing=on");
      // Isolated fixture only: diagnose the existing admitted transaction, always rolling every effect back.
      await worker.query('BEGIN; SET LOCAL ROLE qualification_cleanup'); stage = 'execute'; await cleanupRepository(worker).execute(op);
    }
    return { stage,state: 'passed',operations,settings,timings };
  } catch (error) {
    const code = ['57014','55P03','42501','EROFS','EPERM','EINVAL'].includes(error.code) ? error.code :
      /^gateway_[a-z_]+$/.test(error.message) ? error.message : 'unclassified';
    return { stage,state: 'failed',code,operations,settings,timings };
  } finally { if (worker) { await worker.query('ROLLBACK'); await worker.end(); } }
}

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
  if (action === 'cleanup-diagnose') {
    return diagnoseCleanup(client,jobs,database);
  } else if (action === 'cleanup-tamper') {
    await writeFile('/configuration/marker-copy.json',await readFile(marker),{ mode: 0o600,flag: 'wx' });
    await writeFile(marker,'{}');
  } else if (action === 'cleanup-repair-fixture') {
    await writeFile(marker,await readFile('/configuration/marker-copy.json'));
  } else if (action === 'cleanup-commit-cut') {
    // A reconstructed post-commit cutpoint using packaged routines, not a production hook or elapsed cooldown.
    await client.query('SELECT pg_advisory_unlock(11435,4)');
    const worker = new pg.Client({ host: '/var/run/postgresql',database,user: 'qualification_cleanup',statement_timeout: 3000 });
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
  } else if (action === 'cleanup-due') {
    // Advance only the global admission cadence in this isolated fixture. Never reset attempts or recovery clocks.
    assert.equal((await client.query('SELECT count(*)::int AS n FROM gateway_cleanup.operation')).rows[0].n,1);
    await client.query("UPDATE gateway_cleanup.operation SET last_attempt_at=clock_timestamp()-interval '6 minutes' WHERE status='completed'");
  } else if (action === 'cleanup-inspect') {
    return { operations: (await client.query('SELECT * FROM gateway_cleanup.operation ORDER BY id')).rows };
  } else throw new Error('cleanup_qualification_action_invalid');
  return {};
}
