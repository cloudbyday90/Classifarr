/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile, chmod } from 'node:fs/promises';
import assert from 'node:assert/strict';
import pg from '/app/node_modules/pg/lib/index.js';
if (process.env.CLASSIFARR_GATEWAY_FIXTURE !== 'isolated') throw new Error('fixture_required');
const database = new pg.Client({ host: '/var/run/postgresql', user: 'classifarr', database: 'classifarr' });
await database.connect();
if (Number((await database.query('SELECT count(*) AS n FROM libraries')).rows[0].n) !== 0) throw new Error('fresh_database_required');
await database.query('CREATE DATABASE classifarr_gateway_network');
await database.query('CREATE ROLE gateway_network_runtime LOGIN');
await database.end();
const ledger = new pg.Client({ host: '/var/run/postgresql', user: 'classifarr', database: 'classifarr_gateway_network' });
await ledger.connect();
await ledger.query(await readFile('/app/database/ollama-gateway/current.sql', 'utf8'));
await ledger.query(`GRANT USAGE ON SCHEMA ollama_gateway TO gateway_network_runtime;
  GRANT SELECT ON ollama_gateway.admission TO gateway_network_runtime;
  GRANT UPDATE(owner_id,provider_hash,active_request,installation,started_at,attempts,completed_at,cooldown_until,binding_count)
    ON ollama_gateway.admission TO gateway_network_runtime;
  GRANT SELECT,INSERT ON ollama_gateway.request_binding,ollama_gateway.completion_receipt TO gateway_network_runtime;
  GRANT SELECT(request_id,action,provider_hash,installation,recorded_at) ON ollama_gateway.recovery_receipt TO gateway_network_runtime`);
await ledger.end();
const runtime = new pg.Client({ host: '/var/run/postgresql', user: 'gateway_network_runtime', database: 'classifarr_gateway_network' });
try {
  await runtime.connect();
  await assert.rejects(runtime.query('SELECT operator_ref,evidence_ref FROM ollama_gateway.recovery_receipt'), { code: '42501' });
  await assert.rejects(runtime.query('DELETE FROM ollama_gateway.completion_receipt'), { code: '42501' });
} finally { await runtime.end(); }
await chmod('/tmp/gateway.json', 0o600);
process.env.CLASSIFARR_GATEWAY_CONFIG_FILE = '/tmp/gateway.json';
await import('/app/src/scripts/runOllamaGateway.mjs');
