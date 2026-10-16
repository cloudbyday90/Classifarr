/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import pg from 'pg';
import { readGatewayPrivateDocument } from '../ollamaGateway/privateDocument.mjs';
import { gatewayArchiveConfiguration } from '../ollamaGateway/archiveContract.mjs';
import { withGatewayArchiveSnapshot } from '../ollamaGateway/archiveRepository.mjs';
import { createGatewayArchive } from '../ollamaGateway/archiveService.mjs';
import { verifyGatewayArchive } from '../ollamaGateway/archiveFiles.mjs';
import { reviewGatewayArchive } from '../ollamaGateway/archiveReviewService.mjs';

// Linux/local socket only. Usage: inspect | create <parent> | verify <archive> | review <archive> <trusted-manifest-sha256>.
// Env: CLASSIFARR_GATEWAY_ARCHIVE_CONFIG_FILE (inspect/create/review). No cleanup, restore or purge.
const controller = new AbortController();
process.once('SIGINT', () => controller.abort()); process.once('SIGTERM', () => controller.abort());
const abortTimer = setTimeout(() => controller.abort(), 90000);
// eslint-disable-next-line n/no-process-exit -- bound filesystem/database stalls after cancellation; partial output has no valid completion marker.
const deadline = setTimeout(() => { process.stderr.write('gateway_archive_deadline\n'); process.exit(1); }, 120000);
let client;
try {
  const [action, path, trustedHash, ...extra] = process.argv.slice(2);
  if (process.platform !== 'linux' || extra.length || !['inspect', 'create', 'verify', 'review'].includes(action) ||
      (action === 'review' ? !trustedHash : trustedHash !== undefined) ||
      (action === 'inspect' ? path !== undefined : !path)) throw new Error();
  let result;
  if (action === 'verify') result = await verifyGatewayArchive(path, controller.signal);
  else {
    const configuration = gatewayArchiveConfiguration(await readGatewayPrivateDocument(process.env.CLASSIFARR_GATEWAY_ARCHIVE_CONFIG_FILE));
    client = new pg.Client({ ...configuration.database, port: configuration.database.port ?? 5432,
      password: configuration.database.password ?? '', ssl: false, connectionTimeoutMillis: 5000, query_timeout: 5000,
      statement_timeout: 4000, options: '-c default_transaction_read_only=on', application_name: 'classifarr-gateway-offline-archive' });
    client.on('error', () => controller.abort()); await client.connect();
    result = action === 'inspect' ? await withGatewayArchiveSnapshot(client, { ...configuration, signal: controller.signal }) :
      action === 'review' ? await reviewGatewayArchive(client, configuration, path, trustedHash, controller.signal) :
        await createGatewayArchive(client, configuration, path, controller.signal);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const safe = ['gateway_archive_config_invalid', 'gateway_archive_file_invalid', 'gateway_archive_gateway_running',
    'gateway_archive_dedicated_session_required', 'gateway_archive_ledger_unavailable', 'gateway_archive_report_invalid',
    'gateway_archive_dump_failed', 'gateway_archive_size_limit', 'gateway_archive_cancelled', 'gateway_archive_verification_failed',
    'gateway_archive_inventory_invalid', 'gateway_archive_review_requires_inventory', 'gateway_archive_review_hash_invalid',
    'gateway_archive_review_hash_mismatch'];
  process.stderr.write(`${safe.includes(error.code) ? error.code : 'gateway_archive_unavailable'}\n`); process.exitCode = 1;
} finally {
  try { await client?.end(); } catch {
    process.stderr.write('gateway_archive_unavailable\n'); process.exitCode = 1;
  } finally { clearTimeout(abortTimer); clearTimeout(deadline); }
}
