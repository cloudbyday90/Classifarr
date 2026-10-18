/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import pg from '/app/node_modules/pg/lib/index.js';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';
import { archiveJobRepository } from '/app/src/ollamaGateway/archiveJobRepository.mjs';
import { archivePolicyHash } from '/app/src/ollamaGateway/archiveSchedule.mjs';
import { withOnlineArchiveSnapshot, createOnlineArchive } from '/app/src/ollamaGateway/onlineArchive.mjs';
import { catalogJobRepository } from '/app/src/ollamaGateway/catalogJobRepository.mjs';
import { catalogRetentionRepository, assertArchiveNotCatalogPinned } from '/app/src/ollamaGateway/catalogRetentionRepository.mjs';
import { catalogRetentionService } from '/app/src/ollamaGateway/catalogRetentionService.mjs';
import { validateCatalogVerification } from '/app/src/ollamaGateway/catalogVerificationResult.mjs';
import { catalogDue, catalogSemanticRevision } from '/app/src/ollamaGateway/catalogSchedule.mjs';
import { captureCatalogContent } from '/app/src/ollamaGateway/catalogContent.mjs';
import { captureScheduledCatalog } from '/app/src/ollamaGateway/catalogCapture.mjs';
import { readArchiveReceipt, checkManagedArchive } from '/app/src/ollamaGateway/archiveManagedFiles.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const action = process.argv[2], database = 'gateway_catalog_schedule_fixture';
const paths = { archives: '/archives', receipts: '/receipts', catalogs: '/catalogs' };
const connection = { host: '/var/run/postgresql', user: 'classifarr', database };
const configuration = { database: { ...connection, user: 'catalog_schedule_reader' }, providerHash: 'd'.repeat(64), retentionDays: 90 };
let owner, reader, ledger;
async function worker() {
  const child = spawn(process.execPath, ['/app/src/scripts/runGatewayArchiveWorker.mjs', '--once'], {
    env: { PATH: '/usr/bin:/bin', CLASSIFARR_GATEWAY_ARCHIVE_WORKER_CONFIG_FILE: '/tmp/catalog-schedule-config.json' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', error = '';
  child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { error += data; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 130000);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    assert.equal(code, 0, error); return JSON.parse(output);
  } finally { clearTimeout(timer); }
}
async function addRequest() {
  ledger ??= await openGatewayLedger(owner, configuration.providerHash);
  const request = await ledger.claim('synthetic'); await ledger.complete(request, false, { state: 'response_completed', httpStatus: 200 });
}
try {
  if (action === 'setup') {
    const admin = new pg.Client({ ...connection, database: 'classifarr' }); await admin.connect();
    try { await admin.query(`CREATE DATABASE ${database};`); await admin.query('CREATE ROLE catalog_schedule_reader LOGIN; CREATE ROLE catalog_schedule_writer LOGIN'); }
    finally { await admin.end(); }
  }
  owner = new pg.Client(connection); await owner.connect();
  if (action === 'setup') {
    for (const name of ['ollama-gateway', 'ollama-gateway-archive', 'ollama-gateway-cleanup', 'ollama-gateway-catalog']) {
      await owner.query(await readFile(`/app/database/${name}/current.sql`, 'utf8'));
    }
    await owner.query(`GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive,gateway_cleanup,gateway_catalog TO catalog_schedule_reader;
      GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO catalog_schedule_reader;
      GRANT SELECT ON gateway_catalog.job TO catalog_schedule_reader;
      GRANT USAGE ON SCHEMA gateway_archive,gateway_cleanup,gateway_catalog TO catalog_schedule_writer;
      GRANT SELECT,INSERT,UPDATE ON gateway_archive.job,gateway_catalog.job,gateway_catalog.snapshot TO catalog_schedule_writer;
      GRANT SELECT,INSERT ON gateway_archive.protection,gateway_catalog.dependency TO catalog_schedule_writer;
      GRANT UPDATE(ready_at) ON gateway_archive.protection TO catalog_schedule_writer;
      GRANT SELECT ON gateway_cleanup.operation TO catalog_schedule_writer;
      GRANT EXECUTE ON FUNCTION gateway_catalog.require_lock(),gateway_catalog.capture_format() TO catalog_schedule_writer`);
    await writeFile('/tmp/catalog-schedule-config.json', JSON.stringify({ source: configuration,
      maintenance: { ...connection, user: 'catalog_schedule_writer' }, ...paths }), { mode: 0o600, flag: 'wx' });
    ledger = await openGatewayLedger(owner, configuration.providerHash);
    assert.equal((await worker()).state, 'catalog_empty');
    await addRequest();
    assert.equal((await worker()).state, 'awaiting_verification');
  } else if (action === 'worker') {
    process.stdout.write(`${JSON.stringify(await worker())}\n`);
  } else if (action === 'register-only') {
    await owner.query('SELECT pg_advisory_lock(11435,4)');
    const job = (await catalogJobRepository(owner).list()).find(item => item.status === 'awaiting_verification');
    const receipt = await readArchiveReceipt(paths.receipts, job.id, validateCatalogVerification);
    await catalogRetentionService(owner).retain(paths, job.id, receipt);
    // Deliberate cut between durable registration and acknowledgment; no counter reset.
    assert.equal((await catalogJobRepository(owner).list())[0].status, 'awaiting_verification');
  } else if (action === 'quiet') {
    const before = (await owner.query('SELECT id,attempt,status FROM gateway_catalog.job ORDER BY id')).rows;
    assert.deepEqual(before.map(row => row.attempt), [2, 3]);
    assert.ok(before.every(row => row.status === 'verified'));
    for (let index = 0; index < 3; index++) assert.equal((await worker()).state, 'catalog_unchanged');
    assert.deepEqual((await owner.query('SELECT id,attempt,status FROM gateway_catalog.job ORDER BY id')).rows, before);
    const roots = await catalogRetentionRepository(owner).list(); assert.equal(roots.length, 2);
    assert.ok(roots.every(root => root.manifest.version === 7));
    process.stdout.write('catalog_schedule_initial_and_quiet_passed\n');
  } else if (action === 'inference') {
    await addRequest(); await owner.query('SELECT pg_advisory_lock(11435,4)');
    const repository = archiveJobRepository(owner), jobs = await repository.list();
    const value = await withOnlineArchiveSnapshot(owner, configuration, async data => data);
    const job = await repository.begin(value.report, value.revision, archivePolicyHash(90), value.compatibleRevisions);
    const predecessors = [];
    for (const summary of jobs.filter(item => item.status === 'verified').slice(-2)) {
      const prior=await repository.evidence(summary);
      await checkManagedArchive(paths.archives, prior);
      predecessors.push({ archiveId: prior.id, manifestSha256: prior.manifest_sha256, content: prior.manifest.content });
    }
    reader = new pg.Client(configuration.database); await reader.connect();
    const result = await createOnlineArchive(reader, configuration, paths.archives, job, predecessors, AbortSignal.timeout(120000));
    await repository.published(job.id, result); assert.equal(job.attempt, 1);
    process.stdout.write(`${job.id}\n`);
  } else if (action === 'accept-inference') {
    await owner.query('SELECT pg_advisory_lock(11435,4)');
    const repository = archiveJobRepository(owner), job = (await repository.list()).find(item => item.status === 'awaiting_verification');
    const receipt = await readArchiveReceipt(paths.receipts, job.id); assert.equal(receipt.verified, true);
    await repository.verified(job.id, receipt);
  } else if (action === 'refresh') {
    await owner.query('SELECT pg_advisory_lock(11435,4)');
    const inferenceJobs = await archiveJobRepository(owner).list(), jobsRepository = catalogJobRepository(owner);
    const jobs = await jobsRepository.list(), roots = await catalogRetentionRepository(owner).list();
    const snapshot = await withOnlineArchiveSnapshot(owner, configuration, async value => ({ ...value,
      semantic: catalogSemanticRevision(await captureCatalogContent(owner, undefined, { bytes: 0 })) }));
    // Advance only the pure scheduling observation. No durable deadline/attempt is rewritten.
    assert.equal(catalogDue({ ...snapshot, jobs, inferenceJobs, roots, now: Date.parse(snapshot.report.capturedAt) + 86400001 }), 'due');
    const job = await jobsRepository.begin(snapshot.report, snapshot.revision, archivePolicyHash(90), snapshot.semantic, snapshot.compatibleRevisions);
    reader = new pg.Client(configuration.database); await reader.connect();
    await jobsRepository.published(job.id, await captureScheduledCatalog({ source: reader, maintenance: owner, configuration, paths, job, signal: AbortSignal.timeout(120000) }));
    assert.equal(job.attempt, 2);
  } else if (action === 'handoff') {
    await owner.query('SELECT pg_advisory_lock(11435,4)');
    const jobs = await archiveJobRepository(owner).list(), first = jobs[0];
    assert.equal(first.status, 'retired');
    await assertArchiveNotCatalogPinned(owner, first.id);
    await assert.rejects(stat(`/archives/gateway-archive-${first.id}`), { code: 'ENOENT' });
    const roots = await catalogRetentionRepository(owner).list(); assert.equal(roots.length, 2);
    for (const root of roots) {
      assert.ok(!(await catalogRetentionRepository(owner).entries(root.id)).some(entry => entry.id === first.id));
      assert.equal(root.manifest.catalog.tables['gateway_archive.job'].count, 3);
    }
    const attempts = (await owner.query('SELECT attempt FROM gateway_catalog.job ORDER BY created_at,id')).rows.map(row => row.attempt);
    assert.deepEqual(attempts, [2, 3, 2, 3]);
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM gateway_catalog.snapshot')).rows[0].n, 4);
    process.stdout.write('catalog_schedule_handoff_passed: original history retained; obsolete files released only after two replacements; shared attempts preserved\n');
  } else throw new Error('catalog_scheduling_action_invalid');
} finally { await reader?.end(); await owner?.end(); }
