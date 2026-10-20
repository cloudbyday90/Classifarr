/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

// Serialized into the independently inspected Docker command, not copied from a
// fixture volume. Only Node builtins execute before all committed inputs verify.
async function bootstrap() {
  const { default:check } = await import('node:assert/strict');
  const { open,readdir,lstat,chmod,writeFile,symlink,unlink } = await import('node:fs/promises');
  const { constants } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const sha = value => createHash('sha256').update(value).digest('hex');
  let stage = 'binding', entry;
  try {
    check.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated'); check.equal(process.env.NODE_OPTIONS,undefined);
    check.equal(process.execArgv.length,3); check.deepEqual(process.execArgv.slice(0,2),['--input-type=module','-e']);
    const [expected,selected,...args] = process.argv.slice(1); entry = selected;
    check.match(expected,/^[a-f0-9]{64}$/); check.ok(args.length <= 4 && args.every(value => Buffer.byteLength(value) <= 32768));
    const read = async (path,limit) => {
      const file = await open(path,constants.O_RDONLY | constants.O_NOFOLLOW);
      try { const info = await file.stat(); check.ok(info.isFile() && info.size > 0 && info.size < limit); return await file.readFile(); }
      finally { await file.close(); }
    };
    const raw = await read('/fixtures/fixture-provenance.json',16384);
    check.equal(sha(raw),expected); // Pin before JSON interpretation or fixture imports.
    const binding = JSON.parse(raw);
    check.deepEqual(Object.keys(binding).sort(),['application','entries','files','fixtureRevision','image','imageRevision','profile','study','version']);
    check.equal(binding.version,2); check.match(binding.image,/^sha256:[a-f0-9]{64}$/);
    for (const value of [binding.fixtureRevision,binding.imageRevision]) check.match(value,/^[a-f0-9]{40}$/);
    check.ok(['inference','history','restores','rowmode','archive','qualification','scheduling','snapshot','comparison'].includes(binding.study));
    check.equal(process.env.CLASSIFARR_SOAK_PROFILE,binding.profile);
    check.ok(binding.study === 'comparison' ? ['comparison-off','comparison-on'].includes(binding.profile) :
      binding.study === 'scheduling' ? ['regression','rotation'].includes(binding.profile) :
      binding.study === 'snapshot' ? binding.profile === 'regression' :
      binding.study === 'qualification' ? ['regression','measured','unsampled','pressure-measured','pressure-unsampled'].includes(binding.profile) :
      ['regression','extended'].includes(binding.profile) && (binding.study === 'inference' ||
        (binding.study === 'archive' ? binding.profile === 'regression' : binding.profile === 'extended')));
    // The existing sampled archiver alone has four arguments. No generic relaxation.
    check.ok(args.length <= 3 || (binding.study === 'qualification' && ['measured','pressure-measured'].includes(binding.profile) &&
      entry === 'archiveQualificationDriver.mjs' && JSON.stringify(args) === '["archiver","normal","catalog","measure"]'));
    const names = Object.keys(binding.files); check.ok(names.length > 0 && names.length <= 32);
    check.deepEqual((await readdir('/fixtures')).sort(),[...names,'fixture-provenance.json'].sort());
    for (const name of names) {
      check.match(name,/^[A-Za-z]+\.mjs$/); check.match(binding.files[name],/^[a-f0-9]{64}$/);
      check.equal(sha(await read(`/fixtures/${name}`,131072)),binding.files[name]);
    }
    check.ok(Array.isArray(binding.entries) && binding.entries.every(name => names.includes(name)));
    check.deepEqual(Object.keys(binding.application),binding.study === 'snapshot' ?
      ['catalogRowReader.mjs','catalogContent.mjs','onlineArchiveSnapshot.mjs','archiveRetentionQueries.mjs'] :
      binding.study === 'rowmode' ? ['catalogRowReader.mjs','catalogContent.mjs'] : []);
    for (const [name,digest] of Object.entries(binding.application)) {
      check.match(digest,/^[a-f0-9]{64}$/);
      check.equal(sha((await read(`/app/src/ollamaGateway/${name}`,131072)).toString('utf8').replaceAll('\r\n','\n')),digest);
    }
    if (entry === 'seal') {
      check.equal(args.length,0); check.equal(process.getuid(),0);
      // Native Linux proof for hosts (notably Windows) that cannot create the
      // equivalent symlink in their local subprocess tests. No fixture imports.
      const probe = '/fixtures/.binding-symlink-probe';
      await symlink('/fixtures/fixture-provenance.json',probe);
      let denied = false;
      try { await read(probe,16384); } catch (error) { denied = error.code === 'ELOOP'; }
      finally { await unlink(probe); }
      check.equal(denied,true,'study_symlink_read_allowed');
      for (const name of [...names,'fixture-provenance.json']) await chmod(`/fixtures/${name}`,0o444);
      await chmod('/fixtures',0o555);
      console.log(JSON.stringify({ fixture:'study-sealed',sha256:expected,symlinkRefused:true })); return;
    }
    check.ok(binding.entries.includes(entry));
    if (binding.study === 'comparison') {
      if (entry === 'soakData.mjs') {
        check.ok(['setup','wide','check'].includes(args[0]));
        check.equal(args.length,args[0] === 'check' ? 2 : 1);
        if (args[0] === 'check' && binding.profile === 'comparison-off') check.equal(args[1],'[]');
      } else if (entry === 'soakWorker.mjs') {
        check.equal(args.length,2);
        check.ok(args[1] === 'once' ? ['archiver','verifier','catalog-verifier'].includes(args[0]) :
          binding.profile === 'comparison-on' && args[1] === 'loop' && ['archiver','catalog-verifier'].includes(args[0]));
      } else { check.equal(entry,'soakInference.mjs'); check.equal(args.length,0); }
    }
    if (binding.study==='qualification' && binding.profile.startsWith('pressure-')) {
      if (entry==='catalogQualificationData.mjs') {
        check.equal(args.length,2);check.equal(args[1],'catalog-pressure');
        check.ok(['setup','admit','history','wide','acknowledge-inference','pressure-history','history-change','inspect','diagnose','oversized-evidence','fingerprint'].includes(args[0]));
      } else {
        check.equal(entry,'archiveQualificationDriver.mjs');
        check.ok(['archiver','verifier','catalog-verifier'].includes(args[0]));check.equal(args[1],'normal');check.equal(args[2],'catalog');
        check.deepEqual(args.slice(3),args[0]==='archiver' && binding.profile==='pressure-measured' ? ['measure'] : []);
      }
    }
    if (binding.study === 'snapshot') {
      check.equal(entry,'snapshotReuseStudy.mjs'); check.equal(args.length,1);
      check.ok(['setup','small','wide','probes','restart'].includes(args[0]));
    }
    if (binding.study === 'scheduling') {
      const actions = ['setup','worker','register-only','quiet','inference','accept-inference',
        ...(binding.profile === 'rotation' ? ['study-begin','study-refresh','study-check'] : ['refresh','handoff','owned-prepare','owned-capture','owned-check'])];
      check.equal(entry,'catalogScheduling.mjs'); check.equal(args.length,1); check.ok(actions.includes(args[0]));
    }
    check.ok((await lstat('/fixtures')).isDirectory());
    const record = { fixture:'study-binding',version:2,study:binding.study,profile:binding.profile,
      fixtureRevision:binding.fixtureRevision,imageRevision:binding.imageRevision,image:binding.image,sha256:expected,entry };
    if (entry === 'soakInference.mjs') await writeFile('/results/inference-binding.json',JSON.stringify(record),{mode:0o600,flag:'wx'});
    console.log(JSON.stringify(record));
    stage = 'execution'; process.argv = [process.execPath,`/fixtures/${entry}`,...args]; process.execArgv.splice(0);
    await import(`file:///fixtures/${entry}`);
  } catch {
    const record = { fixture:'study-binding-failed',stage,reason:'fixture_binding_or_execution_failed' };
    console.log(JSON.stringify(record)); process.exitCode = 1;
    if (entry === 'soakInference.mjs') {
      try { await writeFile('/results/binding-failed.json',JSON.stringify(record),{mode:0o600,flag:'wx'}); } catch { /* Never replace the original failure. */ }
    }
  }
}

export const STUDY_BOOTSTRAP = `await (${bootstrap.toString()})();`;
export function studyNodeArgs(binding,entry,args = []) {
  assert.ok(entry === 'seal' || binding.manifest.entries.includes(entry),'study_entry_invalid');
  assert.match(binding.sha256,/^[a-f0-9]{64}$/);
  assert.ok((args.length <= 3 || (binding.manifest.study === 'qualification' && ['measured','pressure-measured'].includes(binding.manifest.profile) &&
    entry === 'archiveQualificationDriver.mjs' && JSON.stringify(args) === '["archiver","normal","catalog","measure"]')) &&
    args.every(value => typeof value === 'string' && Buffer.byteLength(value) <= 32768));
  return ['--input-type=module','-e',STUDY_BOOTSTRAP,binding.sha256,entry,...args];
}
