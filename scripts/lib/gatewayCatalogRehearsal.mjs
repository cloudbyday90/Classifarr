/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

/** Existing synthetic archive fixture only; no live connection/credential accepted. */
export function runGatewayCatalogRehearsal({ docker, image, source, archives, receipts, label, suffix }) {
  const script = resolve('scripts/fixtures/ollamaGatewayRehearsal/catalogArchive.mjs');
  docker(['cp',script,`${source}:/tmp/catalog-fixture.mjs`]);
  const fixture = action => process.stdout.write(docker(['exec','--user','1000:1000','-e','CLASSIFARR_GATEWAY_FIXTURE=isolated',
    source,'node','/tmp/catalog-fixture.mjs',action]));
  const name = `classifarr-catalog-test-${suffix}`;
  const verify = action => {
    assert.equal(docker(['ps','-aq','--filter',`name=^${name}$`]).trim(),'');
    try {
      docker(['create','--name',name,'--label',label,'--network','none','--user','1000:1000','--read-only','--init','--no-healthcheck',
        '--cap-drop','ALL','--security-opt','no-new-privileges','--memory','1536m','--memory-swap','1536m','--cpus','1','--pids-limit','64',
        '--mount',`type=volume,source=${archives},target=/archives,readonly`,
        '--mount',`type=volume,source=${receipts},target=/receipts,readonly`,
        '--mount',`type=bind,source=${script},target=/catalog-fixture.mjs,readonly`,
        '--tmpfs','/verification:rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
        '--tmpfs','/tmp:rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
        '-e','CLASSIFARR_GATEWAY_FIXTURE=isolated','--entrypoint','node',image,'/catalog-fixture.mjs',action]);
      const config = JSON.parse(docker(['inspect',name]))[0];
      assert.equal(config.HostConfig.NetworkMode,'none'); assert.equal(config.HostConfig.ReadonlyRootfs,true);
      assert.equal(config.Config.User,'1000:1000'); assert.equal(config.Image,image);
      assert.equal(config.Mounts.length,3); assert.ok(config.Mounts.every(m => !m.RW));
      assert.ok(config.Config.Env.every(value => !/PASSWORD=|TOKEN=|CONFIG_FILE=/.test(value)));
      process.stdout.write(docker(['start','-a',name]));
      const stopped = JSON.parse(docker(['inspect',name]))[0];
      assert.equal(stopped.State.ExitCode,0); assert.equal(stopped.State.OOMKilled,false);
    } finally {
      if (docker(['ps','-aq','--filter',`name=^${name}$`]).trim()) {
        assert.equal(JSON.parse(docker(['inspect',name]))[0].Config.Labels['io.classifarr.archive-rehearsal'],suffix);
        docker(['rm','-f',name]);
      }
      assert.equal(docker(['ps','-aq','--filter',`name=^${name}$`]).trim(),'');
    }
  };
  fixture('capture'); verify('verify');
  fixture('hide-marker'); verify('missing'); fixture('restore-marker');
  fixture('tamper'); verify('tampered'); fixture('restore-manifest'); verify('verify');
  process.stdout.write('catalog_rehearsal_passed: exact restore; absent retired files; missing marker refusal without repair; tamper refusal; zero provider calls\n');
}
