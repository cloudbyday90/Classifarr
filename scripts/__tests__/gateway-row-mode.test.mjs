/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROW_ORDER, ROW_BOUND_FIXTURES, requireRowParity, requireArrayFields, requireRowRuns, rowPromotionScreen } from '../fixtures/ollamaGatewayRehearsal/rowModeContract.mjs';
import { bindStudySources } from '../lib/gatewayStudyBinding.mjs';
import { observeRowRun } from '../fixtures/ollamaGatewayRehearsal/rowModeObservations.mjs';
import { requireRowModeRecords } from '../lib/gatewayRowModeStudy.mjs';

const fixtureUrl = name => new URL(`../fixtures/ollamaGatewayRehearsal/${name}`,import.meta.url);
const read = url => readFileSync(url,'utf8');
const readerSource = read(new URL('../../server/src/ollamaGateway/catalogRowReader.mjs',import.meta.url));
const contentSource = read(new URL('../../server/src/ollamaGateway/catalogContent.mjs',import.meta.url));
const candidateSource = read(fixtureUrl('rowModeCandidate.mjs')), commonSource = read(fixtureUrl('rowModeContent.mjs'));
const fields = (dependencies = false) => (dependencies ? [['id',2950],['bytes',23],['required',16],['row',25]] : [['id',2950],['row',25]])
  .map(([name,dataTypeID]) => ({ name,dataTypeID,format:'text' }));
const tuple = ['019f0000-0000-7000-8000-000000000001','{"title":"日本語 🎬"}'];
// Import the committed fixture with fixed app imports rebased for this host-only test.
const hostSource = candidateSource.replaceAll(/from '\/app\/src\/ollamaGateway\/([A-Za-z]+)\.mjs'/g,(_,name) =>
  `from '${new URL(`../../server/src/ollamaGateway/${name}.mjs`,import.meta.url).href}'`)
  .replace("from './rowModeContract.mjs'",`from '${fixtureUrl('rowModeContract.mjs').href}'`);
