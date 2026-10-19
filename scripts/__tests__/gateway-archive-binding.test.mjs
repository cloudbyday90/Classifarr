/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studyPolicy,studyBindingRecord,requireBoundStudyOutput } from '../lib/gatewayStudyPolicy.mjs';
import { studyNodeArgs } from '../lib/gatewayStudyBootstrap.mjs';
import { assertArchiveSandbox,createArchiveVerifier,assertArchiveVerifierStopped } from '../lib/gatewayArchiveSandbox.mjs';
import { runGatewayCatalogRehearsal } from '../lib/gatewayCatalogRehearsal.mjs';
import { runGatewayCatalogRetentionRehearsal } from '../lib/gatewayCatalogRetentionRehearsal.mjs';
import { runGatewayArchiveScenarios } from '../lib/gatewayArchiveScenarios.mjs';

const image = `sha256:${'a'.repeat(64)}`, revision = 'b'.repeat(40);
const binding = {sha256:'c'.repeat(64),manifest:{version:2,study:'archive',profile:'regression',image,imageRevision:revision,
  fixtureRevision:revision,entries:studyPolicy('archive','regression').entries}};
const stores = {archives:'owned-archives',receipts:'owned-receipts',catalogs:'owned-catalogs',fixtures:'owned-inputs'};
const id = '0199d30f-7420-7000-8000-000000000001';
const framed = (entry,body) => `${JSON.stringify(studyBindingRecord(binding,entry))}\n${body}`;
const read = name => readFileSync(new URL(`../lib/${name}.mjs`,import.meta.url),'utf8');
const quiet = work => { const write = process.stdout.write; process.stdout.write = () => true; try { return work(); } finally { process.stdout.write = write; } };

test('archive policy is a narrow seven-file closure with five entries and no application parity dependency', () => {
  const policy = studyPolicy('archive','regression');
  assert.deepEqual(policy.entries,['archiveRestoreInput.mjs','onlineArchive.mjs','archiveProtection.mjs','catalogArchive.mjs','catalogRetention.mjs']);
  assert.deepEqual(policy.files,[...policy.entries,'catalogLateFiles.mjs','catalogRetentionGuards.mjs']);
  assert.deepEqual(policy.application,[]); assert.throws(() => studyPolicy('archive','extended'));
  assert.throws(() => studyNodeArgs(binding,'catalogLateFiles.mjs'));
});

test('framing preserves plain UUIDs, text, JSON and all body whitespace exactly', () => {
  const entry = 'catalogRetention.mjs';
  for (const body of ['',`${id}\n`,'plain text\r\n\n',` {"archiveId":"${id}"}\r\n`,JSON.stringify({verified:true})+'\n']) {
    assert.equal(requireBoundStudyOutput(framed(entry,body),binding,entry),body);
  }
  for (const output of ['',id,JSON.stringify({passed:true})+'\n',framed(entry,'')+framed(entry,''),
    framed(entry,'')+'{"fixture":"study-binding-failed"}\n',framed(entry,'').replace(binding.sha256,'d'.repeat(64)),
    framed('catalogArchive.mjs',id),framed(entry,'x'.repeat(1048576))]) assert.throws(() => requireBoundStudyOutput(output,binding,entry));
});

function sandbox(kind,args = []) {
  const kinds = ['archives','receipts',...(kind === 'retention' ? ['catalogs'] : []),...(kind === 'archive' ? [] : ['fixtures'])];
  return {Image:image,Config:{User:'1000:1000',Healthcheck:{Test:['NONE']},Entrypoint:['node'],Env:kind === 'archive' ? [] :
    ['CLASSIFARR_GATEWAY_FIXTURE=isolated','CLASSIFARR_SOAK_PROFILE=regression'],Cmd:kind === 'archive' ?
    ['/app/src/scripts/runGatewayArchiveVerifier.mjs','--once'] : studyNodeArgs(binding,kind === 'catalog' ? 'catalogArchive.mjs' : 'catalogRetention.mjs',args)},
  HostConfig:{NetworkMode:'none',ReadonlyRootfs:true,Init:true,Privileged:false,PidMode:'',CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],
    Memory:1610612736,MemorySwap:1610612736,NanoCpus:1000000000,PidsLimit:64,PortBindings:{},Tmpfs:{
      '/verification':'rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
      '/tmp':'rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev'}},
  Mounts:kinds.map(key => ({Type:'volume',Name:stores[key],Destination:`/${key}`,RW:kind === 'archive' && key === 'receipts'})),
  State:{Running:false,ExitCode:0,OOMKilled:false}};
}

