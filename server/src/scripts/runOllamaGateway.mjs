/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { open } from 'node:fs/promises';
import pg from 'pg';
import { gatewayConfig } from '../ollamaGateway/contract.mjs';
import { openGatewayLedger } from '../ollamaGateway/ledger.mjs';
import { createGatewayServer } from '../ollamaGateway/server.mjs';

// Deliberately separate from index.mjs: merely installing/upgrading Classifarr
// cannot enable the gateway or touch its dedicated database.
let client, gateway, stopping = false;
async function stop(failed = false) {
  if (stopping) return;
  stopping = true;
  // eslint-disable-next-line n/no-process-exit -- standalone CLI must bound shutdown if the database/socket never settles.
  const deadline = setTimeout(() => process.exit(1),5000); deadline.unref();
  try { await gateway?.stop(); await client?.end(); }
  finally { clearTimeout(deadline); process.exitCode = failed ? 1 : 0; }
}
try {
  const path = process.env.CLASSIFARR_GATEWAY_CONFIG_FILE;
  if (!path) throw new Error('configuration_required');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- explicit operator-owned secret file; not an HTTP input.
  const file = await open(path,'r');
  let document;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 65536 || (process.platform !== 'win32' && (stat.mode & 0o077))) throw new Error('private_config_required');
    const buffer = Buffer.alloc(65537); let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer,length,buffer.length-length,null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > 65536) throw new Error('private_config_required');
    document = JSON.parse(new TextDecoder('utf-8',{ fatal: true }).decode(buffer.subarray(0,length)));
  } finally { await file.close(); }
  if (!document || typeof document !== 'object' || Array.isArray(document) ||
      Object.keys(document).some(key => !['gateway','database'].includes(key)) || !document.database ||
      Object.keys(document.database).some(key => !['host','port','database','user','password','ssl'].includes(key)) ||
      ['host','database','user'].some(key => typeof document.database[key] !== 'string' || !document.database[key].trim()) ||
      document.database.ssl?.rejectUnauthorized === false) throw new Error('configuration_invalid');
  const localDatabase = document.database.host.startsWith('/') || ['127.0.0.1','::1','localhost'].includes(document.database.host);
  if (!localDatabase && document.database.ssl !== true && document.database.ssl?.rejectUnauthorized !== true) {
    throw new Error('verified_database_tls_required');
  }
  const config = gatewayConfig(document.gateway);
  client = new pg.Client({ ...document.database, connectionTimeoutMillis: 5000, query_timeout: 5000,
    statement_timeout: 4000, application_name: 'classifarr-ollama-gateway' });
  client.on('error', () => { void stop(true); });
  await client.connect();
  const ledger = await openGatewayLedger(client,config.providerHash);
  gateway = createGatewayServer({ config,ledger });
  await new Promise((resolve,reject) => {
    gateway.server.once('error',reject); gateway.server.listen(config.port,'127.0.0.1',resolve);
  });
  process.once('SIGINT', () => { void stop(); }); process.once('SIGTERM', () => { void stop(); });
  process.stdout.write('ollama_gateway_ready\n');
} catch {
  // Never print connection strings, file contents, provider responses or credentials.
  process.stderr.write('ollama_gateway_unavailable\n'); await stop(true);
}