const candidate = await import(`data:text/javascript;base64,${Buffer.from(hostSource).toString('base64')}`);
function fakeClient({ tuples = [tuple], dependencies = false, failSchema = false } = {}) {
  const calls = []; let fetched = false;
  return { calls,async query(config) {
    const text = typeof config === 'string' ? config : config.text; calls.push(config);
    if (text.startsWith('SELECT string_agg')) {
      const { CATALOG_COLUMNS } = await import('../../server/src/ollamaGateway/catalogContract.mjs');
      return { rows:[{ columns:failSchema ? 'changed' : CATALOG_COLUMNS[0] }] };
    }
    if (text.startsWith('FETCH')) {
      assert.deepEqual(config,{ text:'FETCH FORWARD 16 FROM gateway_catalog_cursor',rowMode:'array' });
      const rows = fetched ? [] : tuples; fetched = true; return { fields:fields(dependencies),rows };
    }
    return { rows:[] };
  } };
}
test('candidate permits only the reviewed array mapping and common accumulator injection', () => {
  requireRowParity(readerSource,contentSource,candidateSource,commonSource);
  for (const source of [candidateSource.replace('131072','1'),candidateSource.replace('count >','count >=')]) {
    if (source !== candidateSource) assert.throws(() => requireRowParity(readerSource,contentSource,source,commonSource));
  }
  assert.throws(() => requireRowParity(readerSource,contentSource,candidateSource,commonSource.replace("hash.update(row.row)","hash.update('reduced')")));
  assert.throws(() => requireRowParity(readerSource.replace('FORWARD 16','FORWARD 4'),contentSource,candidateSource,commonSource));
});
test('array metadata and tuples are fixed; reordered, binary, oversized and object results refuse', () => {
  requireArrayFields({ fields:fields(),rows:[tuple] },false);
  for (const value of [{ fields:fields().reverse(),rows:[tuple] },{ fields:fields().map(row => ({...row,format:'binary'})),rows:[tuple] },
    { fields:fields(),rows:[{id:tuple[0],row:tuple[1]}] },{ fields:fields(),rows:[tuple.concat('extra')] },
    { fields:fields(),rows:Array(17).fill(tuple) },{ fields:fields(),rows:[[null,tuple[1]]] }]) assert.throws(() => requireArrayFields(value,false));
});
test('candidate preserves canonical callback shape, fixed batches and cursor cleanup', async () => {
  const client = fakeClient(), rows = []; await candidate.visitCatalogRows(client,0,row => rows.push(row));
  assert.deepEqual(rows,[{id:tuple[0],row:tuple[1]}]); assert.equal(client.calls.at(-1),'CLOSE gateway_catalog_cursor');
  for (const failure of ['consumer','cancel','oversize','schema']) {
    const control = new AbortController(), broken = fakeClient({ failSchema:failure === 'schema',
      tuples:failure === 'oversize' ? [[tuple[0],'x'.repeat(131073)]] : [tuple,tuple] });
    await assert.rejects(candidate.visitCatalogRows(broken,0,() => {
      if (failure === 'consumer') throw Error('synthetic'); if (failure === 'cancel') control.abort();
    },control.signal));
    if (failure !== 'schema') assert.equal(broken.calls.at(-1),'CLOSE gateway_catalog_cursor');
    else assert.equal(broken.calls.length,1);
  }
});
test('excluded dependency rows retain sizes, booleans, body-null and selected-set validation', async () => {
  const client = fakeClient({ dependencies:true,tuples:[[tuple[0],100,false,null]] });
  await candidate.visitCatalogDependencyRows(client,() => assert.fail());
  for (const row of [[tuple[0],131073,false,null],[tuple[0],100,false,'hidden'],[tuple[0],100,'false',null],
    [tuple[0],0,true,'body']]) {
    const broken = fakeClient({ dependencies:true,tuples:[row] });
    await assert.rejects(candidate.visitCatalogDependencyRows(broken,() => {})); assert.equal(broken.calls.at(-1),'CLOSE gateway_catalog_cursor');
  }
  for (const selected of [[],new Set(['invalid'])]) assert.throws(() => candidate.visitCatalogDependencyRows(client,() => {},undefined,selected));
});
test('source binding rejects dirty/replaced/uncommitted files and records every copied fixture', () => {
  const revision = 'a'.repeat(40), image = `sha256:${'b'.repeat(64)}`;
  const git = args => args[0] === 'rev-parse' ? revision : args[0] === 'status' ? '' : 'public\n';
  const result = bindStudySources({ revision,image,read:() => 'public\r\n',git });
  assert.deepEqual(Object.keys(result.manifest.files),ROW_BOUND_FIXTURES); assert.match(result.sha256,/^[a-f0-9]{64}$/);
  assert.throws(() => bindStudySources({ revision,image,read:() => 'changed',git }));
  assert.throws(() => bindStudySources({ revision,image,read:() => 'public\n',git:args => args[0] === 'status' ? ' M source' : git(args) }));
  assert.throws(() => bindStudySources({ revision:'c'.repeat(40),image,read:() => 'public\n',git }));
});
const runs = (lane, ratio = 1) => ROW_ORDER.map(mode => ({ lane,mode,equivalent:true,fetchedRows:3002,bodyBytes:233000000,chargedBytes:233003002,
  contentSha256:'c'.repeat(64),elapsedMs:100,queryMs:90,processCpuUs:10,
  ...(lane === 'allocations' ? { profile:{ sampledEstimatedBytes:mode === 'array' ? 1000*ratio : 1000 } } : {}) }));
test('counterbalanced sequence and the predeclared promotion screen reject partial, reordered and noisy success', () => {
  const natural = runs('natural'), allocations = runs('allocations'); requireRowRuns(natural,'natural');
  assert.equal(rowPromotionScreen(natural,allocations).promising,false);
  assert.equal(rowPromotionScreen(natural,runs('allocations',0.8)).promising,true);
  const noisy = runs('allocations',0.8); noisy[1].profile.sampledEstimatedBytes = 950;
  assert.equal(rowPromotionScreen(natural,noisy).promising,false);
  const slow = runs('natural').map(row => ({ ...row,elapsedMs:row.mode === 'array' ? 106 : 100 }));
  assert.equal(rowPromotionScreen(slow,runs('allocations',0.8)).promising,false);
  for (const rows of [natural.slice(1),[natural[1],natural[0],...natural.slice(2)],natural.map((row,i) => i ? row : {...row,contentSha256:'d'.repeat(64)})]) {
    assert.throws(() => requireRowRuns(rows,'natural'));
  }
  assert.throws(() => requireRowModeRecords([{passed:true}],'natural',{}));
});
test('observer refuses absent counters and cleans up after worker failure', async () => {
  await assert.rejects(observeRowRun(async () => { throw Error('cancelled'); },async () => ({})));
  await assert.rejects(observeRowRun(async () => 1,async () => ({rss:1})));
  const keys = ['rss','heapUsed','heapTotal','external','arrayBuffers','heapPhysical','v8Malloc','currentBytes','anonBytes','fileBytes'];
  const result = await observeRowRun(async () => 1,async () => Object.fromEntries(keys.map(key => [key,1])));
  assert.equal(result.value,1); assert.equal(result.observations.samples,2);
});
