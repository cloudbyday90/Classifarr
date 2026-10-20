/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {gatewayTlsFixture} from './helpers/gatewayTlsFixture.mjs';

const targets = [
  ['direct','../../node_modules/undici/','8.12.3'],
  ['discord','../../node_modules/discord.js/node_modules/undici/','6.29.1'],
  ['rest','../../node_modules/@discordjs/rest/node_modules/undici/','6.29.1'],
];
let tls;
beforeAll(async()=>{tls=await gatewayTlsFixture();});
afterAll(async()=>{await tls?.close();});

const run = source => promisify(execFile)(process.execPath,['--input-type=module','--eval',source],{
  timeout:5000,maxBuffer:16384,windowsHide:true,env:{SystemRoot:process.env.SystemRoot},
});

test.each(targets)('%s copy is the reviewed patch and rejects excessive content encodings without process failure',async(_name,path,version)=>{
  const root=new URL(path,import.meta.url);
  expect(JSON.parse(await readFile(new URL('package.json',root),'utf8')).version).toBe(version);
  const source=`import assert from 'node:assert/strict';
    import {createServer} from 'node:http';
    import {setTimeout as delay} from 'node:timers/promises';
    const {fetch,Agent}=await import(${JSON.stringify(new URL('index.js',root).href)});
    let calls=0;
    const server=createServer((_req,res)=>{
      calls++; res.writeHead(200,{'Content-Encoding':'gzip, gzip, gzip, gzip, gzip, gzip','Content-Length':'128'});
      res.flushHeaders(); res.socket.end();
    });
    const agent=new Agent();
    try {
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      let refused=false;
      try {const response=await fetch('http://127.0.0.1:'+server.address().port,{dispatcher:agent,signal:AbortSignal.timeout(2000)});await response.text();}
      catch {refused=true;}
      assert.equal(refused,true);await delay(50);assert.equal(calls,1);
    } finally {await agent.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    console.log('refused_safely');`;
  const result=await run(source); expect(result.stdout.trim()).toBe('refused_safely'); expect(result.stderr).toBe('');
});

test.each(targets)('%s copy preserves custom TLS identity verification on Agent',async(_name,path)=>{
  const root=new URL(path,import.meta.url);
  const source=`import assert from 'node:assert/strict';
    import {createServer} from 'node:https';
    const {fetch,Agent}=await import(${JSON.stringify(new URL('index.js',root).href)});
    let checks=0,calls=0;
    const server=createServer(${JSON.stringify({cert:tls?.cert,key:tls?.key})},(_req,res)=>{calls++;res.end('must_not_reach_http');});
    const agent=new Agent({connect:{ca:${JSON.stringify(tls?.cert)},checkServerIdentity(){checks++;return new Error('synthetic_identity_refusal');}}});
    try {
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      await assert.rejects(fetch('https://127.0.0.1:'+server.address().port,{dispatcher:agent,signal:AbortSignal.timeout(2000)}));
      assert.ok(checks>0);assert.equal(calls,0);
    } finally {await agent.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    console.log('identity_refused');`;
  const result=await run(source); expect(result.stdout.trim()).toBe('identity_refused'); expect(result.stderr).toBe('');
});
