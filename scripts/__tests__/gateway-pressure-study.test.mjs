/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pressureMemory,pressureIo,pressureCpu,createPressureAccounting,pressureDelta } from '../fixtures/ollamaGatewayRehearsal/pressureAccounting.mjs';
import { requirePressureCapture } from '../lib/gatewayPressureContract.mjs';
import { runGatewayPressureStudy } from '../lib/gatewayPressureStudy.mjs';
import { seedPressureHistory } from '../fixtures/ollamaGatewayRehearsal/pressureHistory.mjs';
import { qualifyCatalogScenario } from '../lib/gatewayCatalogQualificationScenarios.mjs';

const image=`sha256:${'a'.repeat(64)}`,revision='b'.repeat(40);
const unavailable={status:'unavailable',attempts:[]};
const endpoint={version:2,interfaces:{memory:unavailable,pressure:unavailable,io:unavailable,cpu:unavailable}};
const metric=()=>({fixture:'metrics',workerElapsedMs:2000,accounting:{before:endpoint,after:endpoint,delta:pressureDelta(endpoint,endpoint)}});
const observation=()=>({fixture:'observations',samples:4,capReached:false,failedSamples:0,maxGapMs:510,
  coverage:{current:4,cgroup:4,worker:0},peaks:{cgroup:{value:268435456}}});
const result=()=>({captures:[metric(),metric()],historyPreserved:true,history:{bytes:228000000,
  shape:{version:1,rows:3000,paddingBytes:75000,payloadSha256:'c'.repeat(64)}}});

test('memory counters retain version-specific units and refuse malformed known fields',()=>{
  assert.deepEqual(pressureMemory('anon 12\npgscan 3\nunknown 9',2),{anon:12,pgscan:3});
  assert.deepEqual(pressureMemory('total_rss 12\ntotal_pgpgout 3',1),{total_rss:12,total_pgpgout:3});
  for(const [raw,version] of [['anon 1\nanon 2',2],['anon -1',2],['anon 1 extra',2],['anon 9007199254740992',2],
    ['anon 1',1],['',2],['x'.repeat(65537),2],['anon 1','__proto__']]) assert.throws(()=>pressureMemory(raw,version));
});

test('I/O counters select disjoint operations and reject duplicate, incomplete or oversized rows',()=>{
  assert.deepEqual(pressureIo('8:0 Read 10\n8:0 Write 20\n8:0 Sync 25\n8:0 Total 30\nTotal 30',1),{readBytes:10,writeBytes:20});
  assert.deepEqual(pressureIo('8:0 wbytes=20 rbytes=10 rios=1\n8:1 rbytes=30 wbytes=40',2),{readBytes:40,writeBytes:60});
  for(const version of [1,2]) assert.deepEqual(pressureIo('',version),{readBytes:0,writeBytes:0});
  assert.deepEqual(pressureIo('Total 0',1),{readBytes:0,writeBytes:0});
  for(const [raw,version] of [['8:0 Read 1\n8:0 Read 1\n8:0 Write 2',1],['Total 1\nTotal 1',1],['Total 1',1],['8:0 Read 1',1],
    ['8:0 rbytes=1 wbytes=2\n8:0 rbytes=1 wbytes=2',2],['8:0 rbytes=1 rbytes=2 wbytes=3',2],['8:0 rios=1',2],
    ['8:0 rbytes=-1 wbytes=2',2],['x'.repeat(65537),2]]) assert.throws(()=>pressureIo(raw,version));
});

test('CPU units stay versioned and duplicate or malformed fields cannot become valid accounting',()=>{
  assert.deepEqual(pressureCpu('usage_usec 10\nthrottled_usec 2',2),{cpuUsageUs:10,cpuThrottledUs:2});
  assert.deepEqual(pressureCpu('nr_periods 4\nthrottled_time 2000',1),{cpuThrottledUs:2});
  for(const raw of ['usage_usec 1\nusage_usec 2','usage_usec 1 extra','usage_usec -1','nr_periods 1','']) assert.throws(()=>pressureCpu(raw,2));
});

