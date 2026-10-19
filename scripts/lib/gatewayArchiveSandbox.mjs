/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { studyNodeArgs } from './gatewayStudyBootstrap.mjs';
import { assertStudyCommand } from './gatewayStudyInputs.mjs';

const temporary = {
  '/verification':'rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
  '/tmp':'rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
};
const entries = {catalog:'catalogArchive.mjs',retention:'catalogRetention.mjs'};

export function assertArchiveSandbox(value,{image,kind,stores,binding,args = []}) {
  assert.ok(['archive','catalog','retention'].includes(kind));
  assert.equal(value.Image,image); assert.equal(value.Config.User,'1000:1000');
  assert.deepEqual(value.Config.Healthcheck.Test,['NONE']);
  const host = value.HostConfig;
  assert.equal(host.NetworkMode,'none'); assert.equal(host.ReadonlyRootfs,true); assert.equal(host.Init,true);
  assert.equal(host.Privileged,false); assert.equal(host.PidMode,'');
  assert.deepEqual(host.CapDrop,['ALL']); assert.ok(host.SecurityOpt.includes('no-new-privileges'));
  assert.equal(host.Memory,1610612736); assert.equal(host.MemorySwap,host.Memory);
  assert.equal(host.NanoCpus,1000000000); assert.equal(host.PidsLimit,64);
  assert.deepEqual(Object.keys(host.PortBindings ?? {}),[]); assert.deepEqual(host.Tmpfs,temporary);
  const kinds = ['archives','receipts',...(kind === 'retention' ? ['catalogs'] : []),...(kind === 'archive' ? [] : ['fixtures'])];
  assert.deepEqual(value.Mounts.map(item => [item.Type,item.Name,item.Destination,item.RW]).sort(),
    kinds.map(key => ['volume',stores[key],`/${key}`,kind === 'archive' && key === 'receipts']).sort());
  assert.ok(value.Config.Env.every(item => !/^(NODE_OPTIONS|DATABASE_URL|.*PASSWORD|.*TOKEN|.*CONFIG_FILE)=/.test(item)));
  if (kind === 'archive') {
    assert.deepEqual(value.Config.Entrypoint,['node']);
    assert.deepEqual(value.Config.Cmd,['/app/src/scripts/runGatewayArchiveVerifier.mjs','--once']);
  } else {
    assert.equal(binding.manifest.image,image); assert.equal(binding.manifest.study,'archive');
    assertStudyCommand(value,binding,entries[kind],args);
  }
}

/** No source socket/configuration or host executable binds enter a verifier. */
export function createArchiveVerifier({docker,inspect,image,name,label,kind,stores,binding,args = []}) {
  assert.ok(['archive','catalog','retention'].includes(kind));
  const kinds = ['archives','receipts',...(kind === 'retention' ? ['catalogs'] : []),...(kind === 'archive' ? [] : ['fixtures'])];
  docker(['create','--name',name,'--label',label,'--network','none','--user','1000:1000','--read-only','--init','--no-healthcheck',
    '--cap-drop','ALL','--security-opt','no-new-privileges','--memory','1536m','--memory-swap','1536m','--cpus','1','--pids-limit','64',
    ...kinds.flatMap(key => ['--mount',`type=volume,source=${stores[key]},target=/${key}${kind === 'archive' && key === 'receipts' ? '' : ',readonly'}`]),
    ...Object.entries(temporary).flatMap(([path,options]) => ['--tmpfs',`${path}:${options}`]),
    ...(kind === 'archive' ? [] : ['-e','CLASSIFARR_GATEWAY_FIXTURE=isolated','-e','CLASSIFARR_SOAK_PROFILE=regression']),
    '--entrypoint','node',image,...(kind === 'archive' ? ['/app/src/scripts/runGatewayArchiveVerifier.mjs','--once'] : studyNodeArgs(binding,entries[kind],args))]);
  assertArchiveSandbox(inspect(name),{image,kind,stores,binding,args});
}

export function assertArchiveVerifierStopped(value) {
  assert.equal(value.State.Running,false); assert.equal(value.State.ExitCode,0); assert.equal(value.State.OOMKilled,false);
}