test('every verifier has fixed resources, exact owned mounts and no source authority', () => {
  for (const kind of ['archive','catalog','retention']) {
    const args = kind === 'catalog' ? ['verify'] : ['verify',id], expected = {image,kind,stores,binding,args};
    assertArchiveSandbox(sandbox(kind,args),expected);
    for (const mutate of [v => {v.Image='wrong';},v => {v.Config.User='0:0';},v => {v.HostConfig.NetworkMode='host';},
      v => {v.HostConfig.MemorySwap=-1;},v => {v.HostConfig.NanoCpus=0;},v => {v.HostConfig.PidsLimit=0;},
      v => {v.HostConfig.Privileged=true;},v => {v.HostConfig.PidMode='host';},v => {v.HostConfig.CapDrop=[];},
      v => {v.HostConfig.SecurityOpt=[];},v => {v.HostConfig.ReadonlyRootfs=false;},v => {v.HostConfig.Init=false;},
      v => {v.Config.Healthcheck.Test=['CMD','curl','http://example.invalid'];},
      v => {v.HostConfig.PortBindings={'123/tcp':[]};},v => {v.HostConfig.Tmpfs['/verification']='rw';},
      v => {v.Mounts[0].RW=true;},v => {v.Mounts[0].Type='bind';},v => {v.Mounts[0].Name='foreign';},
      v => {v.Mounts.push({Type:'volume',Name:'socket',Destination:'/source-socket',RW:false});},
      v => {v.Config.Env.push('NODE_OPTIONS=--inspect');},v => {v.Config.Env.push('MY_TOKEN=secret');},
      v => {v.Config.Cmd=['console.log("passed")'];}]) {
      const changed = sandbox(kind,args); mutate(changed); assert.throws(() => assertArchiveSandbox(changed,expected));
    }
    for (const state of [{Running:true},{ExitCode:1},{OOMKilled:true}]) assert.throws(() => assertArchiveVerifierStopped({...sandbox(kind),State:{...sandbox(kind).State,...state}}));
  }
});

test('created commands retain the packaged verifier or the exact pre-import bootstrap', () => {
  for (const kind of ['archive','catalog','retention']) {
    const args = kind === 'catalog' ? ['verify'] : ['verify',id]; let command;
    createArchiveVerifier({docker:argv => {command=argv;},inspect:() => sandbox(kind,args),image,name:'owned',label:'test=yes',kind,stores,binding,args});
    assert.equal(command[0],'create'); assert.ok(!command.some(value => value.includes('type=bind')));
    const start = command.indexOf(image); assert.ok(start > 0);
    assert.deepEqual(command.slice(start+1),sandbox(kind,args).Config.Cmd);
    assert.equal(command.includes('CLASSIFARR_GATEWAY_FIXTURE=isolated'),kind !== 'archive');
  }
});

function context(kind,{output,createFailure = false} = {}) {
  const removed = [], calls = [], accepted = [], entry = kind === 'catalog' ? 'catalogArchive.mjs' : 'catalogRetention.mjs';
  let args;
  return {removed,calls,accepted,docker:argv => {
    if (argv[0] === 'ps') return '';
    if (argv[0] === 'create') { if (createFailure) throw Error('synthetic_create_failure'); args=argv.slice(- (kind === 'catalog' ? 1 : 2)); return ''; }
    if (argv[0] === 'start') return output ?? framed(entry,kind === 'catalog' ? 'catalog_verified\n' : JSON.stringify({archiveId:id,verified:true,purgeAuthorized:false}));
    throw Error('unexpected_docker_call');
  },image,stores,binding,label:'test=yes',names:{catalog:'owned-catalog',retention:'owned-retention'},
  inspect:() => sandbox(kind,args),remove:name => removed.push(name),execute:(name,values) => {
    assert.equal(name,entry); calls.push(values[0]);
    if (values[0] === 'capture' && kind === 'retention') return `${id}\n`;
    if (values[0] === 'accept') accepted.push(JSON.parse(values[1]));
    return `${values[0]}_passed\n`;
  }};
}

