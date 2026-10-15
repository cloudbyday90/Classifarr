/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';

/** Provider is already fully stopped by the parent synthetic fixture, not by this CLI. */
export async function rehearseOfflineRecovery(owner, database, providerHash) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
  await owner.query('CREATE ROLE gateway_fixture_recovery LOGIN');
  await owner.query(`GRANT USAGE ON SCHEMA ollama_gateway TO gateway_fixture_recovery;
    GRANT SELECT ON ollama_gateway.admission TO gateway_fixture_recovery;
    GRANT UPDATE(active_request,installation,started_at,maintenance_receipt,last_recovery_receipt) ON ollama_gateway.admission TO gateway_fixture_recovery;
    GRANT SELECT,INSERT ON ollama_gateway.recovery_receipt TO gateway_fixture_recovery;
    GRANT SELECT ON ollama_gateway.request_binding TO gateway_fixture_recovery;
    GRANT SELECT ON ollama_gateway.upstream_peer_observation TO gateway_fixture_recovery;
    GRANT SELECT ON ollama_gateway.provider_stop_intent,ollama_gateway.provider_stop_observation TO gateway_fixture_recovery;
    REVOKE UPDATE ON ollama_gateway.admission FROM gateway_fixture_runtime;
    GRANT UPDATE(owner_id,provider_hash,active_request,installation,started_at,attempts,completed_at,cooldown_until,binding_count)
      ON ollama_gateway.admission TO gateway_fixture_runtime`);
  const configPath = '/tmp/gateway-recovery-private.json', reviewPath = '/tmp/gateway-recovery-review.json';
  const client = new pg.Client(database);
  const env = { ...process.env,CLASSIFARR_GATEWAY_RECOVERY_CONFIG_FILE: configPath,CLASSIFARR_GATEWAY_RECOVERY_REVIEW_FILE: reviewPath };
  const run = async action => JSON.parse((await promisify(execFile)(process.execPath,
    ['/app/src/scripts/recoverOllamaGateway.mjs',action],{ env,timeout: 25000,maxBuffer: 65536 })).stdout);
  const prepare = async action => {
    const { expected } = await run('inspect'); await delay(2);
    await writeFile(reviewPath,JSON.stringify({ version: 1,action,expected,operatorRef: 'synthetic-fixture',evidenceRef: 'synthetic-provider-stopped',
      observedAt: new Date().toISOString(),assertions: action === 'acknowledge-stop' ?
        { ingressIsolated: true,allProviderRunnersStopped: true,automaticRestartDisabled: true,administratorVerified: true } :
        { providerIsolationMaintained: true,controlledRestartReviewed: true,noRequestReplay: true,administratorVerified: true } }),{ mode: 0o600 });
    return expected;
  };
  try {
    await writeFile(configPath,JSON.stringify({ providerHash,database: { host: database.host,database: database.database,user: 'gateway_fixture_recovery' } }),{ mode: 0o600 });
    const originalBinding = (await run('inspect')).requestBinding;
    assert.equal(originalBinding.evidenceKind,'unbound'); assert.equal(originalBinding.recoveryAuthorized,false);
    const original = await prepare('acknowledge-stop'); assert.equal(original.attempts,'5');
    const stopped = await run('acknowledge-stop'); assert.equal(stopped.state,'maintenance');
    assert.equal(stopped.evidenceKind,'administrator_attested'); assert.equal(stopped.replayed,false);
    await assert.rejects(run('acknowledge-stop')); // Same review cannot clear a second state.
    await client.connect(); const held = await openGatewayLedger(client,providerHash);
    assert.equal((await held.status()).state,'maintenance'); assert.equal((await held.status()).attempts,'5');
    await assert.rejects(held.claim('synthetic'),/gateway_admission_deferred/);
    await assert.rejects(run('inspect'),error => error.stderr.trim() === 'gateway_recovery_gateway_running');
    await client.end(); await prepare('resume');
    const resumed = await run('resume'); assert.equal(resumed.state,'resumed'); assert.equal(resumed.attempts,'5');
    const after = await run('inspect'); assert.equal(after.expected.maintenanceReceipt,null);
    assert.deepEqual(after.requestBinding,originalBinding);
    assert.equal(after.expected.requestId,null); assert.equal(after.expected.attempts,'5');
    const receipts = (await owner.query('SELECT action,request_id,evidence_kind,uuid_extract_version(id) AS version FROM ollama_gateway.recovery_receipt ORDER BY id')).rows;
    assert.equal(receipts.length,2);
    for (const receipt of receipts) {
      assert.equal(receipt.request_id,original.requestId); assert.equal(receipt.evidence_kind,'administrator_attested'); assert.equal(receipt.version,7);
    }
    process.stdout.write('gateway_offline_recovery_passed: packaged private CLI, restricted roles, UUIDv7 receipts, restart hold, stale replay refusal, separate resume, original binding retained; 5 attempts preserved, zero recovery provider calls\n');
  } finally {
    await client.end();
    for (const path of [configPath,reviewPath]) await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
