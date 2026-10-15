/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFile,spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile,writeFile,unlink,chmod } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';
import { withDockerStopFixture } from './dockerStopFixture.mjs';

/** Real packaged CLI and PostgreSQL; synthetic local Docker HTTP, never a daemon socket. */
export async function rehearseProviderStop(admin) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
  await admin.query('CREATE ROLE gateway_fixture_stop LOGIN');
  for (const interrupted of [false,true]) {
    const database = interrupted ? 'gateway_stop_interrupted' : 'gateway_stop_complete';
    await admin.query(`CREATE DATABASE ${database}`); // Fixed owned fixture names in disposable container.
    const owner = new pg.Client({ host: '/var/run/postgresql',user: 'classifarr',database });
    const configPath = `/tmp/${database}-config.json`,reviewPath = `/tmp/${database}-review.json`;
    const env = { ...process.env,CLASSIFARR_GATEWAY_STOP_CONFIG_FILE: configPath,CLASSIFARR_GATEWAY_STOP_REVIEW_FILE: reviewPath };
    const args = action => ['/app/src/scripts/controlOllamaProvider.mjs',action];
    const run = async action => JSON.parse((await promisify(execFile)(process.execPath,args(action),{ env,timeout: 60000,maxBuffer: 65536 })).stdout);
    let child,exit,stopSeen = false;
    try {
      await owner.connect(); await owner.query(await readFile('/app/database/ollama-gateway/current.sql','utf8'));
      await owner.query(`GRANT USAGE ON SCHEMA ollama_gateway TO gateway_fixture_stop;
        GRANT SELECT ON ollama_gateway.admission,ollama_gateway.request_binding TO gateway_fixture_stop;
        GRANT SELECT,INSERT ON ollama_gateway.provider_stop_intent,ollama_gateway.provider_stop_observation TO gateway_fixture_stop`);
      await withDockerStopFixture(async data => {
        const providerHash = 'd'.repeat(64),{ socketPath,...pins } = data.config;
        const ledger = await openGatewayLedger(owner,providerHash,pins),requestId = await ledger.claim('synthetic');
        await owner.query('SELECT pg_advisory_unlock(11435,1)');
        const before = (await owner.query('SELECT * FROM ollama_gateway.admission')).rows;
        await writeFile(configPath,JSON.stringify({ database: { host: '/var/run/postgresql',user: 'gateway_fixture_stop',database },
          providerHash,requestId,boundary: { socketPath,...pins },networkId: data.network.Id }),{ mode: 0o600 });
        assert.equal((await run('inspect')).history,null); assert.equal(data.requests.length,0);
        await chmod(configPath,0o644); await assert.rejects(run('plan')); await chmod(configPath,0o600);
        assert.equal(data.requests.length,0);
        const { expected } = await run('plan'); await delay(2);
        await writeFile(reviewPath,JSON.stringify({ version: 1,expected,operatorRef: 'synthetic',evidenceRef: 'isolated-fixture',observedAt: new Date().toISOString(),
          assertions: { dedicatedProvider: true,exclusiveDockerControl: true,allOtherConsumersStopped: true,stopApproved: true } }),{ mode: 0o600 });
        if (interrupted) {
          child = spawn(process.execPath,args('stop'),{ env,stdio: ['ignore','pipe','pipe'] });
          const output = []; child.stdout.on('data',part => output.push(part)); child.stderr.on('data',part => output.push(part));
          exit = new Promise(resolve => child.once('exit',resolve));
          const deadline = Date.now()+15000;
          while (!stopSeen) { assert.ok(Date.now()<deadline,'stop dispatch deadline'); await delay(20); }
          assert.equal((await owner.query('SELECT count(*)::int AS n FROM ollama_gateway.provider_stop_intent')).rows[0].n,1);
          child.kill('SIGKILL'); await exit;
          assert.equal(Buffer.concat(output).toString().includes('PRIVATE'),false);
        } else {
          const result = await run('stop'); assert.equal(result.recoveryAuthorized,false);
          assert.equal(result.evidenceKind,'docker_stop_observed');
        }
        const history = (await run('inspect')).history;
        assert.equal(history.evidenceKind,interrupted ? 'stop_outcome_unknown' : 'docker_stop_observed');
        assert.equal(history.recoveryAuthorized,false);
        await assert.rejects(run('stop'),error => error.stderr.trim() === 'gateway_stop_already_attempted');
        assert.equal(data.requests.filter(entry => entry.method === 'POST').length,1);
        assert.deepEqual((await owner.query('SELECT * FROM ollama_gateway.admission')).rows,before);
        assert.equal((await owner.query('SELECT uuid_extract_version(id) AS v FROM ollama_gateway.provider_stop_intent')).rows[0].v,7);
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM ollama_gateway.provider_stop_observation')).rows[0].n,interrupted ? 0 : 1);
      },(req,res) => {
        if (req.method === 'POST' && interrupted) { stopSeen = true; return true; } // Lost response; no fabricated stopped state.
        return false;
      });
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exit; }
      await owner.end();
      for (const path of [configPath,reviewPath]) await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  process.stdout.write('provider_stop_packaged_passed private_files restricted_role UUIDv7 single_stop abrupt_death retained_uncertainty no_replay zero_inference\n');
}
