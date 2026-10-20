/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studyPolicy,studyBindingRecord,requireBoundStudyOutput } from '../lib/gatewayStudyPolicy.mjs';
import { createSchedulingExecution,SCHEDULING_ENTRY,assertSchedulingVerification } from '../lib/gatewaySchedulingExecution.mjs';
import { assertSchedulingSandbox,createSchedulingVerifier,assertSchedulingSource } from '../lib/gatewaySchedulingSandbox.mjs';
import { runSchedulingScenarios } from '../lib/gatewaySchedulingScenarios.mjs';
import { finishGatewayStudyCleanup } from '../lib/gatewayStudyCleanup.mjs';

const image=`sha256:${'a'.repeat(64)}`, revision='b'.repeat(40);
const binding={sha256:'c'.repeat(64),manifest:{version:2,study:'scheduling',profile:'rotation',image,imageRevision:revision,
  fixtureRevision:revision,entries:[SCHEDULING_ENTRY]}};
const stores={archives:'owned-archives',receipts:'owned-receipts',catalogs:'owned-catalogs',fixtures:'owned-inputs'};
const frame=body => `${JSON.stringify(studyBindingRecord(binding,SCHEDULING_ENTRY))}\n${body}`;
const stopped={Running:false,ExitCode:0,OOMKilled:false};
const quiet=work => {const write=process.stdout.write; process.stdout.write=() => true; try{return work();}finally{process.stdout.write=write;}};

test('scheduling binds only its complete four-file closure and preserves mixed output losslessly', () => {
  assert.deepEqual(studyPolicy('scheduling','rotation'),{files:['catalogScheduling.mjs','catalogRotationStudy.mjs','rotationStudyContract.mjs','catalogOwnedPressure.mjs'],entries:[SCHEDULING_ENTRY],application:[]});
  for (const body of ['', '0199d30f-7420-7000-8000-000000000001\n','quiet passed\r\n','{"state":"catalog_unchanged"}\n']) {
    assert.equal(requireBoundStudyOutput(frame(body),binding,SCHEDULING_ENTRY),body);
  }
  for (const output of ['', 'unbound\n',frame('')+frame(''),frame('{"fixture":"study-binding-failed"}\n'),
    frame('').replace(binding.sha256,'d'.repeat(64)),frame('x'.repeat(1048576))]) assert.throws(() => requireBoundStudyOutput(output,binding,SCHEDULING_ENTRY));
});

test('source adapter proves actual refusal before setup and retains fixed exec/user/profile/action', () => quiet(() => {
  const calls=[], source='owned-source'; let refusal=false;
  const fixture=createSchedulingExecution({binding,stores,source,inspect:() => ({Image:image,Mounts:[{Type:'volume',Name:stores.fixtures,Destination:'/fixtures',RW:false}]}),
    check:argv => {assert.equal(argv.at(-1),'setup'); assert.equal(argv.at(-3),'0'.repeat(64)); refusal=true;
      return {ok:false,exitCode:1,stdout:JSON.stringify({fixture:'study-binding-failed',stage:'binding',reason:'fixture_binding_or_execution_failed'})};},
    docker:argv => {calls.push(argv); return argv.includes(binding.sha256) ? frame('') : 'protected\n';}});
  // Probe uses node -e; fixture uses node --input-type=module -e bootstrap digest entry action.
  assert.equal(refusal,true); assert.equal(calls.length,1);
  assert.equal(fixture('study-begin'),'');
  assert.deepEqual(calls[1].slice(0,9),['exec','--user','1000:1000','-e','CLASSIFARR_GATEWAY_FIXTURE=isolated','-e','CLASSIFARR_SOAK_PROFILE=rotation',source,'node']);
  assert.deepEqual(calls[1].slice(-2),[SCHEDULING_ENTRY,'study-begin']);
}));

