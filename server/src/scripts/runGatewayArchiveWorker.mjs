/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import pg from 'pg';
import { setTimeout as delay } from 'node:timers/promises';
import { readGatewayPrivateDocument } from '../ollamaGateway/privateDocument.mjs';
import { archiveWorkerConfiguration,checkArchiveRole } from '../ollamaGateway/archiveWorkerConfiguration.mjs';
import { lockArchiveCoordinator,archiveJobRepository } from '../ollamaGateway/archiveJobRepository.mjs';
import { runArchiveAssessment } from '../ollamaGateway/archiveCoordinator.mjs';
import { ARCHIVE_POLICY } from '../ollamaGateway/archiveSchedule.mjs';
import { withArchiveMaintenance } from '../ollamaGateway/archiveMaintenanceLock.mjs';

const controller = new AbortController();
process.once('SIGINT',() => controller.abort()); process.once('SIGTERM',() => controller.abort());
let source,maintenance,previous;
try {
  const once = process.argv.length === 3 && process.argv[2] === '--once';
  if (process.platform !== 'linux' || (!once && process.argv.length !== 2)) throw new Error();
  const configuration = archiveWorkerConfiguration(await readGatewayPrivateDocument(process.env.CLASSIFARR_GATEWAY_ARCHIVE_WORKER_CONFIG_FILE));
  const connection = (database,readOnly) => new pg.Client({ ...database,password: database.password ?? '',ssl: false,
    connectionTimeoutMillis: 5000,statement_timeout: 4000,query_timeout: 5000,
    application_name: readOnly ? 'classifarr-gateway-archive-source' : 'classifarr-gateway-archive-coordinator',
    options: readOnly ? '-c default_transaction_read_only=on' : undefined });
  source = connection(configuration.source.database,true); maintenance = connection(configuration.maintenance,false);
  for (const client of [source,maintenance]) { client.on('error',() => controller.abort()); await client.connect(); }
  await checkArchiveRole(source,true); await checkArchiveRole(maintenance);
  await lockArchiveCoordinator(maintenance);
  const repository = archiveJobRepository(maintenance); await repository.assertSchema(); let initialized = false;
  while (!controller.signal.aborted) {
    const deadline = AbortSignal.timeout(120000), signal = AbortSignal.any([controller.signal,deadline]);
    let result;
    try { result = await withArchiveMaintenance(maintenance,async () => {
      if (!initialized) { await repository.interrupted(); initialized = true; }
      return runArchiveAssessment({ source,repository,configuration: configuration.source,
        parent: configuration.archives,receipts: configuration.receipts,signal });
    }); }
    catch (error) {
      const safe = ['gateway_archive_receipt_invalid','gateway_archive_job_fence','gateway_archive_rotation_blocked',
        'gateway_archive_file_invalid','gateway_archive_verification_failed','gateway_archive_unmanaged_files',
        'gateway_archive_storage_blocked','gateway_archive_job_capacity','gateway_archive_source_inconsistent',
        'gateway_archive_protection_fence'];
      result = { state: 'archive_blocked',reason: safe.includes(error.code) ? error.code : 'gateway_archive_unavailable',purgeAuthorized: false };
    }
    const text = JSON.stringify(result);
    if (text !== previous) { process.stdout.write(`${text}\n`); previous = text; }
    if (once) break;
    await delay(ARCHIVE_POLICY.assessmentMs,undefined,{ signal: controller.signal });
  }
} catch { if (!controller.signal.aborted) { process.stderr.write('gateway_archive_worker_unavailable\n'); process.exitCode = 1; } }
finally {
  controller.abort(); await Promise.allSettled([source?.end(),maintenance?.end()]);
}
