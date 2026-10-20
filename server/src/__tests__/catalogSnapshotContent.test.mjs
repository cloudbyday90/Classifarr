/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import {jest} from '@jest/globals';
let source,context,active,calls;
jest.unstable_mockModule('../ollamaGateway/onlineArchiveSnapshot.mjs',()=>({assertArchiveSnapshot:(client,value)=>{
  if(!active||client!==source||value!==context)throw Error('snapshot_invalid');
}}));
const capture=jest.fn(async(_client,signal,budget,version=1,first=0)=>{
  signal?.throwIfAborted(); calls.push([version,first]);
  const tables={};
  for(const index of (first===3?[3]:version===1?[0,1,2]:[0,1,2,3])){
    budget.bytes+=10; if(budget.bytes>268435456)throw Error('gateway_catalog_size_limit');
    tables[index]={count:1,maxId:'id',sha256:'hash'};
  }
  return tables;
});
jest.unstable_mockModule('../ollamaGateway/catalogContent.mjs',()=>({captureCatalogContent:capture}));
const {withCatalogSnapshotContent,captureSnapshotCatalogContent}=await import('../ollamaGateway/catalogSnapshotContent.mjs');
beforeEach(()=>{source={getTransactionStatus:()=> 'T'}; context={}; active=true; calls=[]; capture.mockClear();});

test('only base summaries are reused; successful charges and fresh fourth-table reads are exact',async()=>{
  await withCatalogSnapshotContent(source,context,undefined,async tables=>{
    expect(()=>{tables[0].count=0;}).toThrow();
    for(const start of [0,5,268435416]){
      const budget={bytes:start}; const result=await captureSnapshotCatalogContent(source,context,undefined,budget);
      expect(Object.keys(result)).toEqual(['0','1','2','3']); expect(budget.bytes).toBe(start+40);
    }
  });
  expect(calls).toEqual([[1,0],[3,3],[3,3],[3,3]]);
  const budget={bytes:0}; await captureSnapshotCatalogContent(source,context,undefined,budget);
  expect(calls.at(-1)).toEqual([3,0]); expect(budget.bytes).toBe(40);
});

test.each([268435427,268435437,268435447,268435456])('overflow replays original streaming error and exact failed budget (%i)',async start=>{
  const original={bytes:start}; await expect(capture(source,undefined,original,3)).rejects.toThrow('gateway_catalog_size_limit');
  await withCatalogSnapshotContent(source,context,undefined,async()=>{
    const reused={bytes:start}; await expect(captureSnapshotCatalogContent(source,context,undefined,reused)).rejects.toThrow('gateway_catalog_size_limit');
    expect(reused.bytes).toBe(original.bytes); expect(calls.at(-1)).toEqual([3,0]);
  });
});

test('tail overflow also preserves original accounting',async()=>{
  await withCatalogSnapshotContent(source,context,undefined,async()=>{
    const budget={bytes:268435421}; await expect(captureSnapshotCatalogContent(source,context,undefined,budget)).rejects.toThrow('gateway_catalog_size_limit');
    expect(budget.bytes).toBe(268435461); expect(calls.at(-1)).toEqual([3,3]);
  });
});

test('wrong capability, transaction loss and cancellation refuse before reuse',async()=>{
  await withCatalogSnapshotContent(source,context,undefined,async()=>{
    await expect(captureSnapshotCatalogContent({},context,undefined,{bytes:0})).rejects.toThrow('snapshot_invalid');
    await expect(captureSnapshotCatalogContent(source,{},undefined,{bytes:0})).rejects.toThrow('snapshot_invalid');
    source.getTransactionStatus=()=> 'I';
    await expect(captureSnapshotCatalogContent(source,context,undefined,{bytes:0})).rejects.toThrow('gateway_archive_snapshot_invalid');
    await expect(captureSnapshotCatalogContent(source,context,AbortSignal.abort(),{bytes:0})).rejects.toThrow();
  });
});

test('throwing callback removes summaries; failed base capture cannot register partial state',async()=>{
  await expect(withCatalogSnapshotContent(source,context,undefined,()=>{throw Error('rollback');})).rejects.toThrow('rollback');
  calls=[]; await captureSnapshotCatalogContent(source,context,undefined,{bytes:0}); expect(calls).toEqual([[3,0]]);
  capture.mockRejectedValueOnce(Error('base_failed'));
  await expect(withCatalogSnapshotContent(source,context,undefined,()=>{})).rejects.toThrow('base_failed');
  calls=[]; await captureSnapshotCatalogContent(source,context,undefined,{bytes:0}); expect(calls).toEqual([[3,0]]);
});
