/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import pg from 'pg';
import { readGatewayPrivateDocument } from '../ollamaGateway/privateDocument.mjs';
import { providerStopConfiguration } from '../ollamaGateway/providerStopContract.mjs';
import { runProviderStopController } from '../ollamaGateway/providerStopController.mjs';

const controller = new AbortController(); let client;
process.once('SIGINT',() => controller.abort()); process.once('SIGTERM',() => controller.abort());
// eslint-disable-next-line n/no-process-exit -- offline privileged command must bound file, DB and Docker shutdown.
const deadline = setTimeout(() => { process.stderr.write('gateway_stop_deadline\n'); process.exit(1); },55000);
try {
  const [action,...extra] = process.argv.slice(2);
  if (!['inspect','plan','stop'].includes(action) || extra.length) throw new Error();
  const configuration = providerStopConfiguration(await readGatewayPrivateDocument(process.env.CLASSIFARR_GATEWAY_STOP_CONFIG_FILE));
  const review = action === 'stop' ? await readGatewayPrivateDocument(process.env.CLASSIFARR_GATEWAY_STOP_REVIEW_FILE) : undefined;
  client = new pg.Client({ ...configuration.database,connectionTimeoutMillis: 5000,query_timeout: 5000,statement_timeout: 4000,
    application_name: 'classifarr-provider-stop' });
  client.on('error',() => controller.abort()); await client.connect();
  const output = await runProviderStopController(client,{ configuration,action,review,signal: controller.signal });
  process.stdout.write(`${JSON.stringify(output)}\n`);
} catch (error) {
  const safe = typeof error.code === 'string' && /^gateway_stop_[a-z_]+$/.test(error.code);
  process.stderr.write(`${safe ? error.code : 'gateway_stop_unavailable'}\n`); process.exitCode = 1;
} finally {
  try { await client?.end(); }
  catch { process.stderr.write('gateway_stop_unavailable\n'); process.exitCode = 1; }
  finally { clearTimeout(deadline); }
}
