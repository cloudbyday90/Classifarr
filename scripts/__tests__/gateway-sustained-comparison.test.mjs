/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { soakProfile } from '../fixtures/ollamaGatewayRehearsal/soakProfile.mjs';
import { soakArrivals, summarizeSoakMinutes } from '../fixtures/ollamaGatewayRehearsal/soakWorkload.mjs';
import { requireStudyDatabaseCoverage } from '../fixtures/ollamaGatewayRehearsal/studyDatabase.mjs';
import { runGatewaySoakLoad } from '../lib/gatewaySoakLoad.mjs';
import { runGatewaySustainedComparison } from '../lib/gatewaySustainedComparison.mjs';
import { requireGatewaySustainedArm } from '../lib/gatewaySustainedContract.mjs';
import { studyBindingRecord } from '../lib/gatewayStudyPolicy.mjs';

const image = `sha256:${'a'.repeat(64)}`, revision = 'b'.repeat(40);
function workload(profile = 'comparison-off') {
  const results = soakArrivals(profile).map(row => ({...row,outcome:'response',status:row.installation === 'background' ? 429 : 200,
    latencyMs:row.installation === 'background' ? 2 : row.installation === 'first' ? 650 : 1250,latenessMs:1}));
  const observed = results.filter(row => row.status === 200).map(row => ({id:row.id,preClaimMs:row.installation === 'first' ? 1 : 600,claimMs:1}));
  return {results,observed};
}
function measurements(baseline = false, worker = false) {
  const samples = worker ? 1680 : 1860;
  const peaks = {currentBytes:100000000,anonBytes:60000000,fileBytes:40000000,
    managedConnections:3,archiveSourceConnections:1,coordinatorConnections:1,catalogSnapshotConnections:1,
    catalogSnapshotTransactions:1,maxTransactionAgeMs:30000,maxCatalogTransactionAgeMs:30000,observedTransactions:8,observedCatalogTransactions:6};
  if (baseline) for (const key of Object.keys(peaks).filter(key => !['currentBytes','anonBytes','fileBytes'].includes(key))) peaks[key] = 0;
  return {version:1,samples,elapsedMs:samples * 1000,maxGapMs:1000,failedSamples:0,capReached:false,peaks,
    coverage:Object.fromEntries(Object.keys(peaks).map(key => [key,samples])),
    bins:[{phase:worker ? 'worker' : 'idle',samples:60,values:{managedConnections:{count:60,max:0},catalogSnapshotConnections:{count:60,max:0}}}]};
}
const resources = kind => ({fixture:'resources',kind,peakBytes:100000000,memoryEvents:{oom:'0',oom_kill:'0'},pidsEvents:'max 0'});
function arm(profile) {
  const baseline = profile === 'comparison-off', {results,observed} = workload(profile);
  const history = {rows:3000,bytes:233849300,sha256:'e'.repeat(64)};
  return {profile,cleanup:'verified',history,
    inference:{passed:true,providerAttempts:1800,peakProviderConcurrency:1,resources:resources('source'),
      study:measurements(baseline),comparison:summarizeSoakMinutes(results,observed,profile)},
    data:[{fixture:'history-preserved',...history,retainedRoots:baseline ? 0 : 2,dumps:baseline ? [] : [{bytes:233000000},{bytes:233100000}]},
      {fixture:'soak-check',cleanupOperations:0,admission:{attempts:1801,binding_count:1801,active_request:null},
        rows:{n:1800,fingerprints:1800,v7:1800},catalogJobs:baseline ? [] : Array.from({length:2},() => ({status:'verified',attempt:1})),
        overlaps:baseline ? [] : ['archiver','catalog-verifier'].map(kind => ({kind,admittedRequests:3}))}],
    workers:baseline ? [] : ['archiver','catalog-verifier'].map(kind => ({kind,rows:[resources(kind),
      {fixture:'study-observations',coveragePassed:true,...measurements(false,true)}]}))};
}

test('comparison profiles preserve exact traffic/limits and partition offered slots into thirty minutes', () => {
  assert.deepEqual(soakArrivals('comparison-off'),soakArrivals('comparison-on'));
  for (const profileName of ['comparison-off','comparison-on']) {
    const profile = soakProfile(profileName), {results,observed} = workload(profileName);
    assert.equal(profile.durationMs,1800000); assert.equal(profile.settleMs,60000); assert.equal(profile.sampleLimit,2048);
    const summary = summarizeSoakMinutes(results,observed,profileName);
    assert.equal(summary.minutes.length,30); assert.equal(summary.overall.completed,1800); assert.equal(summary.overall.busy,180);
    assert.ok(summary.minutes.every((row,index) => row.minute === index && row.offered === 66 && row.latencyMs.count === 60));
    assert.equal(summary.worst.id,2); assert.equal(summary.worst.latencyMs,1250);
    assert.equal(summary.overall.latencyMs.p95,1250); assert.match(summary.planSha256,/^[a-f0-9]{64}$/);
  }
});

