/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { url as inspectorUrl } from 'node:inspector';
import { RESTORE_STUDY, validateRestoreIdentity, requireRestoreReceipt, runRestoreStudySequence } from '../fixtures/ollamaGatewayRehearsal/restoreStudyContract.mjs';
import { summarizeRestoreHeap, sampleRestoreAllocations, requireRestoreHeapSummary } from '../fixtures/ollamaGatewayRehearsal/restoreStudyHeap.mjs';
import { RESTORE_METRICS, createRestoreMeasurements, requireRestoreCoverage } from '../fixtures/ollamaGatewayRehearsal/restoreStudyMetrics.mjs';
import { restoreStudyDockerArgs, assertRestoreStudySandbox, requireRestoreStudyRecords } from '../lib/gatewayRestoreMemoryStudy.mjs';

const identity = { archiveId: '019f0000-0000-7000-8000-000000000001', dumpBytes: 233000000,
  dumpSha256: 'a'.repeat(64), manifestSha256: 'b'.repeat(64), sourceSha256: 'c'.repeat(64) };
const receipt = { kind: 'catalog_verification', version: 1, archiveId: identity.archiveId, manifestSha256: identity.manifestSha256,
  dumpSha256: identity.dumpSha256, rowsRestored: true, dependenciesAvailable: true, runtimeEnabled: false, purgeAuthorized: false };
const heapNode = (bytes = 10, url = 'private-SECRET') => ({ selfSize: bytes, children: [], callFrame: { url, functionName: 'SECRET' } });
const profile = () => ({ head: heapNode(), samples: [{}] });
const coverage = () => ({ version: 1, samples: 680, elapsedMs: 620000, maxGapMs: 1000, failedSamples: 0, capReached: false,
  coverage: Object.fromEntries(RESTORE_METRICS.map(key => [key,680])), bins: [
    { phase:'baseline', cycle:0, samples:60 }, ...[1,2,3,4,5].flatMap(cycle => [
      { phase:'restore', cycle, samples:4 }, { phase:'quiet', cycle, samples:60 }]), { phase:'tail', cycle:5, samples:300 }] });

