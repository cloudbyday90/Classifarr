/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudyMeasurements, requireStudyCoverage } from '../fixtures/ollamaGatewayRehearsal/studyMeasurements.mjs';
import { createStudyResourceSample, studyCpu, studyIo } from '../fixtures/ollamaGatewayRehearsal/studyResource.mjs';
import { createStudyDatabaseSample, requireStudyDatabaseCoverage } from '../fixtures/ollamaGatewayRehearsal/studyDatabase.mjs';
import * as parsers from '../../server/src/scripts/comparisonMemoryStudy/residentMemoryParsers.mjs';

test('minute bins keep first/last/range and separate idle; raw untrusted fields are omitted', async () => {
  let clock = 0, value = 10, phase = 'archives';
  const measurements = createStudyMeasurements(async () => ({ currentBytes: value, anonBytes: 1, fileBytes: 9, secret: 'not evidence' }),
    { now: () => clock, phase: () => phase });
  for (let index = 0; index < 60; index++) { clock = index * 1000; value++; await measurements.tick(); }
  phase = 'idle';
  for (let index = 60; index < 120; index++) { clock = index * 1000; await measurements.tick(); }
  const result = requireStudyCoverage(measurements.summary(), 118000, true);
  assert.equal(result.samples, 120); assert.equal(result.bins.length, 2);
  assert.deepEqual(result.bins[0].values.currentBytes, { first: 11, last: 70, min: 11, max: 70, count: 60 });
  assert.ok(!JSON.stringify(result).includes('secret')); assert.equal(result.coverage.pressureSomeUs, undefined);
});

test('missing, invalid, capped and gapped evidence cannot pass coverage', async () => {
  let clock = 0;
  const empty = createStudyMeasurements(async () => ({}), { now: () => clock });
  assert.throws(() => requireStudyCoverage(empty.summary(), 0));
  for (const sample of [{}, { currentBytes: NaN }, { currentBytes: -1 }]) {
    const measure = createStudyMeasurements(async () => sample, { now: () => clock }); await measure.tick();
    assert.throws(() => requireStudyCoverage(measure.summary(), 0));
  }
  const measure = createStudyMeasurements(async () => ({ currentBytes: 1, anonBytes: 1, fileBytes: 0 }), { now: () => clock });
  await measure.tick(); clock = 6000; await measure.tick(); assert.throws(() => requireStudyCoverage(measure.summary(), 0));
  clock = 0; const capped = createStudyMeasurements(async () => ({}), { now: () => clock });
  for (let index = 0; index < 2049; index++) { clock = index * 1000; await capped.tick(); }
  assert.equal(capped.summary().samples, 2048); assert.equal(capped.summary().capReached, true);
});

test('an in-flight sample cannot overlap and stop waits for it', async () => {
  let release, calls = 0;
  const pending = new Promise(resolve => { release = resolve; });
  const measurements = createStudyMeasurements(async () => { calls++; await pending; return {}; });
  const first = measurements.tick(); await measurements.tick(); assert.equal(calls, 1);
  let stopped = false; const stop = measurements.stop().then(() => { stopped = true; });
  await Promise.resolve(); assert.equal(stopped, false); release(); await first; await stop; assert.equal(stopped, true);
});

test('v1/v2 CPU and I/O counters are not mixed or double-counted', () => {
  assert.deepEqual(studyCpu('usage_usec 123\nthrottled_usec 4', 2), { cpuUsageUs: 123, cpuThrottledUs: 4 });
  assert.deepEqual(studyCpu('nr_periods 10\nthrottled_time 4000', 1), { cpuThrottledUs: 4 });
  assert.deepEqual(studyIo('8:0 Read 12\n8:0 Write 34\n8:0 Total 46\nTotal 46', 1), { readBytes: 12, writeBytes: 34 });
  assert.deepEqual(studyIo('8:0 rbytes=12 wbytes=34 rios=1 wios=2', 2), { readBytes: 12, writeBytes: 34 });
  for (const value of ['garbage', '8:0 Read -1']) assert.throws(() => studyIo(value, 1));
  assert.throws(() => studyIo('8:0 rbytes=-1', 2)); assert.throws(() => studyCpu('usage_usec nope', 2));
});

test('missing optional kernel metrics remain absent, while mandatory memory is normalized', async () => {
  const read = async path => {
    if (path.endsWith('/memory.stat')) return 'total_rss 10\ntotal_cache 20';
    if (path.endsWith('/memory.usage_in_bytes')) return '30'; throw new Error('unavailable');
  };
  const sample = await createStudyResourceSample({ version: 1, read, parsers })();
  assert.deepEqual(sample, { currentBytes: 30, anonBytes: 10, fileBytes: 20 });
  assert.equal(sample.pressureSomeUs, undefined); assert.equal(sample.readBytes, undefined);
});