test('fixed read-only interfaces preserve denial/absence and never sum overlapping fallbacks or expose errors',async()=>{
  const paths=[];
  const sample=await createPressureAccounting({version:1,now:()=>0,read:async path=>{
    paths.push(path);
    if(path.endsWith('memory.stat')) return 'total_rss 12\ntotal_pgfault 3';
    if(path.endsWith('memory.pressure')) throw Object.assign(Error('private credential'),{code:'EACCES'});
    if(path.endsWith('blkio.throttle.io_service_bytes')) throw Object.assign(Error('private path'),{code:'ENOENT'});
    if(path.endsWith('blkio.io_service_bytes')) return '8:0 Read 10\n8:0 Write 20';
    if(path.endsWith('cpu.stat')) return 'nr_periods 1\nthrottled_time 1000';
    throw Error('unexpected');
  }})();
  assert.equal(sample.interfaces.io.interface,'v1_service');
  assert.deepEqual(sample.interfaces.io.values,{readBytes:10,writeBytes:20});
  assert.deepEqual(sample.interfaces.io.attempts,[{interface:'v1_throttle',status:'absent'}]);
  assert.deepEqual(sample.interfaces.pressure,{status:'unavailable',attempts:[{interface:'v1_pressure',status:'denied'}]});
  assert.ok(!paths.some(path=>path.includes('recursive')));assert.ok(!JSON.stringify(sample).includes('private'));
  let reads=0;
  const budget=await createPressureAccounting({version:2,now:(()=>{let n=0;return()=>n++ ? 100 : 0;})(),read:async()=>{reads++;}})();
  assert.equal(reads,0);assert.equal(budget.interfaces.memory.attempts[0].status,'budget_exhausted');
});

test('invalid and failed optional reads stay unavailable; available empty device accounting is explicit',async()=>{
  const sample=await createPressureAccounting({version:2,now:()=>0,read:async path=>{
    if(path.endsWith('io.stat'))return '';
    if(path.endsWith('memory.stat'))return 'anon no';
    throw Error('sensitive detail');
  }})();
  assert.equal(sample.interfaces.io.status,'available');assert.deepEqual(sample.interfaces.io.values,{readBytes:0,writeBytes:0});
  assert.equal(sample.interfaces.memory.attempts[0].status,'invalid');assert.equal(sample.interfaces.cpu.attempts[0].status,'read_failed');
  assert.throws(()=>createPressureAccounting({version:0,read:async()=>''}));
});

test('deltas exclude gauges and refuse reset, version or interface changes',()=>{
  const first={version:2,interfaces:{memory:{status:'available',interface:'v2_memory',values:{anon:100,pgscan:4}},
    io:{status:'available',interface:'v2_io',values:{readBytes:10,writeBytes:20}}}};
  const last=structuredClone(first);last.interfaces.memory.values={anon:50,pgscan:8};last.interfaces.io.values.readBytes=12;
  assert.deepEqual(pressureDelta(first,last).memory.values,{pgscan:4});assert.equal(pressureDelta(first,last).io.values.readBytes,2);
  last.interfaces.io.values.readBytes=1;assert.equal(pressureDelta(first,last).io.status,'counter_reset');
  last.interfaces.io.interface='other';assert.equal(pressureDelta(first,last).io.status,'unavailable');
  last.version=1;assert.equal(pressureDelta(first,last).memory.status,'unavailable');
});

test('large captures require endpoint evidence and meaningful sampled coverage without requiring optional process data',()=>{
  assert.deepEqual(requirePressureCapture([metric()],false),metric());
  assert.equal(requirePressureCapture([metric(),observation()],true).observation.samples,4);
  for(const mutate of [v=>{v.samples=0;},v=>{v.samples=421;},v=>{v.capReached=true;},v=>{v.failedSamples=1;},
    v=>{v.maxGapMs=5001;},v=>{v.coverage.current=3;},v=>{v.coverage.cgroup=5;},v=>{v.peaks.cgroup.value=NaN;}]) {
    const value=observation();mutate(value);assert.throws(()=>requirePressureCapture([metric(),value],true));
  }
  assert.throws(()=>requirePressureCapture([metric()],true));assert.throws(()=>requirePressureCapture([metric(),observation()],false));
  assert.throws(()=>requirePressureCapture([metric(),metric()],false));
  assert.throws(()=>requirePressureCapture([metric(),observation(),observation()],true));
  assert.throws(()=>requirePressureCapture([metric()],undefined));
  const missing=metric();delete missing.accounting;assert.throws(()=>requirePressureCapture([missing],false));
  const slow=metric();slow.workerElapsedMs=210000;assert.throws(()=>requirePressureCapture([slow],false));
});