function sandbox(catalog) {
  return {Image:image,Config:{User:'1000:1000',Entrypoint:['node'],Cmd:['/app/src/scripts/runGatewayArchiveVerifier.mjs','--once',...(catalog?['--catalog']:[])],Healthcheck:{Test:['NONE']},Env:['PATH=/usr/bin:/bin']},
    HostConfig:{NetworkMode:'none',ReadonlyRootfs:true,Init:true,Privileged:false,PidMode:'',CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],Memory:1610612736,MemorySwap:1610612736,NanoCpus:1000000000,PidsLimit:64,PortBindings:{},Tmpfs:{
      '/verification':'rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev','/tmp':'rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev'}},
    Mounts:['archives','receipts',...(catalog?['catalogs']:[])].map(key=>({Type:'volume',Name:stores[key],Destination:`/${key}`,RW:key==='receipts'})),State:{...stopped}};
}

test('both packaged verifiers exclude fixtures/source authority and reject sandbox drift', () => {
  for (const catalog of [false,true]) {
    const expected={image,stores,catalog}; assertSchedulingSandbox(sandbox(catalog),expected);
    let command; createSchedulingVerifier({...expected,docker:args=>{command=args;},inspect:()=>sandbox(catalog),name:'owned',label:'test=yes'});
    assert.deepEqual(command.slice(command.indexOf(image)+1),sandbox(catalog).Config.Cmd);
    assert.ok(!command.some(arg=>/fixtures|source-socket|type=bind/.test(arg)));
    for (const mutate of [v=>{v.Image='wrong';},v=>{v.Config.User='0:0';},v=>{v.Config.Cmd=['evil'];},v=>{v.Config.Entrypoint=['sh'];},
      v=>{v.HostConfig.NetworkMode='host';},v=>{v.HostConfig.ReadonlyRootfs=false;},v=>{v.HostConfig.Init=false;},v=>{v.HostConfig.Privileged=true;},
      v=>{v.HostConfig.PidMode='host';},v=>{v.HostConfig.CapDrop=[];},v=>{v.HostConfig.SecurityOpt=[];},v=>{v.HostConfig.Memory=0;},
      v=>{v.HostConfig.MemorySwap=-1;},v=>{v.HostConfig.NanoCpus=0;},v=>{v.HostConfig.PidsLimit=0;},v=>{v.HostConfig.PortBindings={'123/tcp':[]};},
      v=>{v.HostConfig.Tmpfs['/verification']='rw';},v=>{v.Mounts[0].Name='foreign';},v=>{v.Mounts[0].RW=true;},v=>{v.Mounts[1].RW=false;},
      v=>{v.Mounts[0].Type='bind';},v=>{v.Mounts.push({Type:'volume',Name:stores.fixtures,Destination:'/fixtures',RW:false});},
      v=>{v.Config.Env.push('DATABASE_URL=secret');},v=>{v.Config.Env.push('NODE_OPTIONS=--inspect');},v=>{v.Config.Env.push('MY_TOKEN=secret');},
      v=>{v.Config.Env.push('CLASSIFARR_GATEWAY_FIXTURE=isolated');},v=>{v.Config.Healthcheck.Test=['CMD','curl'];}]) {
      const changed=sandbox(catalog); mutate(changed); assert.throws(()=>assertSchedulingSandbox(changed,expected));
    }
  }
});

test('verifier success requires one exact bounded JSON record and stopped non-OOM exit', () => {
  const value={State:stopped}; assertSchedulingVerification('{"state":"verified","purgeAuthorized":false}\n',value);
  for (const output of ['', 'prefix {"state":"verified"}', '{"state":"verified"}', '{"state":"verified","purgeAuthorized":true}',
    '{"state":"verification_failed","purgeAuthorized":false}', '{"state":"verified","purgeAuthorized":false}\n{"state":"failed"}',
    '{"state":"verified","purgeAuthorized":false,"extra":1}', ' '.repeat(1048577)]) assert.throws(()=>assertSchedulingVerification(output,value));
  for (const patch of [{Running:true},{ExitCode:1},{OOMKilled:true}]) assert.throws(()=>assertSchedulingVerification('{"state":"verified","purgeAuthorized":false}',{State:{...stopped,...patch}}));
});