test('transaction observation records bounded metadata only, without query text', async () => {
  let current = [{application:'classifarr-gateway-archive-source',connection:'12',identity:'12:start',age:12}]; const sql = [];
  const sample = createStudyDatabaseSample({ query: async (...args) => { sql.push(args); return { rows: current }; } });
  const first = await sample(); assert.equal(first.observedTransactions,1); assert.equal(first.maxTransactionAgeMs,12);
  current = [{application:'classifarr-gateway-catalog-snapshot',connection:'13',identity:'13:start',age:20},
    {application:'classifarr-gateway-archive-source',connection:'12',identity:null,age:null},
    {application:'classifarr-gateway-archive-coordinator',connection:'14',identity:'14:statement',age:1}];
  assert.deepEqual(await sample(),{managedConnections:3,archiveSourceConnections:1,coordinatorConnections:1,
    catalogSnapshotConnections:1,catalogSnapshotTransactions:1,maxTransactionAgeMs:20,maxCatalogTransactionAgeMs:20,
    observedTransactions:2,observedCatalogTransactions:1});
  current=[]; const idle=await sample();
  assert.equal(idle.managedConnections,0); assert.equal(idle.observedTransactions,2); assert.equal(idle.observedCatalogTransactions,1);
  assert.equal(idle.maxCatalogTransactionAgeMs,0);
  assert.ok(sql.every(([text,values])=>!text.includes('SELECT query') && values[0].length===3 && values[0].includes('classifarr-gateway-catalog-snapshot')));
  assert.ok(!JSON.stringify(idle).includes('start'));
});

test('malformed, duplicate, excessive and unknown sessions never become valid zero samples',async()=>{
  const row={application:'classifarr-gateway-catalog-snapshot',connection:'1',identity:'1:start',age:1};
  for(const rows of [null,Array(6).fill(row),[row,row],[row,{...row,connection:'2',identity:'2:start'}],
    [{...row,application:'unknown'}],[{...row,connection:'../1'}],[{...row,age:NaN}],[{...row,age:-1}],
    [{...row,identity:null}],[{...row,identity:'different'}],[{...row,identity:'1:'+ 'x'.repeat(128)}]]) {
    const sample=createStudyDatabaseSample({query:async()=>({rows})}); await assert.rejects(sample());
  }
  const failed=createStudyDatabaseSample({query:async()=>{throw Error('offline');}}); await assert.rejects(failed());
});

test('transaction history stays bounded and a refused sample cannot poison cumulative observations',async()=>{
  let current=[];
  const sample=createStudyDatabaseSample({query:async()=>({rows:current})});
  for(let i=0;i<128;i++) {current=[{application:'classifarr-gateway-catalog-snapshot',connection:'1',identity:`1:${i}`,age:1}];await sample();}
  current=[{application:'classifarr-gateway-catalog-snapshot',connection:'1',identity:'1:overflow',age:1}];
  await assert.rejects(sample(),/study_transaction_history_limit/); current=[];
  assert.equal((await sample()).observedCatalogTransactions,128);
});

function databaseSummary() {
  const fields=['managedConnections','archiveSourceConnections','coordinatorConnections','catalogSnapshotConnections',
    'catalogSnapshotTransactions','maxTransactionAgeMs','maxCatalogTransactionAgeMs','observedTransactions','observedCatalogTransactions'];
  return {samples:100,coverage:Object.fromEntries(fields.map(key=>[key,100])),
    peaks:{observedTransactions:4,observedCatalogTransactions:2,catalogSnapshotConnections:1},
    bins:[{phase:'idle',values:{managedConnections:{count:45,max:0},catalogSnapshotConnections:{count:45,max:0}}}]};
}

test('database coverage requires owner observations, original progress and complete settled disappearance',()=>{
  assert.equal(requireStudyDatabaseCoverage(databaseSummary()).samples,100);
  for(const change of [s=>{delete s.coverage.managedConnections;},s=>{s.coverage.maxCatalogTransactionAgeMs=89;},
    s=>{s.coverage.managedConnections=101;},s=>{s.peaks.observedTransactions=Infinity;},s=>{s.peaks.observedTransactions=129;},
    s=>{s.peaks.observedCatalogTransactions=5;},
    s=>{s.peaks.observedTransactions=3;},s=>{s.peaks.observedCatalogTransactions=1;},s=>{s.peaks.catalogSnapshotConnections=2;},
    s=>{s.bins=[];},s=>{s.bins[0].values.managedConnections.max=1;},s=>{s.bins[0].values.catalogSnapshotConnections.count=44;},
    s=>{delete s.bins[0].values.catalogSnapshotConnections;}]) {
    const value=databaseSummary();change(value);assert.throws(()=>requireStudyDatabaseCoverage(value));
  }
});

test('an unavailable observer loses coverage instead of reporting a successful empty database',async()=>{
  const sample=createStudyDatabaseSample({query:async()=>{throw Error('offline');}});
  const measurements=createStudyMeasurements(sample);
  await measurements.tick();const summary=measurements.summary();
  assert.equal(summary.samples,1);assert.equal(summary.failedSamples,1);
  assert.equal(summary.coverage.managedConnections,undefined);assert.equal(summary.peaks.managedConnections,undefined);
  assert.throws(()=>requireStudyDatabaseCoverage(summary));
});

test('owner connection fields are retained by the sampler while raw session identity is omitted',async()=>{
  const measurements=createStudyMeasurements(async()=>({managedConnections:3,catalogSnapshotConnections:1,
    observedCatalogTransactions:2,maxCatalogTransactionAgeMs:12,identity:'private-pid'}));
  await measurements.tick(); const summary=measurements.summary();
  assert.equal(summary.peaks.catalogSnapshotConnections,1);assert.equal(summary.coverage.maxCatalogTransactionAgeMs,1);
  assert.equal(summary.bins[0].values.managedConnections.max,3);assert.ok(!JSON.stringify(summary).includes('private-pid'));
});