test('four runs are sequential ABBA on the identical image, revision and explicit pressure shape',async()=>{
  const calls=[],reports=[];let active=0;
  await runGatewayPressureStudy(image,revision,async(...args)=>{
    active++;assert.equal(active,1);calls.push(args);await Promise.resolve();active--;return[result()];
  },row=>reports.push(row));
  assert.deepEqual(calls.map(args=>args[5]),[false,true,true,false]);
  assert.ok(calls.every(args=>JSON.stringify(args.slice(0,5))===JSON.stringify([image,revision,false,true,'catalog-pressure'])));
  assert.equal(reports.at(-1).stage,'passed_cleanup_verified');assert.equal(reports.at(-1).runs,4);
});

test('mismatched or incomplete history, failed cleanup and failed captures stop the study without retries',async()=>{
  for(const mutate of [v=>{delete v.history.shape;},v=>{v.history.shape.rows=2999;},v=>{v.history.shape.payloadSha256='bad';},
    v=>{v.history.bytes=268435456;},v=>{v.historyPreserved=false;},v=>{v.captures.pop();}]) {
    let calls=0;
    await assert.rejects(runGatewayPressureStudy(image,revision,async()=>{calls++;const value=result();mutate(value);return[value];},()=>{}));
    assert.equal(calls,1);
  }
  let calls=0;
  await assert.rejects(runGatewayPressureStudy(image,revision,async()=>{calls++;const value=result();if(calls===2)value.history.shape.payloadSha256='d'.repeat(64);return[value];},()=>{}));
  assert.equal(calls,2);
  await assert.rejects(runGatewayPressureStudy(image,revision,async()=>{throw Error('cleanup_failed');},()=>{}),/cleanup_failed/);
  await assert.rejects(runGatewayPressureStudy('tag',revision,async()=>assert.fail(),()=>{}));
  await assert.rejects(seedPressureHistory({query:async()=>({rows:[]})},{}));
});

test('pressure scenario restores twice, checks unchanged history and retains both refusal drills without the old warmup',async()=>{
  const actions=[],reports=[],states=['catalog_empty','awaiting_verification','awaiting_catalog_verification',
    'awaiting_catalog_verification','catalog_unchanged','catalog_attempts_exhausted','archive_blocked'];
  const history={rows:3000,bytes:228000000,sha256:'e'.repeat(64),shape:result().history.shape};
  const fixture=action=>{
    actions.push(action);
    if(['wide','pressure-history'].includes(action))return history;
    if(action==='inspect')return{jobs:[{status:'verified'},{status:'verified'}],roots:[{},{}],cleanupOperations:0};
    return{};
  };
  let restores=0;
  const value=await qualifyCatalogScenario({shape:'catalog-pressure',measure:false,fixture,report:row=>reports.push(row),
    hasState:(rows,state)=>assert.ok(rows.some(row=>row.state===state)),run:async kind=>{
      if(kind!=='archiver'){restores++;return[{state:'verified'}];}
      const state=states.shift();return[{state,...(state==='archive_blocked' ? {reason:'gateway_archive_history_size_limit'} : {})},metric()];
    }});
  assert.equal(restores,3);assert.equal(value.historyPreserved,true);assert.equal(value.captures.length,2);assert.equal(states.length,0);
  assert.deepEqual(actions,['admit','history','acknowledge-inference','wide','pressure-history','inspect','history-change',
    'inspect','fingerprint','inspect','fingerprint','oversized-evidence','inspect','inspect','fingerprint']);
  assert.deepEqual(reports.filter(row=>row.stage).map(row=>row.stage),['large_capture_1','large_capture_2']);
});