test('minute/overall tails use their own populations and the worst request excludes extra private fields', () => {
  const {results,observed} = workload(); results[0].latencyMs = 9000; results[0].providerBody = 'private-secret';
  const summary = summarizeSoakMinutes(results,observed,'comparison-off');
  assert.equal(summary.worst.id,1); assert.equal(summary.overall.latencyMs.max,9000);
  assert.equal(summary.overall.latencyMs.p95,1250); assert.equal(summary.minutes[0].latencyMs.max,9000);
  assert.equal(summary.minutes[1].latencyMs.max,1250); assert.ok(!JSON.stringify(summary).includes('private-secret'));
  for (const mutation of [v => v.pop(),v => {v[0].at = 1;},v => {v[0].installation = 'background';},
    v => {v[0].phase = 'unknown';},v => {v[0].outcome = 'dropped';},v => {v[0].latencyMs = NaN;},v => {v[0].latenessMs = 501;}]) {
    const copy = structuredClone(results); mutation(copy);
    assert.throws(() => summarizeSoakMinutes(copy,observed,'comparison-off'));
  }
  assert.throws(() => summarizeSoakMinutes(results,observed,'extended'));
  assert.throws(() => summarizeSoakMinutes(results,[...observed.slice(1),observed[1]],'comparison-off'));
});

test('baseline database coverage positively requires no observed archive activity', () => {
  requireStudyDatabaseCoverage(measurements(true),true);
  assert.throws(() => requireStudyDatabaseCoverage(measurements(true)));
  assert.throws(() => requireStudyDatabaseCoverage(measurements(false),true));
  for (const field of ['managedConnections','archiveSourceConnections','coordinatorConnections','catalogSnapshotConnections',
    'maxTransactionAgeMs','observedTransactions','observedCatalogTransactions']) {
    const sample = measurements(true); sample.peaks[field] = 1;
    assert.throws(() => requireStudyDatabaseCoverage(sample,true));
  }
  const missing = measurements(true); delete missing.coverage.managedConnections;
  assert.throws(() => requireStudyDatabaseCoverage(missing,true));
});

test('arm contract distinguishes actual co-load progress from positive baseline absence and never prints raw proof', () => {
  for (const profile of ['comparison-off','comparison-on']) {
    assert.equal(requireGatewaySustainedArm(arm(profile),profile).verifiedCatalogs,profile.endsWith('off') ? 0 : 2);
    for (const mutate of [v => {v.cleanup = 'unknown';},v => {v.profile = 'extended';},v => {v.inference.providerAttempts = 1799;},
      v => {v.inference.comparison.minutes.pop();},v => {v.inference.comparison.minutes[0].minute = 1;},
      v => {v.inference.comparison.overall.latencyMs.max++;},v => {v.inference.comparison.worst.id = 3;},
      v => {v.inference.comparison.private = 'secret';},v => {v.data[0].sha256 = 'f'.repeat(64);},
      v => {v.data[1].admission.attempts = 1;},v => {v.data[1].cleanupOperations = 1;},v => {v.data[1].rows.v7 = 0;},
      v => {v.history.bytes = 268435456;},v => {v.inference.resources.memoryEvents.oom = 1;},
      v => {v.inference.study.coverage.currentBytes = 0;}]) {
      const value = arm(profile); mutate(value);
      assert.throws(() => requireGatewaySustainedArm(value,profile),error => error.message === 'sustained_arm_contract_invalid' && !error.cause);
    }
  }
  const off = arm('comparison-off'); off.data[1].catalogJobs.push({status:'verified',attempt:1});
  assert.throws(() => requireGatewaySustainedArm(off,'comparison-off'));
  for (const mutate of [v => {v.workers.pop();},v => {v.workers.reverse();},v => {v.data[1].catalogJobs[0].attempt = 2;},
    v => {v.data[1].overlaps = [];},v => {v.workers[0].rows[1].coveragePassed = false;}]) {
    const value = arm('comparison-on'); mutate(value); assert.throws(() => requireGatewaySustainedArm(value,'comparison-on'));
  }
});

test('four arms are sequential off/on/on/off and host observations occur after each verified result', async () => {
  const calls = [], reports = [], sequence = [];
  await runGatewaySustainedComparison(image,revision,{snapshot:() => {sequence.push('host');return {containers:2,sha256:'d'.repeat(64)};},
    run:async (...args) => {calls.push(args);sequence.push(args[2]);return arm(args[2]);},report:row => reports.push(row)});
  assert.deepEqual(calls.map(args => args.slice(2)),[['comparison-off','comparison'],['comparison-on','comparison'],['comparison-on','comparison'],['comparison-off','comparison']]);
  assert.ok(calls.every(args => args[0] === image && args[1] === revision));
  assert.deepEqual(sequence,['host','comparison-off','host','comparison-on','host','comparison-on','host','comparison-off','host']);
  assert.equal(reports.filter(row => row.stage === 'arm_correctness_passed_cleanup_verified').length,4);
  assert.equal(reports.at(-1).latency,'diagnostic_not_production_acceptance');
});