test('exact identity and full successful receipt are required; a fulfilled false receipt is insufficient', () => {
  requireRestoreReceipt(receipt, identity);
  for (const patch of [{ rowsRestored:false },{ dependenciesAvailable:false },{ runtimeEnabled:true },{ purgeAuthorized:true },
    { dumpSha256:'d'.repeat(64) },{ archiveId:'019f0000-0000-7000-8000-000000000002' },{ extra:1 }]) {
    assert.throws(() => requireRestoreReceipt({ ...receipt,...patch }, identity));
  }
  for (const patch of [{ archiveId:identity.archiveId.replace('-7000','-4000') },{ dumpBytes:268435457 },{ extra:1 }]) {
    assert.throws(() => validateRestoreIdentity({ ...identity,...patch }));
  }
});
test('finite natural protocol has one baseline, four gaps and a tail; diagnostic lane never fabricates elapsed pauses', async () => {
  for (const lane of ['natural','allocations']) {
    const pauses=[], cycles=[], boundaries=[];
    await runRestoreStudySequence({ lane, signal:new AbortController().signal, restore:async cycle => cycles.push(cycle),
      pause:async ms => pauses.push(ms), boundary:async (...args) => boundaries.push(args) });
    assert.deepEqual(cycles,[1,2,3,4,5]); assert.equal(boundaries.length,12);
    assert.deepEqual(pauses,lane === 'natural' ? [60000,60000,60000,60000,60000,300000] : []);
    assert.equal(RESTORE_STUDY.restoreMs,180000); assert.ok(Object.isFrozen(RESTORE_STUDY));
  }
});
test('restore failure and cancellation stop the sequence without retry', async () => {
  for (const cancel of [false,true]) {
    let calls=0; const controller=new AbortController();
    await assert.rejects(runRestoreStudySequence({ lane:'allocations',signal:controller.signal,boundary:async()=>{},pause:async()=>{},
      restore:async()=>{ calls++; if(cancel) controller.abort(); else throw new Error('refusal'); } })); assert.equal(calls,1);
  }
});
test('profile reduction keeps exclusive numeric components, never stacks, URLs or names', () => {
  const value=profile(); value.head.children=[heapNode(20,'file:///app/src/ollamaGateway/catalogRowReader.mjs'),
    heapNode(30,'file:///app/node_modules/pg-protocol/parser.js')];
  const result=summarizeRestoreHeap(value);
  requireRestoreHeapSummary(result);
  assert.equal(result.sampledEstimatedBytes,60); assert.deepEqual(result.components,{other:10,database_transport:30,catalog_hash:20});
  assert.ok(!JSON.stringify(result).includes('SECRET')); assert.equal(result.nodes,3);
  assert.throws(()=>requireRestoreHeapSummary({...result,components:{SECRET:60}}));
});
test('malformed, excessive, cyclic, deep and unsafe numeric profiles fail closed', () => {
  const cyclic=profile(); cyclic.head.children.push(cyclic.head);
  const deep=profile(); let node=deep.head; for(let i=0;i<65;i++) { node.children=[heapNode()]; node=node.children[0]; }
  const wide=profile(); wide.head.children=Array(50001).fill(heapNode());
  for(const value of [null,{head:heapNode(),samples:Array(200001).fill({})},cyclic,deep,wide,
    {head:heapNode(-1),samples:[]},{head:heapNode(Infinity),samples:[]},{head:heapNode(Number.MAX_SAFE_INTEGER+1),samples:[]}]) {
    assert.throws(()=>summarizeRestoreHeap(value));
  }
});
test('inspector disconnects after start, work, stop and malformed-profile failures', async () => {
  for(const failure of ['none','start','work','stop','profile']) {
    const calls=[]; let stops=0;
    const session={connect(){calls.push('connect');},disconnect(){calls.push('disconnect');},async post(method,params){
      calls.push(method); if(method.endsWith('startSampling')) { assert.equal(params.samplingInterval,524288); if(failure==='start') throw Error(); }
      if(method.endsWith('stopSampling')) { stops++; if(failure==='stop' && stops===1) throw Error(); return {profile:failure==='profile'?{}:profile()}; }
    }};
    const run=()=>sampleRestoreAllocations(async()=>{if(failure==='work') throw Error(); return 1;},{session});
    if(failure==='none') assert.equal((await run()).value,1); else await assert.rejects(run());
    assert.equal(calls.at(-1),'disconnect'); assert.ok(calls.every(name=>!name.includes('collectGarbage')&&!name.includes('Snapshot')));
  }
});
test('native inspector sampling uses no listening endpoint and emits only a reduced profile', async () => {
  assert.equal(inspectorUrl(), undefined);
  const result = await sampleRestoreAllocations(async () => Array.from({length:10000},(_,index)=>`public-study-${index}`).length);
  assert.equal(result.value,10000); assert.equal(result.profile.samplingInterval,524288);
  assert.ok(result.profile.nodes > 0); assert.equal(inspectorUrl(),undefined);
});
test('measurements are finite and reject missing coverage, timing gaps and missing natural phases', async () => {
  let now=0; const metrics=createRestoreMeasurements(async()=>Object.fromEntries(RESTORE_METRICS.map(key=>[key,10])),{now:()=>now});
  await metrics.tick(); now=1000; await metrics.tick(); assert.equal(metrics.summary().samples,2);
  await assert.rejects(metrics.phase('untrusted',0)); await assert.rejects(metrics.phase('quiet',6));
  requireRestoreCoverage(coverage(),'natural');
  for(const patch of [{maxGapMs:6000},{maxGapMs:-1},{capReached:true},{failedSamples:1},{coverage:{}},{elapsedMs:10},
    {bins:coverage().bins.filter(bin=>bin.phase!=='tail')},{bins:coverage().bins.filter(bin=>bin.phase!=='baseline')}]) {
    assert.throws(()=>requireRestoreCoverage({...coverage(),...patch},'natural'));
  }
  const broken=createRestoreMeasurements(async()=>({rss:NaN})); await broken.tick(); assert.equal(broken.summary().failedSamples,1);
});
test('host validator rejects a passed flag without complete cycles, coverage and resource proof', () => {
  const rows=[...[1,2,3,4,5].map(cycle=>({fixture:'restore-cycle',lane:'natural',cycle,verified:true,scratchEmpty:true,noChildren:true,durationMs:1})),
    {fixture:'restore-study',lane:'natural',passed:true,cycles:5,observations:coverage(),gc:{forced:0},
      memoryEvents:{under_oom:'0',oom_kill:'0',limitHits:'0'},pidsEvents:'max 0'}];
  rows.push({fixture:'restore-limits',lane:'natural',version:1,memory:'1610612736',swap:'0',pids:'64',cpu:'100000 100000'});
  requireRestoreStudyRecords(rows,'natural');
  for(const value of [rows.slice(1),[...rows.slice(0,5),{...rows[5],observations:{}},rows[6]],
    [...rows.slice(0,5),{...rows[5],memoryEvents:{oom_kill:'1'}},rows[6]]]) assert.throws(()=>requireRestoreStudyRecords(value,'natural'));
});
test('sandbox is fixed, input-only and rejects wrong mounts, writable receipts, secrets and host PID namespace', () => {
  const volumes=Object.fromEntries(['archives','receipts','catalogs','fixtures'].map(name=>[name,`owned-${name}`]));
  const args=restoreStudyDockerArgs({name:'owned',label:'owned=yes',image:'image',lane:'natural',mount:(kind,path,readonly)=>
    ['--mount',`type=volume,source=${volumes[kind]},target=${path}${readonly?',readonly':''}`]});
  assert.equal(args.filter(value=>value.endsWith(',readonly')).length,4); assert.ok(!args.some(value=>value.includes('source-socket')));
  const value={Image:'image',HostConfig:{NetworkMode:'none',ReadonlyRootfs:true,Privileged:false,PidMode:'',Init:true,CapDrop:['ALL'],
    SecurityOpt:['no-new-privileges'],Memory:1610612736,MemorySwap:1610612736,NanoCpus:1000000000,PidsLimit:64,
    Tmpfs:{'/verification':'rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev','/tmp':'rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev'}},
  Config:{User:'1000:1000',Entrypoint:['node'],Cmd:['/fixtures/restoreStudyWorker.mjs','natural'],Env:[]},
  Mounts:Object.entries(volumes).map(([kind,Name])=>({Destination:`/${kind}`,Name,Type:'volume',RW:false}))};
  assertRestoreStudySandbox(value,'image','natural',volumes);
  for(const mutate of [v=>{v.Mounts[0].RW=true;},v=>{v.Mounts[1].Name='unowned';},v=>{v.HostConfig.PidMode='host';},
    v=>{v.Config.Env=['NODE_OPTIONS=--inspect'];},v=>{v.Mounts.push({Destination:'/var/run/docker.sock',RW:false});}]) {
    const changed=structuredClone(value); mutate(changed); assert.throws(()=>assertRestoreStudySandbox(changed,'image','natural',volumes));
  }
});
test('CLI remains fixed and source/counters are checked on both sides; production verifier is not modified', () => {
  const runner=readFileSync(new URL('../run-gateway-online-archive-rehearsal.mjs',import.meta.url),'utf8');
  assert.ok(runner.includes("'--restore-memory'")); assert.ok(runner.includes('process.argv.length > 5'));
  const source=readFileSync(new URL('../fixtures/ollamaGatewayRehearsal/restoreStudySource.mjs',import.meta.url),'utf8');
  assert.ok(source.includes('REPEATABLE READ READ ONLY')); assert.ok(source.includes("action === 'before'"));
  assert.ok(source.includes('assert.deepEqual(identity, JSON.parse'));
});
