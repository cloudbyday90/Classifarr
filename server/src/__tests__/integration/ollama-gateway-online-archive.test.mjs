/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { getPool } from './setup.mjs';
import { createOllamaApplicationFixture } from './helpers/ollamaApplicationFixture.mjs';
import { withOnlineArchiveSnapshot } from '../../ollamaGateway/onlineArchive.mjs';
import { captureArchiveContent,preservesArchiveContent } from '../../ollamaGateway/archiveContent.mjs';
import { archiveJobRepository,lockArchiveCoordinator } from '../../ollamaGateway/archiveJobRepository.mjs';
import { archiveDue,archivePolicyHash } from '../../ollamaGateway/archiveSchedule.mjs';

let fixture,source,maintenance,configuration,repository;
beforeEach(async () => {
  fixture = await createOllamaApplicationFixture(getPool());
  await getPool().query('DROP SCHEMA IF EXISTS gateway_archive CASCADE');
  await getPool().query(await readFile(new URL('../../../../database/ollama-gateway-archive/current.sql',import.meta.url),'utf8'));
  source = await getPool().connect(); maintenance = await getPool().connect();
  configuration = { providerHash: (await source.query('SELECT provider_hash FROM ollama_gateway.admission')).rows[0].provider_hash,retentionDays: 90 };
  repository = archiveJobRepository(maintenance); await lockArchiveCoordinator(maintenance);
});
afterEach(async () => { source?.release(true); maintenance?.release(true); await fixture?.close(); });
const inspect = consume => withOnlineArchiveSnapshot(source,configuration,consume);
test('online snapshot does not acquire the inference lock; concurrent real admissions continue',async () => {
  await inspect(async first => {
    expect(first.report.counts.request_binding).toBe(0);
    const before = await captureArchiveContent(source);
    const claim = await fixture.ledger.claim('local'); expect(claim).toBeTruthy();
    const after = await captureArchiveContent(source); expect(after).toEqual(before);
    expect(fixture.calls).toHaveLength(0);
  });
  await inspect(async next => { expect(next.report.counts.request_binding).toBe(1); });
});
test('online transaction cannot write and cancellation discards the snapshot',async () => {
  await expect(inspect(async () => { await source.query('UPDATE ollama_gateway.admission SET attempts=0'); })).rejects.toMatchObject({ code: '25006' });
  const signal = AbortSignal.abort();
  await expect(withOnlineArchiveSnapshot(source,configuration,async () => {},signal)).rejects.toThrow();
  expect((await source.query('SELECT 1 AS n')).rows[0].n).toBe(1);
});
test('separate coordinator lock prevents duplicate maintenance without blocking inference',async () => {
  const other = await getPool().connect();
  try { await expect(lockArchiveCoordinator(other)).rejects.toThrow('gateway_archive_coordinator_running'); }
  finally { other.release(true); }
  await expect(lockArchiveCoordinator(maintenance)).rejects.toThrow('gateway_archive_coordinator_running');
  await expect(fixture.ledger.claim('local')).resolves.toBeTruthy();
});
test('native UUIDv7 jobs preserve attempts and cooldowns after reconnect; three is the lifetime revision limit',async () => {
  await fixture.ledger.claim('local');
  const { report,revision } = await inspect(async value => value);
  for (let attempt=1;attempt<=3;attempt++) {
    const job = await repository.begin(report,revision,archivePolicyHash(90));
    expect(job.id).toMatch(/^[a-f0-9-]{14}7/); expect(job.attempt).toBe(attempt);
    await repository.failed(job.id,'export_failed');
  }
  maintenance.release(true); maintenance = await getPool().connect();
  await lockArchiveCoordinator(maintenance); repository = archiveJobRepository(maintenance);
  const jobs = await repository.list(); expect(jobs).toHaveLength(3); expect(jobs.every(job => job.retry_after > job.completed_at)).toBe(true);
  expect(archiveDue({ report,revision,jobs,now: Date.now()+86400000 })).toBe('attempts_exhausted');
  await expect(repository.begin(report,revision,archivePolicyHash(90))).rejects.toMatchObject({ code: '23514' });
  expect((await source.query('SELECT attempts::text FROM ollama_gateway.admission')).rows[0].attempts).toBe('1');
});
test('interrupted exports cannot be admitted again merely because ownership expired',async () => {
  await fixture.ledger.claim('local'); const { report,revision } = await inspect(async value => value);
  const job = await repository.begin(report,revision,archivePolicyHash(90));
  await repository.interrupted(); const jobs = await repository.list(); expect(jobs[0].status).toBe('interrupted');
  expect(archiveDue({ report,revision,jobs,now: Date.now()+999999999 })).toBe('pending');
  await expect(repository.begin(report,'f'.repeat(64),archivePolicyHash(90))).rejects.toMatchObject({ code: '23505' });
  await expect(repository.published(job.id,{ manifestSha256:'a'.repeat(64),manifest:{} })).rejects.toThrow('gateway_archive_job_fence');
});
test('full fingerprints detect content differences and prefix proof tolerates newer rows',async () => {
  await fixture.ledger.claim('local');
  const before = await inspect(() => captureArchiveContent(source));
  await getPool().query(`INSERT INTO ollama_gateway.completion_receipt(request_id,outcome)
    SELECT request_id,'completion_observed' FROM ollama_gateway.request_binding`);
  await inspect(async () => {
    const full = await captureArchiveContent(source), prefix = await captureArchiveContent(source,undefined,before);
    expect(full.completion_receipt.count).toBe(1); expect(preservesArchiveContent(full,before)).toBe(false);
    expect(preservesArchiveContent(prefix,before)).toBe(true);
  });
});
