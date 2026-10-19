/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { studyNodeArgs } from './gatewayStudyBootstrap.mjs';
import { assertStudyCommand } from './gatewayStudyInputs.mjs';
import { QUALIFICATION_DRIVER } from './gatewayQualificationExecution.mjs';

const scratch = 'rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev';
const verification = 'rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev';
function layout(kind,catalog) {
  assert.ok(['archiver','cleanup','verifier','catalog-verifier','batch-verifier'].includes(kind));
  const worker = !kind.endsWith('verifier');
  return { worker,mounts:[['archives','/archives',kind === 'archiver'],['receipts','/receipts',!worker],['fixtures','/fixtures',false],
    ...(catalog ? [['catalogs','/catalogs',kind === 'archiver']] : []),
    ...(worker ? [['socket','/source-socket',false],['configuration','/configuration',false]] : [])],
  tmpfs:{'/tmp':scratch,...(worker ? {} : {'/verification':verification})} };
}

export function qualificationDriverArgs(kind,mode,catalog,measure) {
  assert.ok(['normal','pause','cancel','publication','acknowledgment','contention'].includes(mode));
  return [kind,mode,...(catalog ? ['catalog'] : []),...(measure && kind === 'archiver' ? ['measure'] : [])];
}

export function assertQualificationSandbox(value,{image,kind,catalog,measure,mode,stores,binding}) {
  const {worker,mounts,tmpfs} = layout(kind,catalog), host = value.HostConfig;
  assert.equal(binding.manifest.study,'qualification'); assert.equal(binding.manifest.image,image);
  assertStudyCommand(value,binding,QUALIFICATION_DRIVER,qualificationDriverArgs(kind,mode,catalog,measure));
  assert.equal(value.Config.User,'1000:1000'); assert.deepEqual(value.Config.Healthcheck.Test,['NONE']);
  assert.equal(host.NetworkMode,'none'); assert.equal(host.ReadonlyRootfs,true); assert.equal(host.Init,true);
  assert.equal(host.Privileged,false); assert.equal(host.PidMode,'');
  assert.deepEqual(host.CapDrop,['ALL']); assert.ok(host.SecurityOpt.includes('no-new-privileges'));
  assert.equal(host.Memory,worker ? 268435456 : 1610612736); assert.equal(host.MemorySwap,host.Memory);
  assert.equal(host.NanoCpus,worker ? 500000000 : 1000000000); assert.equal(host.PidsLimit,worker ? 32 : 64);
  assert.deepEqual(Object.keys(host.PortBindings ?? {}),[]); assert.deepEqual(host.Tmpfs,tmpfs);
  assert.deepEqual(value.Mounts.map(item => [item.Type,item.Name,item.Destination,item.RW]).sort(),
    mounts.map(([key,path,writable]) => ['volume',stores[key],path,writable]).sort());
}

export function createQualificationWorker({docker,inspect,image,name,label,kind,mode,stores,binding,catalog,measure}) {
  const {worker,mounts,tmpfs} = layout(kind,catalog), memory = worker ? '256m' : '1536m';
  docker(['create','--name',name,'--label',label,'--network','none','--read-only','--init','--no-healthcheck',
    '--user','1000:1000','--cap-drop','ALL','--security-opt','no-new-privileges','--memory',memory,'--memory-swap',memory,
    '--cpus',worker ? '0.5' : '1','--pids-limit',worker ? '32' : '64',
    ...mounts.flatMap(([key,path,writable]) => ['--mount',`type=volume,source=${stores[key]},target=${path}${writable ? '' : ',readonly'}`]),
    ...Object.entries(tmpfs).flatMap(([path,options]) => ['--tmpfs',`${path}:${options}`]),
    '-e','CLASSIFARR_GATEWAY_FIXTURE=isolated','-e',`CLASSIFARR_SOAK_PROFILE=${binding.manifest.profile}`,
    '--entrypoint','node',image,...studyNodeArgs(binding,QUALIFICATION_DRIVER,qualificationDriverArgs(kind,mode,catalog,measure))]);
  assertQualificationSandbox(inspect(name),{image,kind,catalog,measure,mode,stores,binding});
}

/** Producer keeps the production entrypoint and a unique disposable data bind. */
export function assertQualificationSource(value,{image,stores,catalog}) {
  const host = value.HostConfig;
  assert.equal(value.Image,image); assert.equal(host.NetworkMode,'none'); assert.equal(host.Privileged,false); assert.equal(host.PidMode,'');
  assert.equal(host.Memory,2147483648); assert.equal(host.MemorySwap,host.Memory);
  assert.equal(host.NanoCpus,2000000000); assert.equal(host.PidsLimit,512);
  assert.deepEqual(Object.keys(host.PortBindings ?? {}),[]); assert.deepEqual(host.Tmpfs,{'/quota':scratch});
  const keys = ['archives','receipts','socket','configuration','fixtures',...(catalog ? ['catalogs'] : [])];
  const data = value.Mounts.filter(item => item.Destination === '/app/data');
  assert.equal(data.length,1); assert.equal(data[0].Type,'bind'); assert.equal(data[0].RW,true);
  assert.equal(value.Mounts.length,keys.length + 1);
  for (const key of keys) {
    const mounts = value.Mounts.filter(item => item.Destination === (key === 'socket' ? '/var/run/postgresql' : `/${key}`));
    assert.equal(mounts.length,1); assert.equal(mounts[0].Type,'volume');
    assert.equal(mounts[0].Name,stores[key]); assert.equal(mounts[0].RW,key !== 'fixtures');
  }
}