test('catalog orchestration preserves every missing-marker and tamper step and removes each verifier', () => quiet(() => {
  const value = context('catalog'); runGatewayCatalogRehearsal(value);
  assert.deepEqual(value.calls,['capture','hide-marker','restore-marker','tamper','restore-manifest']);
  assert.deepEqual(value.removed,Array(4).fill('owned-catalog'));
}));

test('retention preserves three UUID/receipt handoffs and the faults/resume/read-guards sequence', () => quiet(() => {
  const value = context('retention'); runGatewayCatalogRetentionRehearsal(value);
  assert.deepEqual(value.calls,['setup','capacity','capture','accept','capture','accept','capture','accept','faults','resume','read-guards']);
  assert.equal(value.accepted.length,3); assert.ok(value.accepted.every(receipt => receipt.archiveId === id && receipt.purgeAuthorized === false));
  assert.deepEqual(value.removed,Array(3).fill('owned-retention'));
}));

test('failed creation or invalid result is cleaned without accepting or continuing', () => quiet(() => {
  for (const kind of ['catalog','retention']) for (const patch of [{createFailure:true},{output:'{"verified":true}\n'},
    {output:framed(kind === 'catalog' ? 'catalogArchive.mjs' : 'catalogRetention.mjs','{"fixture":"study-binding-failed"}\n')}]) {
    const value = context(kind,patch);
    assert.throws(() => (kind === 'catalog' ? runGatewayCatalogRehearsal : runGatewayCatalogRetentionRehearsal)(value));
    assert.deepEqual(value.removed,[`owned-${kind}`]); assert.equal(value.accepted.length,0); assert.ok(!value.calls.includes('resume'));
  }
}));

test('archive orchestration retains downgrade, crash, corruption and protection boundaries', () => quiet(() => {
  const calls = [], states = []; let next = 'verified';
  runGatewayArchiveScenarios({image,stores,binding,label:'owned=yes',names:{verifier:'owned-verifier'},inspect:() => sandbox('archive'),
    execute:(entry,args = []) => {
      calls.push(`${entry}:${args.join()}`);
      if (args[0] === 'tamper-inventory') next='verification_failed';
      if (args[0] === 'receipt-crash') next='idle';
      return 'passed\n';
    },docker:args => {
      if (args[0] === 'create') return '';
      assert.equal(args[0],'start'); states.push(next); const output=JSON.stringify({state:next}); next='verified'; return output;
    }});
  assert.equal(calls[0],'archiveRestoreInput.mjs:');
  assert.deepEqual(states,['verified','idle','verification_failed','verified','verified','verified','verified','verified','verified']);
  assert.equal(calls.filter(value => value === 'onlineArchive.mjs:next').length,6);
  assert.equal(calls.filter(value => value === 'onlineArchive.mjs:accept').length,8);
  for (const action of ['receipt-downgrade','tamper-inventory','restore-inventory-fixture','corrupt']) assert.ok(calls.includes(`onlineArchive.mjs:${action}`));
  assert.deepEqual(calls.filter(value => value.startsWith('archiveProtection.mjs:')),
    ['archiveProtection.mjs:stage','archiveProtection.mjs:check','archiveProtection.mjs:retirement-cut','archiveProtection.mjs:rotated']);
}));

test('default driver seals before source startup and completes only after independently attempted cleanup', () => {
  const driver = read('gatewayArchiveRehearsal');
  assert.ok(driver.indexOf('stageStudyInputs({') < driver.indexOf('await withSchemaCheckContainer({'));
  assert.match(driver,/finally\s*\{\s*finishGatewayStudyCleanup\(/);
  for (const token of ['Object.values(names).map','Object.values(stores).map','assert.deepEqual(bind(),binding)',
    "Config.Labels[key],suffix","Labels[key],suffix",'archive-labeled-containers','archive-labeled-volumes','disposable-data-directory']) assert.ok(driver.includes(token),token);
  assert.ok(driver.indexOf('online_archive_rehearsal_passed:') > driver.indexOf('online_archive_rehearsal_cleanup_verified'));
  for (const source of [driver,read('gatewayCatalogRehearsal'),read('gatewayCatalogRetentionRehearsal'),read('gatewayArchiveScenarios')]) {
    assert.ok(!source.includes("['cp'")); assert.ok(!source.includes('type=bind,source='));
  }
});
