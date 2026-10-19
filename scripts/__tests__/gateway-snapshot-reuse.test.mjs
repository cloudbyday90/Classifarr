/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { withSnapshotReuse } from '../fixtures/ollamaGatewayRehearsal/snapshotReuseCache.mjs';
import { requireReuseContentParity,REUSE_ORDER,requireReuseRuns } from '../fixtures/ollamaGatewayRehearsal/snapshotReuseContract.mjs';
import { studyPolicy } from '../lib/gatewayStudyPolicy.mjs';
import { assertSnapshotStudySource } from '../lib/gatewaySnapshotReuseStudy.mjs';

function fixture(patch = {}) {
  const client = new EventEmitter(), context = Object.freeze({report:{}}), calls = {retention:0,base:0,tail:0}; let valid = true;
  const options = {client,context,assertSnapshot:(session,capability) => {
    assert.ok(valid && session === client && capability === context,'snapshot_invalid');
  },readRetention:async () => {calls.retention++; return {entries:[{attempt:'2'}]};},
  readBase:async (_client,_signal,budget) => {calls.base++; budget.bytes+=11; return {base:{count:1}};},
  readTail:async (_client,_signal,budget,version,first) => {calls.tail++; assert.equal(version,3); assert.equal(first,3); budget.bytes+=7; return {tail:{count:1}};},...patch};
  return {client,context,calls,options,invalidate:() => {valid=false;}};
}

test('summary reuse preserves successful charges and always reads the fourth table',async () => {
  const f=fixture(); let escaped;
  await withSnapshotReuse(f.options,async cache => {
    escaped=cache; const inventory=await cache.retention(f.client,f.context);
    assert.equal(await cache.retention(f.client,f.context),inventory);
    assert.throws(()=>{inventory.entries[0].attempt='3';});
    const budget={bytes:5}; const tables=await cache.catalog(f.client,f.context,budget);
    assert.equal(budget.bytes,16); assert.throws(()=>{tables.base.count=2;});
    assert.deepEqual(await cache.catalog(f.client,f.context,budget,3),{base:{count:1},tail:{count:1}}); assert.equal(budget.bytes,34);
    await cache.catalog(f.client,f.context,{bytes:0},3);
    assert.deepEqual(f.calls,{retention:1,base:1,tail:2});
  });
  await assert.rejects(escaped.catalog(f.client,f.context,{bytes:0}),/snapshot_reuse_closed/);
  assert.equal(f.client.listenerCount('end'),0); assert.equal(f.client.listenerCount('error'),0);
});

test('guards reject wrong clients/clones, expired authority, invalid formats and budgets before a hit',async () => {
  const f=fixture();
  await withSnapshotReuse(f.options,async cache => {
    await cache.catalog(f.client,f.context,{bytes:0});
    await assert.rejects(cache.catalog(new EventEmitter(),f.context,{bytes:0}),/snapshot_reuse_client/);
    await assert.rejects(cache.catalog(f.client,{...f.context},{bytes:0}),/snapshot_reuse_context/);
    for (const bytes of [-1,NaN,Infinity,0.5,268435457]) await assert.rejects(cache.catalog(f.client,f.context,{bytes}),/snapshot_reuse_budget/);
    for (const version of [0,2,4,'3']) await assert.rejects(cache.catalog(f.client,f.context,{bytes:0},version),/snapshot_reuse_version/);
    const exact={bytes:268435445}; await cache.catalog(f.client,f.context,exact); assert.equal(exact.bytes,268435456);
    await assert.rejects(cache.catalog(f.client,f.context,{bytes:268435446}),/gateway_catalog_size_limit/);
    f.invalidate(); await assert.rejects(cache.catalog(f.client,f.context,{bytes:0}),/snapshot_invalid/);
  });
  assert.deepEqual(f.calls,{retention:0,base:1,tail:0});
});

for (const event of ['end','error']) test(`session ${event} invalidates even an already cached result`,async () => {
  const f=fixture();
  await withSnapshotReuse(f.options,async cache => {
    await cache.retention(f.client,f.context); f.client.emit(event);
    await assert.rejects(cache.retention(f.client,f.context),/snapshot_reuse_closed/);
  });
});

