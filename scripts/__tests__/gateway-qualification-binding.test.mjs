/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studyPolicy,studyBindingRecord } from '../lib/gatewayStudyPolicy.mjs';
import { studyNodeArgs } from '../lib/gatewayStudyBootstrap.mjs';
import { qualificationRecords,createQualificationExecution,QUALIFICATION_DRIVER } from '../lib/gatewayQualificationExecution.mjs';
import { createQualificationWorker,assertQualificationSandbox,assertQualificationSource,qualificationDriverArgs } from '../lib/gatewayQualificationSandbox.mjs';

const image = `sha256:${'a'.repeat(64)}`, revision = 'b'.repeat(40);
const binding = {sha256:'c'.repeat(64),manifest:{version:2,study:'qualification',profile:'regression',image,imageRevision:revision,
  fixtureRevision:revision,entries:studyPolicy('qualification','regression').entries}};
const stores = Object.fromEntries(['archives','receipts','socket','configuration','fixtures','catalogs'].map(key => [key,`owned-${key}`]));
const framed = (entry,body,bound = binding) => `${JSON.stringify(studyBindingRecord(bound,entry))}\n${body}`;
const scratch = 'rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev';
const read = path => readFileSync(new URL(path,import.meta.url),'utf8');

test('qualification policy covers the fixed direct and indirect launch closure without extra entry authority', () => {
  for (const profile of ['regression','measured','unsampled']) {
    const policy = studyPolicy('qualification',profile);
    assert.equal(policy.files.length,16);
    assert.deepEqual(policy.entries,['archiveQualificationData.mjs','catalogQualificationData.mjs',QUALIFICATION_DRIVER]);
    assert.deepEqual(policy.application,[]);
    for (const name of ['cleanupQueryDiagnostics.mjs','archiveEvidenceVerifier.mjs']) {
      assert.ok(policy.files.includes(name)); assert.ok(!policy.entries.includes(name));
      assert.throws(() => studyNodeArgs(binding,name));
    }
  }
  for (const profile of ['extended','short','']) assert.throws(() => studyPolicy('qualification',profile));
  const driver = read('../fixtures/ollamaGatewayRehearsal/archiveQualificationDriver.mjs');
  assert.match(driver,/\['--import','\/fixtures\/cleanupQueryDiagnostics\.mjs'\]/);
  assert.match(driver,/\['\/fixtures\/archiveEvidenceVerifier\.mjs'\]/);
  assert.equal([...driver.matchAll(/\/fixtures\/([A-Za-z]+\.mjs)/g)].length,2);
  assert.ok(driver.indexOf('const started = performance.now()') < driver.indexOf('const child = spawn(process.execPath'));
  assert.match(driver,/parent, process\.pid/); assert.match(driver,/shell: false/);
});

test('worker framing waits only for empty running logs and refuses before accepting any metrics', () => {
  const body = '{"fixture":"limits","memory":"268435456"}\npackaged worker text\n{"fixture":"metrics","workerElapsedMs":12}\n';
  const output = framed(QUALIFICATION_DRIVER,body);
  assert.deepEqual(qualificationRecords('',binding,true),[]);
  for (const running of [false,true]) {
    assert.deepEqual(qualificationRecords(output,binding,running),[
      {fixture:'limits',memory:'268435456'},{fixture:'metrics',workerElapsedMs:12}]);
    for (const invalid of ['\n',body,'{"fixture":',output+framed(QUALIFICATION_DRIVER,''),
      framed(QUALIFICATION_DRIVER,'{"fixture":"study-binding-failed"}\n'),
      output.replace(binding.sha256,'d'.repeat(64)),framed('archiveQualificationData.mjs',body),
      framed(QUALIFICATION_DRIVER,'{broken}\n'),output+'x'.repeat(1048576)]) {
      assert.throws(() => qualificationRecords(invalid,binding,running));
    }
  }
  assert.throws(() => qualificationRecords('',binding,false));
});

