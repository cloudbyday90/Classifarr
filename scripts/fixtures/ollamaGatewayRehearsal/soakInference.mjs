/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { gatewayConfig } from '/app/src/ollamaGateway/contract.mjs';
import { createGatewayServer } from '/app/src/ollamaGateway/server.mjs';
import { createGatewayClient } from '/app/src/ollamaGateway/client.mjs';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';
import { readGatewayTaskSource } from '/app/src/ollamaGateway/taskSource.mjs';
import { runSoakArrivals, summarizeSoak } from './soakWorkload.mjs';
import { qualificationResources } from './archiveQualificationResources.mjs';
import { soakProfile } from './soakProfile.mjs';
import { createStudyMeasurements, requireStudyCoverage } from './studyMeasurements.mjs';
import { createStudyResourceSample } from './studyResource.mjs';
import { createStudyDatabaseSample } from './studyDatabase.mjs';
import { readResidentText } from '/app/src/scripts/comparisonMemoryStudy/residentMemory.mjs';
import * as residentParsers from '/app/src/scripts/comparisonMemoryStudy/residentMemoryParsers.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const profile = soakProfile(process.env.CLASSIFARR_SOAK_PROFILE ?? 'regression');
const db = new pg.Client({ host: '/var/run/postgresql', database: 'gateway_inference_soak', user: 'soak_runtime', statement_timeout: 5000 });
const context = new AsyncLocalStorage(), observations = [], providerIds = new Set(), clients = [];
const lag = monitorEventLoopDelay({ resolution: 20 });
let gateway, provider, phase, observer, measurements, sampler, attempts = 0, active = 0, peakActive = 0, protocolFailure = false;
try {
  const credentials = ['first', 'second', 'background'].map(installation => ({ installation, workClass: installation === 'background' ? 'background' : 'foreground',
    token: randomBytes(32).toString('base64url') }));
  const config = gatewayConfig({ upstream: 'http://127.0.0.1:11434', models: ['synthetic:latest'], credentials,
    workIdentityKey: randomBytes(32).toString('base64url'), timeoutMs: 10000, queueMs: 5000 });
  provider = createServer((req, res) => { void (async () => {
    let length = 0; const chunks = [];
    for await (const chunk of req) { length += chunk.length; assert.ok(length < 1024); chunks.push(chunk); }
    const body = JSON.parse(Buffer.concat(chunks));
    const id = req.headers['x-classifarr-request-id'];
    assert.equal(req.url, '/api/generate'); assert.equal(req.headers.authorization, undefined);
    assert.equal(req.headers['x-classifarr-application'], 'classifarr');
    assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    assert.ok(!providerIds.has(id)); providerIds.add(id); assert.ok(providerIds.size <= profile.foreground);
    attempts++; active++; peakActive = Math.max(peakActive, active);
    await delay(650); active--;
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ model: body.model, done: true, response: 'synthetic' }));
  })().catch(() => { protocolFailure = true; res.writeHead(500); res.end('{}'); }); });
  await new Promise(resolve => provider.listen(11434, '127.0.0.1', resolve));
  await db.connect(); const ledger = await openGatewayLedger(db, config.providerHash);
  gateway = createGatewayServer({ config, ledger: { ...ledger, async claim(...args) {
    const observed = context.getStore(); assert.ok(observed);
    const started = performance.now(), id = await ledger.claim(...args);
    assert.ok(observations.length < profile.foreground);
    observations.push({ id: observed.id, preClaimMs: started - observed.received, claimMs: performance.now() - started }); return id;
  } } });
  // Observe before the real handler; no replacement of production queue/HTTP code.
  gateway.server.prependListener('request', req => {
    const source = readGatewayTaskSource(req, true);
    context.enterWith({ id: Number(source.taskId), received: performance.now() });
  });
  await new Promise(resolve => gateway.server.listen(11435, '127.0.0.1', resolve));
  for (const credential of credentials) clients.push(createGatewayClient({ url: 'http://127.0.0.1:11435', upstream: config.upstream,
    models: config.models, token: credential.token }, { expectedUpstream: config.upstream }));
  const resources = await qualificationResources(), startedAt = Date.now(); lag.enable();
  if (profile.name === 'extended') {
    observer = new pg.Client({ host: '/var/run/postgresql', database: 'gateway_inference_soak', user: 'classifarr',
      options: '-c default_transaction_read_only=on', statement_timeout: 500, query_timeout: 1000,
      application_name: 'classifarr-study-observer' });
    observer.on('error', () => {}); await observer.connect();
    assert.equal((await observer.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
    const databaseSample = createStudyDatabaseSample(observer);
    measurements = createStudyMeasurements(createStudyResourceSample({ version: resources.limits.version, read: readResidentText,
      parsers: residentParsers, extra: async () => ({ ...await databaseSample(),
        workerRssBytes: process.memoryUsage().rss, heapUsedBytes: process.memoryUsage().heapUsed }) }), { phase: () => phase ?? 'before' });
    await measurements.tick();
    sampler = setInterval(() => { void measurements.tick().catch(() => { protocolFailure = true; }); }, 1000);
  }
  const loadStarted = performance.now();
  const results = await runSoakArrivals({ profileName: profile.name, request: async arrival => {
    if (phase !== arrival.phase) {
      phase = arrival.phase;
      await writeFile(`/fixtures/soak-${phase}.json`, JSON.stringify({ phase, at: Date.now() }), { mode: 0o600, flag: 'wx' });
      console.log(JSON.stringify({ phase, at: Date.now() }));
    }
    const client = clients[['first', 'second', 'background'].indexOf(arrival.installation)];
    try {
      const value = await client.request('/api/generate', { model: 'synthetic:latest', prompt: `synthetic-${arrival.id}`, stream: false }, {
        timeoutMs: 10000, source: { version: 1, kind: 'queue_task', taskId: String(arrival.id), taskType: 'classification', attempt: 0 },
      });
      assert.equal(value.response, 'synthetic'); return 200;
    } catch (error) { if (error.status === 429) return 429; throw error; }
  } });
  if (profile.name === 'extended') await delay(Math.max(0, profile.durationMs - (performance.now() - loadStarted)));
  const phases = summarizeSoak(results, observations, profile.name); lag.disable();
  if (profile.settleMs) {
    phase = 'idle'; await writeFile('/fixtures/soak-idle.json', JSON.stringify({ phase, at: Date.now() }), { mode: 0o600, flag: 'wx' });
    await delay(profile.settleMs);
  }
  clearInterval(sampler); await measurements?.stop();
  const study = measurements ? requireStudyCoverage(measurements.summary(), profile.durationMs + profile.settleMs - 2500, true) : null;
  if (study) {
    assert.ok(study.peaks.observedTransactions >= 4, 'study_transactions_not_observed');
    assert.ok(study.coverage.maxTransactionAgeMs >= study.samples * 0.9, 'study_database_coverage');
  }
  assert.equal(protocolFailure, false); assert.equal(attempts, profile.foreground); assert.equal(peakActive, 1);
  const metrics = await resources.metrics();
  assert.ok(Object.values(metrics.memoryEvents).every(value => Number(value) === 0));
  await writeFile('/fixtures/soak-result.json', JSON.stringify({ passed: true, startedAt, endedAt: Date.now(), phases,
    providerAttempts: attempts, peakProviderConcurrency: peakActive, resources: metrics, ...(study ? { study } : {}),
    eventLoopMs: { p95: lag.percentile(95) / 1e6, max: lag.max / 1e6 } }), { mode: 0o600, flag: 'wx' });
} catch {
  await writeFile('/fixtures/soak-result.json', JSON.stringify({ passed: false, reason: 'soak_inference_failed' }), { mode: 0o600, flag: 'wx' });
  process.exitCode = 1;
} finally {
  clearInterval(sampler); await measurements?.stop(); lag.disable(); clients.forEach(client => client.close()); await gateway?.stop();
  if (provider) { provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)); }
  await observer?.end(); await db.end();
}
