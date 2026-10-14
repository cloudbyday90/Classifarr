/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import pg from 'pg';
import { readGatewayConfiguration } from '../ollamaGateway/configurationFile.mjs';
import { createGatewayConfigurationReload } from '../ollamaGateway/configurationReload.mjs';
import { openGatewayLedger } from '../ollamaGateway/ledger.mjs';
import { createGatewayServer } from '../ollamaGateway/server.mjs';

// Deliberately separate from index.mjs: merely installing/upgrading Classifarr
// cannot enable the gateway or touch its dedicated database.
let client, gateway, reload, stopping = false;
async function stop(failed = false) {
  if (stopping) return;
  stopping = true;
  reload?.stop();
  // eslint-disable-next-line n/no-process-exit -- standalone CLI must bound shutdown if the database/socket never settles.
  const deadline = setTimeout(() => process.exit(1),5000); deadline.unref();
  try {
    await gateway?.stop(); await client?.end();
    clearTimeout(deadline); process.exitCode = failed ? 1 : 0;
  } catch {
    // Retain the shutdown deadline if handles survive; never print database errors.
    process.exitCode = 1;
  }
}
try {
  if (!process.env.CLASSIFARR_GATEWAY_CONFIG_FILE) throw new Error('configuration_required');
  const path = resolve(process.env.CLASSIFARR_GATEWAY_CONFIG_FILE);
  const initial = await readGatewayConfiguration(path), { config } = initial;
  client = new pg.Client({ ...initial.database, connectionTimeoutMillis: 5000, query_timeout: 5000,
    statement_timeout: 4000, application_name: 'classifarr-ollama-gateway' });
  client.on('error', () => { void stop(true); });
  await client.connect();
  const ledger = await openGatewayLedger(client,config.providerHash);
  gateway = createGatewayServer({ config,ledger });
  await new Promise((resolve,reject) => {
    gateway.server.once('error',reject); gateway.server.listen(config.port,'127.0.0.1',resolve);
  });
  reload = createGatewayConfigurationReload({ initial,load: () => readGatewayConfiguration(path),
    apply: next => gateway.replaceCredentials(next),
    onReload: () => process.stdout.write('ollama_gateway_credentials_reloaded\n'),
    onFailure: async () => { process.stderr.write('ollama_gateway_reload_failed\n'); await stop(true); } });
  if (process.platform !== 'win32') process.on('SIGHUP', () => { void reload.reload(); });
  process.once('SIGINT', () => { void stop(); }); process.once('SIGTERM', () => { void stop(); });
  process.stdout.write('ollama_gateway_ready\n');
} catch {
  // Never print connection strings, file contents, provider responses or credentials.
  process.stderr.write('ollama_gateway_unavailable\n'); await stop(true);
}
