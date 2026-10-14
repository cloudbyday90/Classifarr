/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import pg from 'pg';
import { readGatewayPrivateDocument } from '../ollamaGateway/privateDocument.mjs';
import { gatewayRecoveryConfiguration } from '../ollamaGateway/recoveryContract.mjs';
import { runGatewayRecovery } from '../ollamaGateway/recoveryRepository.mjs';

// Offline only: no provider requests, application bootstrap, automatic retry or schema creation.
const controller = new AbortController();
process.once('SIGINT',() => controller.abort()); process.once('SIGTERM',() => controller.abort());
// eslint-disable-next-line n/no-process-exit -- uncertain commit must not leave an unbounded offline process.
const deadline = setTimeout(() => { process.stderr.write('gateway_recovery_deadline_inspect_before_retry\n'); process.exit(1); },20000);
let client;
try {
  const [action,...extra] = process.argv.slice(2);
  if (extra.length || !['inspect','acknowledge-stop','resume'].includes(action)) throw new Error('invalid_action');
  const config = gatewayRecoveryConfiguration(await readGatewayPrivateDocument(process.env.CLASSIFARR_GATEWAY_RECOVERY_CONFIG_FILE));
  const review = action === 'inspect' ? undefined : await readGatewayPrivateDocument(process.env.CLASSIFARR_GATEWAY_RECOVERY_REVIEW_FILE);
  client = new pg.Client({ ...config.database,connectionTimeoutMillis: 5000,query_timeout: 5000,
    statement_timeout: 4000,application_name: 'classifarr-gateway-offline-recovery' });
  client.on('error',() => controller.abort());
  await client.connect();
  const result = await runGatewayRecovery(client,{ providerHash: config.providerHash,action,review,signal: controller.signal });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const codes = ['gateway_config_invalid','gateway_recovery_review_invalid','gateway_recovery_dedicated_session_required',
    'gateway_recovery_gateway_running','gateway_recovery_ledger_unavailable','gateway_recovery_state_changed',
    'gateway_recovery_observation_invalid','gateway_recovery_cancelled','gateway_recovery_commit_unknown'];
  process.stderr.write(`${codes.includes(error.code) ? error.code : 'gateway_recovery_unavailable'}\n`);
  process.exitCode = 1;
} finally {
  try { await client?.end(); clearTimeout(deadline); } catch { process.exitCode = 1; }
}