test('interference stops after completed evidence without retry; failed cleanup and malformed proof never pass', async () => {
  for (const stopAfter of [0,1,2,3,4]) {
    let checks = 0, runs = 0; const reports = [];
    await assert.rejects(runGatewaySustainedComparison(image,revision,{snapshot:() => {
      if (checks++ === stopAfter) throw Error('private'); return {containers:2,sha256:'d'.repeat(64)};
    },run:async (_image,_revision,profile) => {runs++;return arm(profile);},report:row => reports.push(row)}),/snapshot_unavailable/);
    assert.equal(runs,stopAfter); assert.equal(reports.filter(row => row.stage === 'arm_correctness_passed_cleanup_verified').length,stopAfter);
    assert.ok(!reports.some(row => row.stage === 'passed_cleanup_verified')); assert.ok(!JSON.stringify(reports).includes('private'));
  }
  for (const fail of [async () => {throw Error('cleanup_failed');}, async () => ({private:'never publish'})]) {
    let checks = 0;
    await assert.rejects(runGatewaySustainedComparison(image,revision,{snapshot:() => {checks++;return {containers:0,sha256:'d'.repeat(64)};},
      run:fail,report:() => {}}),/cleanup_failed|sustained_arm_contract_invalid/); assert.equal(checks,1);
  }
  let snapshots = 0, runs = 0; const reports = [];
  await assert.rejects(runGatewaySustainedComparison(image,revision,{snapshot:() => ({containers:2,sha256:(snapshots++ ? 'e' : 'd').repeat(64)}),
    run:async (_image,_revision,profile) => {runs++;return arm(profile);},report:row => reports.push(row)}),/host_state_changed/);
  assert.equal(runs,1); assert.equal(snapshots,2);
  assert.equal(reports.filter(row => row.stage === 'arm_correctness_passed_cleanup_verified').length,1);
  assert.equal(reports.at(-1).reason,'host_state_changed');
});

test('comparison CLI refuses unknown modes and extra overrides before accessing Docker', () => {
  const entry = fileURLToPath(new URL('../run-gateway-online-archive-rehearsal.mjs',import.meta.url));
  for (const args of [[image,revision,'--sustained-comparison','--duration=1'],[image,revision,'--comparison-off'],
    ['latest',revision,'--sustained-comparison'],[image,'main','--sustained-comparison']]) {
    const result = spawnSync(process.execPath,[entry,...args],{encoding:'utf8',timeout:10000});
    assert.equal(result.status,1); assert.match(result.stderr,/archive_rehearsal_arguments_invalid|immutable_image_and_revision_required/);
  }
});

test('load orchestration never starts off workers and preserves normal start/stop/drain behavior', async () => {
  for (const profileName of ['comparison-off','comparison-on','extended']) {
    const baseline = profileName === 'comparison-off', actions = [], profile = soakProfile(profileName);
    const binding = {sha256:'f'.repeat(64),manifest:{version:2,study:profileName === 'extended' ? 'inference' : 'comparison',profile:profileName,
      image,fixtureRevision:revision,imageRevision:revision,entries:['soakInference.mjs']}};
    let time = 1, polls = 0;
    const proof = await runGatewaySoakLoad({profile,binding,source:'owned',now:() => time,sleep:async () => {time += 20000;},
      docker:() => {},report:() => {},create:(kind,mode) => actions.push(`create:${kind}:${mode}`),
      check:(kind,stop) => {actions.push(`check:${kind}:${stop}`);return [{fixture:'child-window',kind}];},
      once:async kind => actions.push(`drain:${kind}`),fixture:(action,windows) => {actions.push(`fixture:${action}`);return [{windows:JSON.parse(windows)}];},
      read:path => path.endsWith('soak-result.json') ? ++polls > 3 ? {passed:true} : null :
        path.endsWith('binding-failed.json') ? null : path.endsWith('inference-binding.json') ? studyBindingRecord(binding,'soakInference.mjs') :
          path.endsWith('soak-after.json') ? time >= 40000 ? {} : null : {},
    });
    if (baseline) {assert.deepEqual(actions,['fixture:check']);assert.equal(proof.workers.length,0);assert.deepEqual(proof.data[0].windows,[]);}
    else {assert.equal(proof.workers.length,2);assert.ok(actions.includes('create:archiver:loop'));
      assert.ok(actions.includes('create:catalog-verifier:loop'));assert.ok(actions.includes('drain:archiver'));
      assert.ok(actions.indexOf('check:archiver:true') < actions.indexOf('drain:catalog-verifier'));}
  }
});
