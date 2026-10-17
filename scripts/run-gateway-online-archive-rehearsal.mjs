/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createSchemaCheckRunSpec,withSchemaCheckContainer } from './check-schema-snapshot-container.mjs';
import { runDockerCheckCommand } from './lib/dockerCheckCommand.mjs';
import { runGatewayArchiveQualification } from './lib/gatewayArchiveQualification.mjs';

const [image,revision,mode] = process.argv.slice(2);
if (process.argv.length > 5 || (mode && !['--qualification','--cleanup'].includes(mode))) throw new Error('archive_rehearsal_arguments_invalid');
if (!/^sha256:[a-f0-9]{64}$/.test(image ?? '') || !/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('immutable_image_and_revision_required');
if (mode === '--qualification' || mode === '--cleanup') {
  await runGatewayArchiveQualification(image,revision,mode === '--cleanup');
} else {
const docker = args => execFileSync('docker',args,{ encoding: 'utf8',windowsHide: true,timeout: 240000,maxBuffer: 1048576 });
assert.equal(JSON.parse(docker(['image','inspect',image]))[0].Config.Labels['org.opencontainers.image.revision'],revision);
const spec = createSchemaCheckRunSpec(), suffix = spec.containerName.slice('classifarr-schema-check-'.length);
const archives = `classifarr-archive-test-${suffix}`, receipts = `classifarr-receipt-test-${suffix}`, verifier = `classifarr-verifier-test-${suffix}`;
const label = `io.classifarr.archive-rehearsal=${suffix}`;
const command = (args,options) => runDockerCheckCommand(args[0] === 'run' && args.includes('--label') ? [
  'run','--network','none','--memory','2g','--cpus','2','--pids-limit','512',
  '--tmpfs','/input-quota:rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
  '--mount',`type=volume,source=${archives},target=/archives`,'--mount',`type=volume,source=${receipts},target=/receipts`,...args.slice(1)] : args,options);
try {
  for (const volume of [archives,receipts]) {
    assert.equal(docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim(),'');
    docker(['volume','create','--label',label,volume]);
  }
  await withSchemaCheckContainer({ imageName: image,runSpec: spec,command,action: async () => {
    const source = spec.containerName;
    docker(['cp',resolve('scripts/fixtures/ollamaGatewayRehearsal/archiveRestoreInput.mjs'),`${source}:/tmp/archive-restore-input.mjs`]);
    process.stdout.write(docker(['exec','--user','1000:1000','-e','CLASSIFARR_GATEWAY_FIXTURE=isolated',source,
      'node','/tmp/archive-restore-input.mjs']));
    docker(['exec','--user','0:0',source,'chown','1000:1000','/archives','/receipts']);
    docker(['exec','--user','0:0',source,'chmod','700','/archives','/receipts']);
    docker(['cp',resolve('scripts/fixtures/ollamaGatewayRehearsal/onlineArchive.mjs'),`${source}:/tmp/online-archive.mjs`]);
    const fixture = action => process.stdout.write(docker(['exec','--user','1000:1000','-e','CLASSIFARR_GATEWAY_FIXTURE=isolated',source,
      'node','/tmp/online-archive.mjs',action]));
    fixture('setup');
    fixture('checks');
    docker(['create','--name',verifier,'--label',label,'--network','none','--user','1000:1000','--read-only','--init','--no-healthcheck',
      '--cap-drop','ALL','--security-opt','no-new-privileges','--memory','1536m','--memory-swap','1536m','--cpus','1','--pids-limit','64',
      '--mount',`type=volume,source=${archives},target=/archives,readonly`,'--mount',`type=volume,source=${receipts},target=/receipts`,
      '--tmpfs','/verification:rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
      '--tmpfs','/tmp:rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
      '--entrypoint','node',image,'/app/src/scripts/runGatewayArchiveVerifier.mjs','--once']);
    const configuration = JSON.parse(docker(['inspect',verifier]))[0];
    assert.equal(configuration.HostConfig.NetworkMode,'none'); assert.equal(configuration.HostConfig.ReadonlyRootfs,true);
    assert.equal(configuration.Config.User,'1000:1000'); assert.equal(configuration.Image,image);
    assert.equal(configuration.Mounts.length,2); assert.equal(configuration.Mounts.find(m => m.Destination === '/archives').RW,false);
    assert.ok(configuration.Mounts.every(m => ['/archives','/receipts'].includes(m.Destination)));
    assert.ok(configuration.Config.Env.every(value => !/PASSWORD=|TOKEN=|CONFIG_FILE=/.test(value)));
    for (let cycle=0;cycle<3;cycle++) {
      if (cycle) fixture('next');
      if (cycle === 1) {
        fixture('receipt-downgrade'); fixture('tamper-inventory');
        assert.ok(docker(['start','-a',verifier]).includes('"state":"verification_failed"'));
        fixture('restore-inventory-fixture');
      }
      const output = docker(['start','-a',verifier]); assert.ok(output.includes('"state":"verified"'),output);
      assert.equal(JSON.parse(docker(['inspect',verifier]))[0].State.ExitCode,0);
      if (!cycle) {
        fixture('receipt-crash');
        assert.ok(docker(['start','-a',verifier]).includes('"state":"idle"'));
      }
      fixture('accept');
    }
    fixture('corrupt');
    docker(['cp',resolve('scripts/fixtures/ollamaGatewayRehearsal/archiveProtection.mjs'),`${source}:/tmp/archive-protection.mjs`]);
    const protection = action => process.stdout.write(docker(['exec','--user','1000:1000','-e','CLASSIFARR_GATEWAY_FIXTURE=isolated',source,
      'node','/tmp/archive-protection.mjs',action]));
    for (let cycle=4;cycle<=7;cycle++) {
      fixture('next');
      assert.ok(docker(['start','-a',verifier]).includes('"state":"verified"'));
      if (cycle === 7) protection('retirement-cut');
      fixture('accept');
      if (cycle === 4) { protection('stage'); fixture('accept'); protection('check'); }
    }
    protection('rotated');
    process.stdout.write('online_archive_rehearsal_passed: online SELECT-only exports; isolated restricted restore; full candidate-page proof; inventory tamper and legacy receipt refusal; UUIDv7 jobs; restarted services; mixed v3/v4 rotation to 2; corruption refusal; live history unchanged; zero provider calls\n');
  } });
} finally {
  const found = docker(['ps','-aq','--filter',`name=^${verifier}$`]).trim();
  if (found) {
    assert.equal(JSON.parse(docker(['inspect',verifier]))[0].Config.Labels['io.classifarr.archive-rehearsal'],suffix);
    docker(['rm','-f',verifier]);
  }
  for (const volume of [archives,receipts]) {
    if (docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim()) {
      assert.equal(JSON.parse(docker(['volume','inspect',volume]))[0].Labels['io.classifarr.archive-rehearsal'],suffix);
      docker(['volume','rm',volume]);
    }
    assert.equal(docker(['volume','ls','-q','--filter',`name=^${volume}$`]).trim(),'');
  }
}
assert.equal(docker(['ps','-aq','--filter',`name=^${verifier}$`]).trim(),'');
assert.equal(existsSync(spec.hostDataPath),false);
process.stdout.write('online_archive_rehearsal_cleanup_verified\n');
}