for (const rotationStudy of [false,true]) test(`scenario order preserves ${rotationStudy?'three rotation':'one handoff'} cycles and repeated quiet/drain checks`, () => {
  const calls=[],writes=[],cycles=rotationStudy?3:1; let workers=0;
  runSchedulingScenarios({rotationStudy,write:value=>writes.push(value),verify:index=>calls.push(`verify:${index}`),fixture:action=>{
    calls.push(action); if(action!=='worker') return action;
    workers++; return JSON.stringify({state: workers<=3?'awaiting_catalog_verification':workers===4?'catalog_unchanged':
      (workers-5)%(rotationStudy?4:2)===0?'awaiting_catalog_verification':'catalog_attempts_exhausted'});
  }});
  const initial=['setup','verify:0','worker','worker','verify:1','register-only','worker','verify:1','worker','quiet'];
  const cycle=['inference','verify:0','accept-inference','inference','verify:0','accept-inference',rotationStudy?'study-refresh':'refresh','verify:1','worker','verify:1','worker',
    ...(rotationStudy?['worker','worker','study-check']:['handoff'])];
  const pressure=rotationStudy?[]:['owned-prepare','inference','verify:0','accept-inference','inference','verify:0','accept-inference','owned-capture','verify:1','owned-check'];
  assert.deepEqual(calls,[...initial,...(rotationStudy?['study-begin']:[]),...Array.from({length:cycles},()=>cycle).flat(),...pressure]);
  assert.equal(writes.length,cycles+1+(rotationStudy?0:1));
  assert.throws(()=>runSchedulingScenarios({rotationStudy,fixture:()=>'{"state":"idle"}',verify:()=>{},write:()=>{}}),/scheduling_worker_state_invalid/);
});

test('source keeps exact owned outputs writable, fixtures readonly and no swap allowance', () => {
  const value={Image:image,HostConfig:{NetworkMode:'none',Privileged:false,PidMode:'',Memory:2147483648,MemorySwap:2147483648,NanoCpus:2000000000,PidsLimit:512,PortBindings:{}},
    Mounts:[...Object.entries(stores).map(([key,Name])=>({Type:'volume',Name,Destination:`/${key}`,RW:key!=='fixtures'})),{Type:'bind',Destination:'/app/data',RW:true}]};
  assertSchedulingSource(value,{image,stores});
  for(const mutate of [v=>{v.HostConfig.MemorySwap=-1;},v=>{v.Mounts[3].RW=true;},v=>{v.Mounts[0].Name='foreign';},v=>{v.Mounts.push({Destination:'/other'});}]) {
    const changed=structuredClone(value); mutate(changed); assert.throws(()=>assertSchedulingSource(changed,{image,stores}));
  }
});

test('runner binds before staging/setup and cleanup attempts every owned resource before success', () => {
  const source=readFileSync(new URL('../lib/gatewayCatalogSchedulingRehearsal.mjs',import.meta.url),'utf8');
  assert.ok(source.indexOf('binding = bind()')<source.indexOf('stageStudyInputs({'));
  assert.ok(source.indexOf('stageStudyInputs({')<source.indexOf('await withSchemaCheckContainer'));
  assert.ok(!source.includes("docker(['cp'")); assert.ok(source.includes('...[stager,...names]'));
  assert.ok(source.indexOf('finishGatewayStudyCleanup([')<source.indexOf("process.stdout.write('catalog_scheduling_rehearsal_cleanup_verified"));
  const calls=[]; assert.throws(()=>finishGatewayStudyCleanup(['inputs','stager','verifier','fixtures','labels','data'].map(name=>({name,run:()=>{calls.push(name);if(name==='stager')throw Error('failed');}}))),
    error=>error.message==='gateway_study_cleanup_incomplete' && error.failedResources.join()==='stager');
  assert.deepEqual(calls,['inputs','stager','verifier','fixtures','labels','data']);
});