function sandbox(kind,catalog,measure = false,mode = 'normal') {
  const worker = !kind.endsWith('verifier'), selected = measure ? {...binding,manifest:{...binding.manifest,profile:'measured'}} : binding;
  const mounts = [['archives','/archives',kind === 'archiver'],['receipts','/receipts',!worker],['fixtures','/fixtures',false],
    ...(catalog ? [['catalogs','/catalogs',kind === 'archiver']] : []),
    ...(worker ? [['socket','/source-socket',false],['configuration','/configuration',false]] : [])];
  return {Image:image,Config:{User:'1000:1000',Healthcheck:{Test:['NONE']},Entrypoint:['node'],
    Env:['CLASSIFARR_GATEWAY_FIXTURE=isolated',`CLASSIFARR_SOAK_PROFILE=${selected.manifest.profile}`],
    Cmd:studyNodeArgs(selected,QUALIFICATION_DRIVER,qualificationDriverArgs(kind,mode,catalog,measure))},
  HostConfig:{NetworkMode:'none',ReadonlyRootfs:true,Init:true,Privileged:false,PidMode:'',CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],
    Memory:worker ? 268435456 : 1610612736,MemorySwap:worker ? 268435456 : 1610612736,NanoCpus:worker ? 500000000 : 1000000000,
    PidsLimit:worker ? 32 : 64,PortBindings:{},Tmpfs:{'/tmp':scratch,...(worker ? {} :
      {'/verification':'rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev'})}},
  Mounts:mounts.map(([key,Destination,RW]) => ({Type:'volume',Name:stores[key],Destination,RW}))};
}

test('all five worker kinds retain exact security, resource, mount and bootstrap contracts', () => {
  for (const kind of ['archiver','cleanup','verifier','catalog-verifier','batch-verifier']) for (const catalog of [false,true]) {
    const expected = {image,kind,catalog,measure:false,mode:'normal',stores,binding};
    assertQualificationSandbox(sandbox(kind,catalog),expected);
    for (const mutate of [v => {v.Image='wrong';},v => {v.Config.User='0:0';},v => {v.HostConfig.NetworkMode='host';},
      v => {v.HostConfig.MemorySwap=-1;},v => {v.HostConfig.Memory=1;},v => {v.HostConfig.NanoCpus=0;},v => {v.HostConfig.PidsLimit=0;},
      v => {v.HostConfig.Privileged=true;},v => {v.HostConfig.PidMode='host';},v => {v.HostConfig.CapDrop=[];},
      v => {v.HostConfig.SecurityOpt=[];},v => {v.HostConfig.ReadonlyRootfs=false;},v => {v.HostConfig.Init=false;},
      v => {v.Config.Healthcheck.Test=['CMD','curl'];},v => {v.HostConfig.PortBindings={'1/tcp':[]};},
      v => {v.HostConfig.Tmpfs['/tmp']='rw';},v => {v.Mounts.pop();},v => {v.Mounts[2].RW=true;},
      v => {v.Mounts[0].Type='bind';},v => {v.Mounts[0].Name='foreign';},
      v => {v.Mounts.push({Type:'volume',Name:'extra',Destination:'/extra',RW:false});},
      v => {v.Config.Env.push('NODE_OPTIONS=--inspect');},v => {v.Config.Env.push('MY_TOKEN=secret');},
      v => {v.Config.Env.push('CLASSIFARR_GATEWAY_ARCHIVE_WORKER_CONFIG_FILE=/foreign');},
      v => {v.Config.Cmd=['console.log("passed")'];},v => {v.Config.Entrypoint=['sh'];}]) {
      const changed = sandbox(kind,catalog); mutate(changed); assert.throws(() => assertQualificationSandbox(changed,expected));
    }
    const calls = [];
    createQualificationWorker({...expected,docker:args => calls.push(args),inspect:() => sandbox(kind,catalog),name:'owned-worker',label:'owned=yes'});
    assert.equal(calls.length,1); const args = calls[0];
    assert.deepEqual(args.slice(args.indexOf(image)+1),studyNodeArgs(binding,QUALIFICATION_DRIVER,[kind,'normal',...(catalog ? ['catalog'] : [])]));
    assert.ok(args.includes(`type=volume,source=${stores.fixtures},target=/fixtures,readonly`));
    if (kind.endsWith('verifier')) assert.ok(!args.some(arg => arg.includes('/source-socket') || arg.includes('/configuration')));
  }
  const selected = {...binding,manifest:{...binding.manifest,profile:'measured'}};
  assertQualificationSandbox(sandbox('archiver',true,true),{image,kind:'archiver',catalog:true,measure:true,mode:'normal',stores,binding:selected});
  const calls = [];
  createQualificationWorker({image,kind:'archiver',catalog:true,measure:true,mode:'normal',stores,binding:selected,
    docker:args => calls.push(args),inspect:() => sandbox('archiver',true,true),name:'owned-worker',label:'owned=yes'});
  assert.deepEqual(calls[0].slice(-4),['archiver','normal','catalog','measure']);
});

