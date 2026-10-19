/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { withOnlineArchiveSnapshot } from '/app/src/ollamaGateway/onlineArchiveSnapshot.mjs';
import { captureCatalogContent } from '/app/src/ollamaGateway/catalogContent.mjs';
import { requireReuseContentParity,reuseSha } from './snapshotReuseContract.mjs';
import { setupReuseData,reuseConnection,reuseConfiguration,widenReuseData,reuseGuard } from './snapshotReuseData.mjs';
import { compareSnapshotReads } from './snapshotReuseProbe.mjs';
import { probeSnapshotReuse } from './snapshotReuseGuards.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
const action = process.argv[2]; assert.ok(['setup','small','wide','probes','restart'].includes(action));
requireReuseContentParity(...await Promise.all(['/app/src/ollamaGateway/catalogContent.mjs','/fixtures/snapshotReuseContent.mjs'].map(path => readFile(path,'utf8'))));
if (action === 'setup') await setupReuseData();
else {
  const owner = new pg.Client(reuseConnection), reader = new pg.Client({...reuseConnection,user:'snapshot_reuse_reader',
    options:'-c default_transaction_read_only=on',connectionTimeoutMillis:5000,statement_timeout:4000,query_timeout:5000});
  const controller = new AbortController(), stop = () => {controller.abort(); void reader.end().catch(() => {});};
  reader.on('error',() => {}); const timer = setTimeout(stop,180000);
  process.once('SIGTERM',stop); process.once('SIGINT',stop);
  try {
    await owner.connect(); await reader.connect();
    await owner.query('SELECT pg_advisory_lock(11435,4)');
    assert.deepEqual((await reader.query(`SELECT current_user AS role,current_database() AS database,
      current_setting('transaction_read_only') AS readonly,has_table_privilege(current_user,'ollama_gateway.admission','UPDATE') AS can_write`)).rows[0],
    {role:'snapshot_reuse_reader',database:reuseConnection.database,readonly:'on',can_write:false});
    if (action === 'wide') await widenReuseData(owner);
    const before = await reuseGuard(owner);
    assert.deepEqual(before,{attempts:'110',binding_count:110,active_request:null,cooldown_until:null,completions:110,
      cleanup:0,protections:0,roots:0,archive_jobs:256,archive_attempts:256,catalog_attempts:2,uuidv7:110});
    const hash = () => withOnlineArchiveSnapshot(reader,reuseConfiguration,async () => reuseSha(await captureCatalogContent(reader,controller.signal,{bytes:0},3)),controller.signal);
    const original = await hash();
    const result = action === 'probes' ? {probes:await probeSnapshotReuse(reader,owner,controller.signal)} :
      {hash:await compareSnapshotReads(reader,action,controller.signal)};
    assert.equal(await hash(),original); assert.deepEqual(await reuseGuard(owner),before);
    controller.signal.throwIfAborted();
    console.log(JSON.stringify({fixture:'snapshot-reuse-complete',action,...result,preserved:true,purgeAuthorized:false,productionAuthorized:false}));
  } finally {
    clearTimeout(timer); process.removeListener('SIGTERM',stop); process.removeListener('SIGINT',stop);
    await reader.end(); await owner.end();
  }
}
