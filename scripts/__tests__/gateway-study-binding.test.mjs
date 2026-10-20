/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,symlinkSync,readdirSync } from 'node:fs';
import { resolve,sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { studyPolicy,studyBindingRecord,requireBoundStudyRecords } from '../lib/gatewayStudyPolicy.mjs';
import { bindStudySources } from '../lib/gatewayStudyBinding.mjs';
import { studyNodeArgs,STUDY_BOOTSTRAP } from '../lib/gatewayStudyBootstrap.mjs';
import { assertStudyCommand,assertStudyVolumes,stageStudyInputs } from '../lib/gatewayStudyInputs.mjs';
import { schedulingActionArgs } from '../lib/gatewaySchedulingExecution.mjs';

const revision = 'a'.repeat(40), image = `sha256:${'b'.repeat(64)}`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => args[0] === 'rev-parse' ? revision : args[0] === 'status' ? '' :
  args[0] === 'ls-tree' ? `100644 blob ${'c'.repeat(40)}\t${args.at(-1)}` : 'committed\n';
const bind = patch => bindStudySources({revision,image,study:'history',profile:'extended',git,read:() => 'committed\r\n',...patch});

test('image and fixture revisions are independent except explicit row-mode parity', () => {
  const binding = bind({revision:'d'.repeat(40),fixtureRevision:revision});
  assert.equal(binding.manifest.imageRevision,'d'.repeat(40)); assert.equal(binding.manifest.fixtureRevision,revision);
  assert.equal(binding.manifest.version,2); assert.equal(Object.keys(binding.sources).length,19);
  assert.equal(binding.sources['soakData.mjs'].toString(),'committed\n');
  assert.equal(binding.manifest.files['soakData.mjs'],sha('committed\n'));
  assert.throws(() => bind({study:'rowmode',revision:'d'.repeat(40),fixtureRevision:revision}),/row_mode_parity_revision/);
  assert.throws(() => bind({study:'snapshot',profile:'regression',revision:'d'.repeat(40),fixtureRevision:revision}),/snapshot_parity_revision/);
  for (const patch of [{fixtureRevision:'e'.repeat(40)},{read:() => 'drift'},
    {git:args => args[0] === 'status' ? ' M source' : git(args)},
    {git:args => args[0] === 'ls-tree' ? `120000 blob ${'c'.repeat(40)}\tlink` : git(args)},
    {git:args => args[0] === 'show' ? '' : git(args)},
    {git:args => args[0] === 'show' ? 'x'.repeat(131072) : git(args)}]) assert.throws(() => bind(patch));
});

test('all copied relative imports are in the fixed closure; writable results are never executable imports', () => {
  for (const study of ['inference','history','restores','rowmode','archive','qualification','scheduling','snapshot']) {
    const policy = studyPolicy(study,['archive','qualification','scheduling','snapshot'].includes(study) ? 'regression' : 'extended');
    assert.equal(policy.files.length,study === 'snapshot' ? 7 : study === 'scheduling' ? 4 : study === 'qualification' ? 16 : study === 'archive' ? 7 : study === 'rowmode' ? 25 : 19);
    assert.equal(new Set(policy.files).size,policy.files.length);
    for (const name of policy.files) {
      const source = readFileSync(new URL(`../fixtures/ollamaGatewayRehearsal/${name}`,import.meta.url),'utf8');
      assert.ok(!/import\s*\([^)]*\/results\//.test(source));
      for (const match of source.matchAll(/(?:from\s*|import\s*\()(['"])(\.\/?[^'"]+)\1/g)) {
        assert.ok(match[2].startsWith('./') && policy.files.includes(match[2].slice(2)),`${name}: ${match[2]}`);
      }
      assert.ok(!/writeFile\(['"`]\/fixtures\//.test(source),`${name}: executable input write`);
    }
  }
  for (const args of [['history','regression'],['__proto__','extended'],['inference','short'],['archive','extended']]) assert.throws(() => studyPolicy(...args));
});

function withBootstrap(study,profile,body) {
  const root = resolve('.tmp'); mkdirSync(root,{recursive:true});
  const directory = mkdtempSync(resolve(root,'binding-test-'));
  const fixtures = resolve(directory,'fixtures'), results = resolve(directory,'results'), app = resolve(directory,'app');
  for (const path of [fixtures,results,app]) mkdirSync(path);
  const policy = studyPolicy(study,profile), sources = {};
  // Local subprocess proof of the real bootstrap, rebasing only its fixed test
  // directories. Native Docker tests separately prove actual mounts/ownership.
  for (const name of policy.files) {
    sources[name] = 'import {writeFile} from "node:fs/promises"; await writeFile("'+resolve(results,'executed').replaceAll('\\','/')+'","yes");';
    writeFileSync(resolve(fixtures,name),sources[name]);
  }
  const manifest = {version:2,study,profile,fixtureRevision:revision,imageRevision:revision,image,entries:policy.entries,
    files:Object.fromEntries(Object.entries(sources).map(([name,source]) => [name,sha(source)])),application:{}};
  for (const name of policy.application) { writeFileSync(resolve(app,name),'application'); manifest.application[name] = sha('application'); }
  const raw = JSON.stringify(manifest); writeFileSync(resolve(fixtures,'fixture-provenance.json'),raw);
  const binding = {manifest,sha256:sha(raw)};
  const script = STUDY_BOOTSTRAP.replaceAll('/app/src/ollamaGateway',app.replaceAll('\\','/'))
    .replaceAll('/fixtures',fixtures.replaceAll('\\','/')).replaceAll('/results',results.replaceAll('\\','/'));
  const run = (entry = policy.entries[0],digest = binding.sha256,env = {},args = []) => spawnSync(process.execPath,
    ['--input-type=module','-e',script,digest,entry,...args],{encoding:'utf8',timeout:10000,maxBuffer:131072,
      env:{...process.env,NODE_OPTIONS:'',CLASSIFARR_GATEWAY_FIXTURE:'isolated',CLASSIFARR_SOAK_PROFILE:profile,...env}});
  const replace = (name,source) => {
    writeFileSync(resolve(fixtures,name),source); manifest.files[name] = sha(source);
    const raw = JSON.stringify(manifest); writeFileSync(resolve(fixtures,'fixture-provenance.json'),raw); binding.sha256 = sha(raw);
  };
  try { body({fixtures,results,app,binding,run,replace}); }
  finally { assert.ok(directory.startsWith(`${root}${sep}binding-test-`)); rmSync(directory,{recursive:true,force:true}); }
}

for (const profile of ['comparison-off','comparison-on']) {
  test(`comparison/${profile} binds exact treatment intent and refuses unbound worker loops before imports`,() => withBootstrap('comparison',profile,({run,results}) => {
    for (const [entry,args] of [['soakData.mjs',['setup']],['soakData.mjs',['wide']],['soakData.mjs',['check','[]']],
      ['soakInference.mjs',[]],['soakWorker.mjs',['archiver','once']],['soakWorker.mjs',['verifier','once']],
      ...(profile === 'comparison-on' ? [['soakWorker.mjs',['archiver','loop']],['soakWorker.mjs',['catalog-verifier','loop']]] : [])]) {
      assert.equal(run(entry,undefined,{NODE_OPTIONS:undefined},args).status,0);
    }
    rmSync(resolve(results,'executed'));
    for (const [entry,args] of [['soakInference.mjs',['extra']],['soakData.mjs',['unknown']],['soakData.mjs',['setup','extra']],
      ['soakData.mjs',['check']],['soakWorker.mjs',['verifier','loop']],
      ...(profile === 'comparison-off' ? [['soakWorker.mjs',['archiver','loop']],['soakData.mjs',['check','[{}]']]] : [])]) {
      const result = run(entry,undefined,{NODE_OPTIONS:undefined},args); assert.equal(result.status,1);
      assert.equal(JSON.parse(result.stdout.trim()).stage,'binding'); assert.equal(existsSync(resolve(results,'executed')),false);
    }
    assert.throws(() => studyPolicy('inference',profile)); assert.throws(() => studyPolicy('comparison','extended'));
  }));
}

for (const profile of ['pressure-measured','pressure-unsampled']) {
  test(`qualification/${profile} permits only its fixed pressure actions and worker arguments`,()=>withBootstrap('qualification',profile,({run,results})=>{
    const measured=profile==='pressure-measured';
    const allowed=[['catalogQualificationData.mjs',['setup','catalog-pressure']],
      ['catalogQualificationData.mjs',['fingerprint','catalog-pressure']],
      ['catalogQualificationData.mjs',['pressure-history','catalog-pressure']],
      ['archiveQualificationDriver.mjs',['archiver','normal','catalog',...(measured ? ['measure'] : [])]],
      ['archiveQualificationDriver.mjs',['verifier','normal','catalog']],
      ['archiveQualificationDriver.mjs',['catalog-verifier','normal','catalog']]];
    for(const [entry,args] of allowed) assert.equal(run(entry,undefined,{NODE_OPTIONS:undefined},args).status,0);
    assert.equal(existsSync(resolve(results,'executed')),true);
    rmSync(resolve(results,'executed'));
    for(const [entry,args] of [['archiveQualificationData.mjs',[]],['catalogQualificationData.mjs',['wide','catalog-wide']],
      ['catalogQualificationData.mjs',['compare-reads','catalog-pressure']],['archiveQualificationDriver.mjs',['cleanup','normal','catalog']],
      ['archiveQualificationDriver.mjs',['archiver','pause','catalog']],['archiveQualificationDriver.mjs',['archiver','normal']],
      ['archiveQualificationDriver.mjs',['archiver','normal','catalog',...(measured ? [] : ['measure'])]],
      ['archiveQualificationDriver.mjs',['verifier','normal','catalog','measure']]]) {
      const result=run(entry,undefined,{NODE_OPTIONS:undefined},args);assert.equal(result.status,1,result.stderr);
      assert.equal(JSON.parse(result.stdout.trim()).stage,'binding');assert.equal(existsSync(resolve(results,'executed')),false);
    }
  }));
}

test('snapshot bootstrap restricts actions and verifies every helper and application input before import',()=>withBootstrap('snapshot','regression',({fixtures,app,run,results})=>{
  for(const action of ['setup','small','wide','probes','restart']) assert.equal(run(undefined,undefined,{NODE_OPTIONS:undefined},[action]).status,0);
  for(const args of [[],['setup','extra'],['refresh']]) assert.equal(run(undefined,undefined,{NODE_OPTIONS:undefined},args).status,1);
  for(const [root,name] of [[fixtures,'snapshotReuseCache.mjs'],[app,'onlineArchiveSnapshot.mjs']]) {
    const path=resolve(root,name), original=readFileSync(path); writeFileSync(path,'changed');
    const result=run(undefined,undefined,{NODE_OPTIONS:undefined},['setup']); assert.equal(result.status,1);
    assert.equal(JSON.parse(result.stdout.trim()).stage,'binding'); writeFileSync(path,original);
  }
  assert.equal(existsSync(resolve(results,'executed')),true);
}));

for (const profile of ['regression','rotation']) {
  test(`scheduling/${profile} preserves one action and rejects cross-profile intent before import`, () => withBootstrap('scheduling',profile,({binding,run,replace,results}) => {
    replace('catalogScheduling.mjs','console.log(JSON.stringify({args:process.argv.slice(2),execArgv:process.execArgv}));');
    const allowed = ['setup','worker','register-only','quiet','inference','accept-inference',
      ...(profile === 'rotation' ? ['study-begin','study-refresh','study-check'] : ['refresh','handoff','owned-prepare','owned-capture','owned-check'])];
    for (const action of allowed) {
      schedulingActionArgs(binding,action);
      const result = run(undefined,undefined,{NODE_OPTIONS:undefined},[action]); assert.equal(result.status,0,result.stderr);
      assert.deepEqual(requireBoundStudyRecords(result.stdout.trim().split('\n').map(JSON.parse),binding,'catalogScheduling.mjs'),[{args:[action],execArgv:[]}]);
    }
    for (const args of [[],['setup','extra'],['unknown'],[profile === 'rotation' ? 'refresh' : 'study-begin']]) {
      const result = run(undefined,undefined,{NODE_OPTIONS:undefined},args); assert.equal(result.status,1);
      assert.equal(JSON.parse(result.stdout.trim()).stage,'binding');
      if (args.length === 1) assert.throws(() => schedulingActionArgs(binding,args[0]));
    }
    assert.equal(existsSync(resolve(results,'executed')),false);
    assert.throws(() => studyPolicy('scheduling','extended'));
    assert.throws(() => studyNodeArgs(binding,'catalogRotationStudy.mjs',['setup']));
  }));
}

for (const helper of ['catalogRotationStudy.mjs','rotationStudyContract.mjs','catalogOwnedPressure.mjs']) {
  test(`scheduling rejects changed helper ${helper} before database setup`, () => withBootstrap('scheduling','rotation',({fixtures,results,run}) => {
    writeFileSync(resolve(fixtures,helper),'changed executable');
    const result = run(undefined,undefined,{NODE_OPTIONS:undefined},['setup']);
    assert.equal(result.status,1); assert.equal(existsSync(resolve(results,'executed')),false);
    assert.equal(JSON.parse(result.stdout.trim()).stage,'binding');
  }));
}

for (const [study,profile] of [['inference','regression'],['inference','extended'],['history','extended'],['restores','extended'],['rowmode','extended'],['archive','regression'],
  ['qualification','regression'],['qualification','measured'],['qualification','unsampled']]) {
  test(`pre-import bootstrap binds ${study}/${profile} with original argument shape`, () => withBootstrap(study,profile,({results,binding,run}) => {
    const result = run(undefined,undefined,{NODE_OPTIONS:undefined}); assert.equal(result.status,0,result.stderr);
    const rows = result.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(requireBoundStudyRecords(rows,binding,studyPolicy(study,profile).entries[0]),[]);
    assert.equal(existsSync(resolve(results,'executed')),true);
  }));
}

for (const helper of ['cleanupQueryDiagnostics.mjs','archiveEvidenceVerifier.mjs']) {
  test(`qualification rejects changed indirect launch input ${helper} before driver execution`, () => withBootstrap('qualification','regression',({fixtures,results,run}) => {
    writeFileSync(resolve(fixtures,helper),'changed executable');
    const result = run('archiveQualificationDriver.mjs',undefined,{NODE_OPTIONS:undefined},['cleanup','normal']);
    assert.equal(result.status,1); assert.equal(existsSync(resolve(results,'executed')),false);
    assert.equal(JSON.parse(result.stdout.trim()).stage,'binding');
  }));
}

test('only the measured qualification archiver accepts its exact existing four arguments', () => {
  for (const profile of ['regression','measured','unsampled']) withBootstrap('qualification',profile,({binding,run,replace}) => {
    replace('archiveQualificationDriver.mjs','console.log(JSON.stringify({args:process.argv.slice(2),execArgv:process.execArgv}));');
    const entry = 'archiveQualificationDriver.mjs', valid = ['archiver','normal','catalog','measure'];
    for (const args of [valid,['cleanup','normal','catalog','measure'],['archiver','pause','catalog','measure'],
      ['archiver','normal','catalog','other'],[...valid,'extra']]) {
      const allowed = profile === 'measured' && args === valid;
      if (allowed) assert.doesNotThrow(() => studyNodeArgs(binding,entry,args));
      else assert.throws(() => studyNodeArgs(binding,entry,args));
      const result = run(entry,binding.sha256,{NODE_OPTIONS:undefined},args);
      assert.equal(result.status,allowed ? 0 : 1,result.stderr);
      const rows = result.stdout.trim().split('\n').map(line => JSON.parse(line));
      if (allowed) assert.deepEqual(requireBoundStudyRecords(rows,binding,entry),[{args:valid,execArgv:[]}]);
      else assert.equal(rows[0].stage,'binding');
    }
    assert.throws(() => studyNodeArgs(binding,'catalogQualificationData.mjs',valid));
    assert.equal(run('catalogQualificationData.mjs',binding.sha256,{NODE_OPTIONS:undefined},valid).status,1);
  });
  withBootstrap('archive','regression',({binding,run}) => {
    const args = ['archiver','normal','catalog','measure'];
    assert.throws(() => studyNodeArgs(binding,'catalogArchive.mjs',args));
    assert.equal(run('catalogArchive.mjs',binding.sha256,{NODE_OPTIONS:undefined},args).status,1);
  });
});

for (const failure of ['digest','helper','entry','profile']) {
  test(`archive bootstrap refuses ${failure} before fixture execution`, () => withBootstrap('archive','regression',({fixtures,results,binding,run}) => {
    if (failure === 'helper') writeFileSync(resolve(fixtures,'catalogLateFiles.mjs'),'changed helper');
    const result = run(failure === 'entry' ? 'catalogLateFiles.mjs' : undefined,failure === 'digest' ? '0'.repeat(64) : binding.sha256,
      {NODE_OPTIONS:undefined,...(failure === 'profile' ? {CLASSIFARR_SOAK_PROFILE:'extended'} : {})});
    assert.equal(result.status,1); assert.equal(existsSync(resolve(results,'executed')),false);
    assert.deepEqual(JSON.parse(result.stdout.trim()),{fixture:'study-binding-failed',stage:'binding',reason:'fixture_binding_or_execution_failed'});
  }));
}

test('archive receipt arguments preserve their exact shape and existing 32 KiB bound', t => withBootstrap('archive','regression',({binding,run,replace}) => {
  replace('catalogRetention.mjs','console.log(JSON.stringify(process.argv.slice(2)));');
  const maximum = JSON.stringify({padding:'x'.repeat(32754)}); assert.equal(Buffer.byteLength(maximum),32768);
  assert.doesNotThrow(() => studyNodeArgs(binding,'catalogRetention.mjs',['accept',maximum]));
  assert.throws(() => studyNodeArgs(binding,'catalogRetention.mjs',['accept',`${maximum} `]));
  // Windows' total CreateProcess command line is smaller than this bound plus
  // the inline bootstrap. Linux CI proves the complete boundary invocation.
  const args = ['accept',process.platform === 'win32' ? JSON.stringify({padding:'x'.repeat(1024)}) : maximum];
  const result = run('catalogRetention.mjs',binding.sha256,{NODE_OPTIONS:undefined},args);
  assert.equal(result.status,0,result.stderr);
  const rows = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(requireBoundStudyRecords(rows,binding,'catalogRetention.mjs'),[args]);
  if (process.platform === 'win32') t.diagnostic('32 KiB host bound checked; Linux CI exercises full-size bootstrap launch beyond Windows total command-line limit');
  else {
    const oversized = run('catalogRetention.mjs',binding.sha256,{NODE_OPTIONS:undefined},['accept',`${maximum} `]);
    assert.equal(oversized.status,1); assert.equal(JSON.parse(oversized.stdout.trim()).stage,'binding');
  }
}));

for (const failure of ['digest','changed','missing','extra','entry','environment','application','oversize','malformed']) {
  test(`bootstrap refuses ${failure} before any fixture side effect`, () => withBootstrap('rowmode','extended',({fixtures,results,app,binding,run}) => {
    if (failure === 'changed') writeFileSync(resolve(fixtures,'restoreStudyHeap.mjs'),'changed');
    if (failure === 'missing') rmSync(resolve(fixtures,'restoreStudyHeap.mjs'));
    if (failure === 'extra') writeFileSync(resolve(fixtures,'unexpected.mjs'),'extra');
    if (failure === 'application') writeFileSync(resolve(app,'catalogContent.mjs'),'changed');
    if (failure === 'oversize') writeFileSync(resolve(fixtures,'restoreStudyHeap.mjs'),'x'.repeat(131072));
    if (failure === 'malformed') writeFileSync(resolve(fixtures,'fixture-provenance.json'),'{');
    const result = run(failure === 'entry' ? '../results/evil.mjs' : undefined,failure === 'digest' ? '0'.repeat(64) : binding.sha256,
      {NODE_OPTIONS:failure === 'environment' ? '--no-warnings' : undefined});
    assert.equal(result.status,1,result.stderr); assert.equal(existsSync(resolve(results,'executed')),false);
    assert.deepEqual(JSON.parse(result.stdout.trim()),{fixture:'study-binding-failed',stage:'binding',reason:'fixture_binding_or_execution_failed'});
  }));
}

test('symlink fixture refuses when the platform permits creating symlinks', t => withBootstrap('history','extended',({fixtures,results,run}) => {
  rmSync(resolve(fixtures,'restoreStudyHeap.mjs'));
  try { symlinkSync(resolve(fixtures,'soakData.mjs'),resolve(fixtures,'restoreStudyHeap.mjs')); }
  catch (error) { if (error.code === 'EPERM') { t.skip('Windows symlink creation unavailable; native container has O_NOFOLLOW'); return; } throw error; }
  const result = run(undefined,undefined,{NODE_OPTIONS:undefined}); assert.equal(result.status,1);
  assert.equal(existsSync(resolve(results,'executed')),false);
}));

test('inspected commands, mounts and output must match independently expected identity', () => {
  const binding = bind(), entry = 'soakData.mjs', stores = {fixtures:'owned-inputs',results:'owned-results'};
  const value = {Image:image,Config:{Entrypoint:['node'],Cmd:studyNodeArgs(binding,entry),
    Env:['CLASSIFARR_GATEWAY_FIXTURE=isolated','CLASSIFARR_SOAK_PROFILE=extended']},
    Mounts:Object.entries(stores).map(([kind,Name]) => ({Type:'volume',Name,Destination:`/${kind}`,RW:false}))};
  assertStudyCommand(value,binding,entry); assertStudyVolumes(value,stores);
  for (const mutate of [v => {v.Config.Cmd[3]='0'.repeat(64);},v => {v.Config.Cmd[2]='console.log("passed")';},
    v => {v.Image='wrong';},v => {v.Config.Env.push('NODE_OPTIONS=--inspect');}]) {
    const changed = structuredClone(value); mutate(changed); assert.throws(() => assertStudyCommand(changed,binding,entry));
  }
  for (const mutate of [v => {v.Mounts[0].RW=true;},v => {v.Mounts[0].Name='foreign';},v => {v.Mounts.pop();}]) {
    const changed = structuredClone(value); mutate(changed); assert.throws(() => assertStudyVolumes(changed,stores));
  }
  const record = studyBindingRecord(binding,entry); requireBoundStudyRecords([record],binding,entry);
  for (const rows of [[],[{passed:true}],[{...record,sha256:'0'.repeat(64)}],[record,record]]) assert.throws(() => requireBoundStudyRecords(rows,binding,entry));
  assert.throws(() => studyNodeArgs(binding,'../evil.mjs')); assert.throws(() => studyNodeArgs(binding,entry,['x'.repeat(32769)]));
});

test('staging failure still removes the owned container and exact generated input directory', () => {
  mkdirSync(resolve('.tmp'),{recursive:true});
  const before = readdirSync(resolve('.tmp')).filter(name => name.startsWith('gateway-study-inputs-'));
  const removed = [], binding = bind();
  assert.throws(() => stageStudyInputs({image,binding,name:'owned-stager',label:'owned=yes',stores:{fixtures:'owned-inputs'},
    docker() { throw Error('synthetic_create_failure'); },remove:name => removed.push(name)}),/synthetic_create_failure/);
  assert.deepEqual(removed,['owned-stager']);
  assert.deepEqual(readdirSync(resolve('.tmp')).filter(name => name.startsWith('gateway-study-inputs-')),before);
});

test('stager initializes an absent .tmp in an empty working directory and cleans a failed create', () => {
  mkdirSync(resolve('.tmp'),{recursive:true});
  const root = resolve('.tmp'), directory = mkdtempSync(resolve(root,'fresh-binding-'));
  const module = new URL('../lib/gatewayStudyInputs.mjs',import.meta.url).href;
  const binding = bind(); binding.sources = Object.fromEntries(Object.entries(binding.sources).map(([name,value]) => [name,value.toString()]));
  const script = `import assert from 'node:assert/strict';import{existsSync,readdirSync}from'node:fs';
    import{stageStudyInputs}from${JSON.stringify(module)};assert.equal(existsSync('.tmp'),false);const removed=[];
    assert.throws(()=>stageStudyInputs({image:${JSON.stringify(image)},binding:${JSON.stringify(binding)},name:'owned-stager',label:'owned=yes',stores:{fixtures:'owned-inputs'},
      docker(){throw Error('synthetic_create_failure')},remove(name){removed.push(name)}}),/synthetic_create_failure/);
    assert.deepEqual(removed,['owned-stager']);assert.deepEqual(readdirSync('.tmp'),[]);console.log('fresh-staging-passed');`;
  try {
    const result = spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:directory,encoding:'utf8',timeout:10000});
    assert.equal(result.status,0,result.stderr); assert.equal(result.stdout.trim(),'fresh-staging-passed');
  } finally { assert.ok(directory.startsWith(`${root}${sep}fresh-binding-`)); rmSync(directory,{recursive:true,force:true}); }
});
