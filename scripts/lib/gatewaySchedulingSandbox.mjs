/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

const temporary = {
  '/verification':'rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
  '/tmp':'rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
};
const inputs = catalog => ['archives','receipts',...(catalog ? ['catalogs'] : [])];
const entry = catalog => ['/app/src/scripts/runGatewayArchiveVerifier.mjs','--once',...(catalog ? ['--catalog'] : [])];

export function assertSchedulingSandbox(value,{image,stores,catalog}) {
  assert.equal(typeof catalog,'boolean');
  assert.equal(value.Image,image); assert.equal(value.Config.User,'1000:1000');
  assert.deepEqual(value.Config.Entrypoint,['node']); assert.deepEqual(value.Config.Cmd,entry(catalog));
  assert.deepEqual(value.Config.Healthcheck.Test,['NONE']);
  const host = value.HostConfig;
  assert.equal(host.NetworkMode,'none'); assert.equal(host.ReadonlyRootfs,true); assert.equal(host.Init,true);
  assert.equal(host.Privileged,false); assert.equal(host.PidMode,'');
  assert.deepEqual(host.CapDrop,['ALL']); assert.ok(host.SecurityOpt.includes('no-new-privileges'));
  assert.equal(host.Memory,1610612736); assert.equal(host.MemorySwap,host.Memory);
  assert.equal(host.NanoCpus,1000000000); assert.equal(host.PidsLimit,64);
  assert.deepEqual(Object.keys(host.PortBindings ?? {}),[]); assert.deepEqual(host.Tmpfs,temporary);
  assert.deepEqual(value.Mounts.map(item => [item.Type,item.Name,item.Destination,item.RW]).sort(),
    inputs(catalog).map(key => ['volume',stores[key],`/${key}`,key === 'receipts']).sort());
  assert.ok(value.Config.Env.every(item => !/^(NODE_OPTIONS|DATABASE_URL|.*PASSWORD|.*TOKEN|.*CONFIG_FILE|CLASSIFARR_GATEWAY_FIXTURE|CLASSIFARR_SOAK_PROFILE)=/.test(item)));
}

/** Restore workers get neither executable fixtures nor any source SQL authority. */
export function createSchedulingVerifier({docker,inspect,image,stores,name,label,catalog}) {
  assert.equal(typeof catalog,'boolean');
  docker(['create','--name',name,'--label',label,'--network','none','--user','1000:1000','--read-only','--init','--no-healthcheck',
    '--cap-drop','ALL','--security-opt','no-new-privileges','--memory','1536m','--memory-swap','1536m','--cpus','1','--pids-limit','64',
    ...inputs(catalog).flatMap(key => ['--mount',`type=volume,source=${stores[key]},target=/${key}${key === 'receipts' ? '' : ',readonly'}`]),
    ...Object.entries(temporary).flatMap(([path,options]) => ['--tmpfs',`${path}:${options}`]),
    '--entrypoint','node',image,...entry(catalog)]);
  assertSchedulingSandbox(inspect(name),{image,stores,catalog});
}

export function assertSchedulingSource(value,{image,stores}) {
  assert.equal(value.Image,image);
  const host = value.HostConfig;
  assert.equal(host.NetworkMode,'none'); assert.equal(host.Privileged,false); assert.equal(host.PidMode,'');
  assert.equal(host.Memory,2147483648); assert.equal(host.MemorySwap,host.Memory);
  assert.equal(host.NanoCpus,2000000000); assert.equal(host.PidsLimit,512);
  assert.deepEqual(Object.keys(host.PortBindings ?? {}),[]); assert.equal(value.Mounts.length,5);
  for (const [kind,volume] of Object.entries(stores)) {
    const mounts = value.Mounts.filter(item => item.Destination === `/${kind}`);
    assert.equal(mounts.length,1); assert.equal(mounts[0].Type,'volume');
    assert.equal(mounts[0].Name,volume); assert.equal(mounts[0].RW,kind !== 'fixtures');
  }
  const data = value.Mounts.filter(item => item.Destination === '/app/data');
  assert.equal(data.length,1); assert.equal(data[0].Type,'bind'); assert.equal(data[0].RW,true);
}
