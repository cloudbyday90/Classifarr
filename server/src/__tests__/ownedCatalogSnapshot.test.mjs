/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import {jest} from '@jest/globals';
import {EventEmitter} from 'node:events';
import * as content from '../ollamaGateway/catalogSnapshotContent.mjs';

let client, context, events, capture, safe, role, live;
const configuration={database:{host:'/synthetic',database:'fixture',user:'reader'},providerHash:'d'.repeat(64),retentionDays:90};
const tables=Object.fromEntries(['gateway_archive.job','gateway_archive.protection','gateway_cleanup.operation'].map(name=>[name,{count:0,maxId:null,sha256:'a'.repeat(64)}]));
const connection=jest.fn(()=>client);
jest.unstable_mockModule('../ollamaGateway/archiveDatabaseClient.mjs',()=>({archiveDatabaseClient:connection}));
jest.unstable_mockModule('../ollamaGateway/catalogReader.mjs',()=>({checkCatalogReader:async()=>{if(!safe)throw Error('unsafe');}}));
jest.unstable_mockModule('../ollamaGateway/catalogCapture.mjs',()=>({captureScheduledCatalog:options=>capture(options)}));
jest.unstable_mockModule('../ollamaGateway/catalogSnapshotContent.mjs',()=>({...content,withCatalogSnapshotContent:async(_source,_context,_signal,consume)=>consume(tables)}));
jest.unstable_mockModule('../ollamaGateway/onlineArchiveSnapshot.mjs',()=>({
  assertArchiveSnapshot:(source,value)=>{if(!live||source!==client||value!==context)throw Error('snapshot_invalid');},
  withOnlineArchiveSnapshot:async(_source,_config,consume,signal)=>{
    live=true; client.status='T';
    try {const result=await consume(context); signal.throwIfAborted(); events.push('commit'); return result;}
    catch(error){events.push('rollback'); throw error;} finally{live=false;client.status='I';}
  },
}));
const {withOwnedCatalogSnapshot}=await import('../ollamaGateway/ownedCatalogSnapshot.mjs');

beforeEach(()=>{
  connection.mockClear(); events=[]; safe=true; role='reader'; live=false;
  context={report:{counts:{request_binding:1}},revision:'r',compatibleRevisions:['r']};
  client=new EventEmitter(); client.status='I'; client.getTransactionStatus=()=>client.status;
  client.connect=jest.fn(async()=>{}); client.end=jest.fn(async()=>{client.emit('end');});
  client.query=jest.fn(async()=>({rows:[{role,database:'fixture'}]}));
  capture=jest.fn(async()=>({manifest:{version:7}}));
});
const run=(consume,signal)=>withOwnedCatalogSnapshot(configuration,consume,signal);
const options=()=>({maintenance:{},paths:{catalogs:'/synthetic'},job:{id:'job'}});

test('public view exposes data and one capture, not raw connection/transaction authority',async()=>{
  let escaped;
  expect(await run(async view=>{
    escaped=view; expect(Object.keys(view).sort()).toEqual(['capture','compatibleRevisions','report','revision','semantic','signal']);
    for(const key of ['query','end','connection','client','context','commit','rollback'])expect(view[key]).toBeUndefined();
    expect(()=>{view.report.counts.request_binding=99;}).toThrow(); expect(()=>{view.compatibleRevisions.push('wrong');}).toThrow();
    const value=options(); const result=await view.capture(value); value.job.id='changed';
    expect(capture.mock.calls[0][0].job.id).toBe('job');
    expect(capture.mock.calls[0][0].source).toBe(client); expect(capture.mock.calls[0][0].context).toBe(context);
    expect(()=>view.capture(options())).toThrow('gateway_catalog_contract'); return result;
  })).toEqual({manifest:{version:7}});
  expect(()=>escaped.capture(options())).toThrow(); expect(events).toEqual(['commit']);
  expect(client.end).toHaveBeenCalledTimes(1); expect(client.listenerCount('error')).toBe(0);
  expect(connection.mock.calls[0]).toEqual([configuration.database,true,'classifarr-gateway-catalog-snapshot']);
});

test('invalid caller overrides cannot substitute a different source or context',async()=>{
  await run(async view=>{
    for(const extra of [{source:{}},{context:{}},{configuration:{}},{signal:AbortSignal.abort()}])expect(()=>view.capture({...options(),...extra})).toThrow('gateway_catalog_contract');
    expect(capture).not.toHaveBeenCalled(); await view.capture(options());
  });
});

test.each(['I','E',null])('a lost/failed transaction cannot authorize capture (%s)',async status=>{
  await expect(run(async view=>{client.status=status; view.capture(options());})).rejects.toThrow('gateway_archive_snapshot_invalid');
  expect(capture).not.toHaveBeenCalled(); expect(events).toEqual(['rollback']); expect(client.end).toHaveBeenCalled();
});

test.each(['end','error'])('client %s invalidates the scope before another operation',async event=>{
  await expect(run(async view=>{client.emit(event); view.capture(options());})).rejects.toThrow('gateway_archive_snapshot_invalid');
  expect(capture).not.toHaveBeenCalled(); expect(client.end).toHaveBeenCalled();
});

test('pre-cancellation creates no connection; cancellation closes and refuses success',async()=>{
  await expect(run(()=>{},AbortSignal.abort())).rejects.toThrow(); expect(connection).not.toHaveBeenCalled();
  const controller=new AbortController();
  await expect(run(()=>{controller.abort();},controller.signal)).rejects.toThrow('gateway_archive_cancelled');
  expect(client.end).toHaveBeenCalled(); expect(events).toEqual(['rollback']);
});

test('a forgotten capture await is cancelled and drained, never committed',async()=>{
  let drained=false;
  capture.mockImplementation(({signal})=>new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>{drained=true;reject(Error('capture_cancelled'));},{once:true});}));
  await expect(run(view=>{void view.capture(options());})).rejects.toThrow('gateway_archive_cancelled');
  expect(drained).toBe(true); expect(events).toEqual(['rollback']); expect(client.end).toHaveBeenCalled();
});

test('unknown durable failure stays visible even if cancellation also occurs',async()=>{
  const controller=new AbortController();
  await expect(run(()=>{controller.abort();throw Error('persistence_unknown');},controller.signal)).rejects.toThrow('persistence_unknown');
  expect(events).toEqual(['rollback']);
});

test('an already settled capture failure cannot be ignored by a consumer',async()=>{
  capture.mockRejectedValueOnce(Error('capture_failed'));
  await expect(run(async view=>{
    await view.capture(options()).catch(error=>{expect(error.message).toBe('capture_failed');});
    return 'must_not_succeed';
  })).rejects.toThrow('capture_failed');
  expect(events).toEqual(['rollback']); expect(client.end).toHaveBeenCalled();
});

test('failed connect/role/identity always closes without invoking consumer',async()=>{
  const consume=jest.fn(); client.connect.mockRejectedValueOnce(Error('connect_failed'));
  await expect(run(consume)).rejects.toThrow('connect_failed'); expect(client.end).toHaveBeenCalled();
  safe=false; await expect(run(consume)).rejects.toThrow('unsafe');
  safe=true; role='other'; await expect(run(consume)).rejects.toThrow('gateway_catalog_reader_unsafe');
  expect(consume).not.toHaveBeenCalled();
});
