/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import pg from 'pg';
import { setTimeout as delay } from 'node:timers/promises';
import { readGatewayPrivateDocument } from '../ollamaGateway/privateDocument.mjs';
import { cleanupConfiguration,checkCleanupRole } from '../ollamaGateway/cleanupConfiguration.mjs';
import { lockCleanupWorker } from '../ollamaGateway/cleanupRepository.mjs';
import { withArchiveMaintenance } from '../ollamaGateway/archiveMaintenanceLock.mjs';
import { runCleanupAssessment } from '../ollamaGateway/cleanupService.mjs';
import { cleanupFailureReason } from '../ollamaGateway/cleanupFailure.mjs';

const controller = new AbortController();
process.once('SIGINT',() => controller.abort()); process.once('SIGTERM',() => controller.abort());
let client,previous;
try {
  const once = process.argv.length === 3 && process.argv[2] === '--once';
  if (process.platform !== 'linux' || (!once && process.argv.length !== 2)) throw new Error();
  const configuration = cleanupConfiguration(await readGatewayPrivateDocument(process.env.CLASSIFARR_GATEWAY_CLEANUP_CONFIG_FILE));
  while (!controller.signal.aborted) {
    const signal = AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]);
    let result;
    try {
      client = new pg.Client({ ...configuration.database,password: configuration.database.password ?? '',ssl: false,
        // Real image tests include cold trigger setup and FK checks. Keep transport timeout above SQL cancellation.
        connectionTimeoutMillis: 5000,statement_timeout: 3000,query_timeout: 5000,lock_timeout: 100,
        application_name: 'classifarr-gateway-cleanup' });
      client.on('error',() => {}); await client.connect();
      await checkCleanupRole(client); await lockCleanupWorker(client);
      result = await withArchiveMaintenance(client,() => runCleanupAssessment({ client,configuration,signal }));
    } catch (error) {
      result = { state: 'cleanup_blocked',reason: cleanupFailureReason(error) };
    } finally {
      // Release this session even after an ambiguous query timeout. A later session must acquire the lock
      // and reconcile durable state before another attempt; connection errors never authorize replay.
      await client?.end(); client = null;
    }
    const text = JSON.stringify(result);
    if (text !== previous) { process.stdout.write(`${text}\n`); previous = text; }
    if (once) break;
    await delay(300000,undefined,{ signal: controller.signal });
  }
} catch { if (!controller.signal.aborted) { process.stderr.write('gateway_cleanup_worker_blocked\n'); process.exitCode = 1; } }
finally { controller.abort(); await client?.end(); }
