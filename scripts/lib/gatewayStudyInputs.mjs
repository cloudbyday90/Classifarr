/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,rmSync,lstatSync } from 'node:fs';
import { resolve,sep } from 'node:path';
import { studyNodeArgs } from './gatewayStudyBootstrap.mjs';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';

export function assertStudyVolumes(value,stores,writableResults = false) {
  for (const [kind,writable] of [['fixtures',false],['results',writableResults]]) {
    const mounts = value.Mounts.filter(item => item.Destination === `/${kind}`);
    assert.equal(mounts.length,1); assert.equal(mounts[0].Type,'volume');
    assert.equal(mounts[0].Name,stores[kind]); assert.equal(mounts[0].RW,writable,'study_input_mount_writable');
  }
}
export function assertStudyCommand(value,binding,entry,args = []) {
  assert.equal(value.Image,binding.manifest.image); assert.deepEqual(value.Config.Entrypoint,['node']);
  assert.deepEqual(value.Config.Cmd,studyNodeArgs(binding,entry,args),'study_command_binding_mismatch');
  assert.ok(value.Config.Env.includes(`CLASSIFARR_SOAK_PROFILE=${binding.manifest.profile}`));
  assert.ok(value.Config.Env.includes('CLASSIFARR_GATEWAY_FIXTURE=isolated'));
  assert.ok(value.Config.Env.every(value => !/^(NODE_OPTIONS|DATABASE_URL|.*PASSWORD|.*TOKEN|.*CONFIG_FILE)=/.test(value)));
}

/** Exact committed bytes enter a private volume before any workload starts. */
export function stageStudyInputs({ docker,image,binding,name,label,stores,inspect,remove }) {
  const root = resolve('.tmp'), directory = mkdtempSync(resolve(root,'gateway-study-inputs-'));
  try {
    for (const [file,bytes] of Object.entries(binding.sources)) writeFileSync(resolve(directory,file),bytes,{mode:0o600,flag:'wx'});
    writeFileSync(resolve(directory,'fixture-provenance.json'),JSON.stringify(binding.manifest),{mode:0o600,flag:'wx'});
    docker(['create','--name',name,'--label',label,'--network','none','--read-only','--no-healthcheck',
      '--user','0:0','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','128m','--memory-swap','128m',
      '--cpus','0.5','--pids-limit','16','--mount',`type=volume,source=${stores.fixtures},target=/fixtures`,
      '-e','CLASSIFARR_GATEWAY_FIXTURE=isolated','-e',`CLASSIFARR_SOAK_PROFILE=${binding.manifest.profile}`,
      '--entrypoint','node',image,...studyNodeArgs(binding,'seal')]);
    const value = inspect(name); assertStudyCommand(value,binding,'seal');
    assert.equal(value.HostConfig.NetworkMode,'none'); assert.equal(value.HostConfig.ReadonlyRootfs,true);
    assert.equal(value.Config.User,'0:0'); assert.equal(value.HostConfig.Privileged,false); assert.equal(value.HostConfig.PidMode,'');
    assert.deepEqual(value.HostConfig.CapDrop,['ALL']); assert.ok(value.HostConfig.SecurityOpt.includes('no-new-privileges'));
    assert.deepEqual(Object.keys(value.HostConfig.PortBindings ?? {}),[]);
    assert.equal(value.HostConfig.Memory,134217728); assert.equal(value.HostConfig.MemorySwap,value.HostConfig.Memory);
    assert.equal(value.HostConfig.NanoCpus,500000000); assert.equal(value.HostConfig.PidsLimit,16);
    assert.deepEqual(value.Mounts.map(item => [item.Type,item.Name,item.Destination,item.RW]),[['volume',stores.fixtures,'/fixtures',true]]);
    docker(['cp',`${directory}${sep}.`,`${name}:/fixtures`]);
    const output = runDockerCheckCommand(['start','--attach',name],{timeoutMs:30000});
    assert.equal(output.ok,true,'study_seal_failed');
    assert.deepEqual(JSON.parse(output.stdout.trim()),{fixture:'study-sealed',sha256:binding.sha256,symlinkRefused:true});
    assert.equal(inspect(name).State.ExitCode,0); assert.equal(inspect(name).State.OOMKilled,false);
  } finally {
    try { remove(name); }
    finally {
      // Only the exact freshly generated directory below this workspace's .tmp.
      assert.ok(directory.startsWith(`${root}${sep}gateway-study-inputs-`));
      assert.ok(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink());
      rmSync(directory,{recursive:true,force:true});
    }
  }
}

export function verifyStudyInputProtection(docker,source) {
  const result = docker(['exec','--user','1000:1000',source,'node','--input-type=module','-e',
    'import{open,writeFile,unlink}from"node:fs/promises";for(const p of ["/fixtures/soakData.mjs","/fixtures/new.mjs"]){let denied=false;try{const f=await open(p,"a");await f.close()}catch(e){denied=["EROFS","EACCES"].includes(e.code)}if(!denied)throw Error("study_input_write_allowed")}await writeFile("/results/write-probe.json","{}",{flag:"wx",mode:0o600});await unlink("/results/write-probe.json");console.log("protected")']);
  assert.equal(result.trim(),'protected','study_input_protection_failed');
}