test('cancellation before and after capture refuses, and failures never poison the cache',async () => {
  const controller=new AbortController(); const f=fixture({signal:controller.signal});
  await withSnapshotReuse(f.options,async cache => {
    await cache.retention(f.client,f.context); controller.abort();
    await assert.rejects(cache.retention(f.client,f.context),{name:'AbortError'});
  });
  await assert.rejects(withSnapshotReuse(f.options,async ()=>{}),{name:'AbortError'});
  let attempts=0;
  const g=fixture({readBase:async (_client,_signal,budget)=>{attempts++; if(attempts===1) throw Error('read_failed'); budget.bytes+=4; return {base:{count:1}};}});
  await withSnapshotReuse(g.options,async cache=>{
    await assert.rejects(cache.catalog(g.client,g.context,{bytes:0}),/read_failed/);
    const budget={bytes:0}; await cache.catalog(g.client,g.context,budget); assert.equal(attempts,2); assert.equal(budget.bytes,4);
  });
  const late=new AbortController(), h=fixture({signal:late.signal,readRetention:async()=>{late.abort(); return {entries:[]};}});
  await assert.rejects(withSnapshotReuse(h.options,cache=>cache.retention(h.client,h.context)),{name:'AbortError'});
});

test('overlap refuses; returning or throwing disposes scope even with an outstanding read',async () => {
  let release; const f=fixture({readRetention:()=>new Promise(resolve=>{release=resolve;})}); let pending;
  await withSnapshotReuse(f.options,async cache=>{
    pending=cache.retention(f.client,f.context);
    await assert.rejects(cache.retention(f.client,f.context),/snapshot_reuse_busy/);
  });
  release({entries:[]}); await assert.rejects(pending,/snapshot_reuse_closed/);
  let escaped; const g=fixture();
  await assert.rejects(withSnapshotReuse(g.options,async cache=>{escaped=cache; throw Error('rollback');}),/rollback/);
  await assert.rejects(escaped.retention(g.client,g.context),/snapshot_reuse_closed/);
  await withSnapshotReuse(g.options,cache=>cache.retention(g.client,g.context)); assert.equal(g.calls.retention,1);
});

test('tail accumulator is production code with only the reviewed range-start parameter',()=>{
  const original=readFileSync(new URL('../../server/src/ollamaGateway/catalogContent.mjs',import.meta.url),'utf8');
  const candidate=readFileSync(new URL('../fixtures/ollamaGatewayRehearsal/snapshotReuseContent.mjs',import.meta.url),'utf8');
  requireReuseContentParity(original,candidate);
  for (const changed of [candidate.replace('268435456','999999999'),candidate.replace("hash.update(row.row)","hash.update('wrong')"),candidate.replace('first = 0','first = 3')]) {
    assert.throws(()=>requireReuseContentParity(original,changed));
  }
  assert.throws(()=>requireReuseContentParity(original.replace('let index = 0;','let index = 1;'),candidate));
});

test('comparison contract rejects mismatches and requires fewer logical bytes and queries in every pair',()=>{
  const runs=REUSE_ORDER.map(mode=>({mode,equivalent:true,sha256:'a'.repeat(64),chargedBytes:80,
    queries:mode==='baseline'?20:10,resultStringBytes:mode==='baseline'?100:70,elapsedMs:1,processCpuUs:1,queryMs:1}));
  requireReuseRuns(runs);
  for(const patch of [{sha256:'b'.repeat(64)},{chargedBytes:81},{equivalent:false},{queries:20},{resultStringBytes:100},{elapsedMs:NaN}]) {
    const changed=structuredClone(runs); Object.assign(changed[1],patch); assert.throws(()=>requireReuseRuns(changed));
  }
});

test('snapshot study closure and source sandbox exclude external access and writable executable inputs',()=>{
  const policy=studyPolicy('snapshot','regression'); assert.equal(policy.files.length,7); assert.deepEqual(policy.entries,['snapshotReuseStudy.mjs']);
  assert.deepEqual(policy.application,['catalogRowReader.mjs','catalogContent.mjs','onlineArchiveSnapshot.mjs','archiveRetentionQueries.mjs']);
  assert.throws(()=>studyPolicy('snapshot','extended'));
  const image=`sha256:${'a'.repeat(64)}`, volume='owned';
  const value={Image:image,HostConfig:{NetworkMode:'none',Privileged:false,PidMode:'',Memory:2147483648,MemorySwap:2147483648,NanoCpus:2000000000,PidsLimit:512,PortBindings:{}},
    Mounts:[{Type:'volume',Name:volume,Destination:'/fixtures',RW:false},{Type:'bind',Destination:'/app/data',RW:true}]};
  assertSnapshotStudySource(value,image,volume);
  for(const mutate of [v=>{v.Image='wrong';},v=>{v.HostConfig.NetworkMode='host';},v=>{v.HostConfig.MemorySwap=-1;},v=>{v.HostConfig.Privileged=true;},
    v=>{v.Mounts[0].RW=true;},v=>{v.Mounts[0].Name='foreign';},v=>{v.Mounts.push({Destination:'/socket'});}]) {
    const changed=structuredClone(value); mutate(changed); assert.throws(()=>assertSnapshotStudySource(changed,image,volume));
  }
});