function producer(catalog) {
  const keys = ['archives','receipts','socket','configuration','fixtures',...(catalog ? ['catalogs'] : [])];
  return {Image:image,HostConfig:{NetworkMode:'none',Privileged:false,PidMode:'',Memory:2147483648,MemorySwap:2147483648,
    NanoCpus:2000000000,PidsLimit:512,PortBindings:{},Tmpfs:{'/quota':scratch}},Mounts:[
    {Type:'bind',Destination:'/app/data',RW:true},...keys.map(key => ({Type:'volume',Name:stores[key],
      Destination:key === 'socket' ? '/var/run/postgresql' : `/${key}`,RW:key !== 'fixtures'}))]};
}

test('source input mount is exact and read-only; generated configuration remains separate', () => {
  for (const catalog of [false,true]) {
    const expected = {image,stores,catalog}; assertQualificationSource(producer(catalog),expected);
    for (const mutate of [v => {v.Mounts.pop();},v => {v.Mounts.find(m => m.Destination === '/fixtures').RW=true;},
      v => {v.Mounts[1].Name='foreign';},v => {v.Mounts[1].Type='bind';},v => {v.Mounts[0].RW=false;},
      v => {v.HostConfig.PortBindings={'1/tcp':[]};},v => {v.HostConfig.Tmpfs['/quota']='rw';}]) {
      const changed = producer(catalog); mutate(changed); assert.throws(() => assertQualificationSource(changed,expected));
    }
  }
});

test('source adapter checks refusal and exact framing before parsing its single JSON result', () => {
  for (const catalog of [false,true]) {
    const entry = catalog ? 'catalogQualificationData.mjs' : 'archiveQualificationData.mjs', calls = [];
    const write = process.stdout.write; process.stdout.write = () => true;
    try {
      let output = framed(entry,'{"count":"9007199254740993"}\n');
      const fixture = createQualificationExecution({source:'owned-source',stores,binding,catalog,shape:'cleanup',inspect:() => producer(catalog),
        docker:args => { calls.push(args); return args.includes(binding.sha256) ? output : 'protected\n'; },
        check:(args,options) => { assert.equal(options.timeoutMs,10000); assert.ok(args.includes('0'.repeat(64)));
          return {ok:false,exitCode:1,stdout:'{"fixture":"study-binding-failed","stage":"binding","reason":"fixture_binding_or_execution_failed"}\n'}; }});
      assert.deepEqual(fixture('inspect'),{count:'9007199254740993'});
      assert.deepEqual(calls.at(-1).slice(-2),['inspect','cleanup']);
      for (const invalid of ['{"passed":true}',framed(QUALIFICATION_DRIVER,'{}'),framed(entry,'{"fixture":"study-binding-failed"}\n')]) {
        output=invalid; assert.throws(() => fixture('inspect'));
      }
    } finally { process.stdout.write=write; }
  }
});

test('qualification seals before startup, keeps bound resume logs and verifies all cleanup before completion', () => {
  const source = read('../lib/gatewayArchiveQualification.mjs');
  assert.ok(source.indexOf('stageStudyInputs({') < source.indexOf('await withSchemaCheckContainer({'));
  assert.ok(!source.includes("['cp'")); assert.ok(!source.includes("'/configuration', '/fixtures'"));
  assert.match(source,/qualificationRecords\(output,binding,running\)/);
  assert.match(source,/records\(docker\(\['logs', run.name\]\),state.Running\)/);
  for (const token of ['finishGatewayStudyCleanup','Object.values(workers).map','[stager,...Object.values(workers)]',
    'Object.values(volumes).map','assert.deepEqual(bind(),binding)','qualification-labeled-containers','qualification-labeled-volumes',
    'disposable-data-directory','Config.Labels[labelKey], suffix','Labels[labelKey], suffix']) assert.ok(source.includes(token),token);
  assert.ok(source.indexOf("qualification: 'passed'") > source.indexOf("cleanup: 'verified'"));
  const cli = read('../run-gateway-online-archive-rehearsal.mjs');
  for (const flag of ['--qualification','--cleanup','--catalog-qualification','--catalog-memory','--catalog-memory-baseline','--archiver-pressure-study']) assert.ok(cli.includes(flag));
});
