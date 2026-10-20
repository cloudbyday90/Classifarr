/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createSchemaCheckRunSpec, withSchemaCheckContainer } from '../check-schema-snapshot-container.mjs';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { soakProfile } from '../fixtures/ollamaGatewayRehearsal/soakProfile.mjs';
import { finishGatewayStudyCleanup } from './gatewayStudyCleanup.mjs';
import { runGatewayRestoreMemoryStudy } from './gatewayRestoreMemoryStudy.mjs';
import { bindStudySources } from './gatewayStudyBinding.mjs';
import { stageStudyInputs,assertStudyVolumes,assertStudyCommand } from './gatewayStudyInputs.mjs';
import { createStudyExecution } from './gatewayStudyExecution.mjs';
import { studyNodeArgs } from './gatewayStudyBootstrap.mjs';
import { requireBoundStudyRecords } from './gatewayStudyPolicy.mjs';
import { runGatewayRowModeStudy } from './gatewayRowModeStudy.mjs';
import { runGatewaySoakLoad } from './gatewaySoakLoad.mjs';

const docker = args => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 1048576 });
const records = output => output.trim().split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
const report = value => process.stdout.write(`${JSON.stringify(value)}\n`);

/** Local fixture only: no caller-supplied database, provider, mounts or runtime settings. */
export async function runGatewayInferenceSoak(image, revision, profileName = 'regression', study = 'inference') {
  const profile = soakProfile(profileName);
  const comparison = study === 'comparison';
  assert.ok(['inference','history','restores','rowmode','comparison'].includes(study));
  assert.ok(comparison ? ['comparison-off','comparison-on'].includes(profile.name) :
    study === 'inference' ? ['regression','extended'].includes(profile.name) : profile.name === 'extended');
  assert.match(image, /^sha256:[a-f0-9]{64}$/); assert.match(revision, /^[a-f0-9]{40}$/);
  assert.equal(JSON.parse(docker(['image', 'inspect', image]))[0].Config.Labels['org.opencontainers.image.revision'], revision);
  const bind = () => bindStudySources({ revision,image,study,profile:profile.name });
  const binding = bind();
  const spec = createSchemaCheckRunSpec(), suffix = spec.containerName.slice('classifarr-schema-check-'.length);
  const key = 'io.classifarr.inference-soak', label = `${key}=${suffix}`;
  const stores = Object.fromEntries(['archives', 'receipts', 'catalogs', 'socket', 'configuration', 'fixtures','results'].map(kind => [kind, `cf-soak-${kind}-${suffix}`]));
  const names = Object.fromEntries(['stager','archiver', 'verifier', 'catalog-verifier','restore-natural','restore-allocations','row-natural','row-allocations'].map(kind => [kind, `cf-soak-${kind}-${suffix}`]));
  const inspect = name => JSON.parse(docker(['inspect', name]))[0];
  const mount = (kind, target, readonly = false) => ['--mount', `type=volume,source=${stores[kind]},target=${target}${readonly ? ',readonly' : ''}`];
  let outcome, history;
  const remove = name => {
    if (!docker(['ps', '-aq', '--filter', `name=^${name}$`]).trim()) return;
    assert.equal(inspect(name).Config.Labels[key], suffix); docker(['rm', '-f', name]);
    assert.equal(docker(['ps', '-aq', '--filter', `name=^${name}$`]).trim(), '');
  };
  const command = (args, options) => runDockerCheckCommand(args[0] === 'run' && args.includes('--label') ? [
    'run', '--network', 'none', '--memory', '2g', '--memory-swap', '2g', '--cpus', '2', '--pids-limit', '512',
    ...Object.keys(stores).flatMap(kind => mount(kind, kind === 'socket' ? '/var/run/postgresql' : `/${kind}`,kind === 'fixtures')), ...args.slice(1)] : args, options);
  try {
    for (const volume of Object.values(stores)) {
      assert.equal(docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]).trim(), '');
      docker(['volume', 'create', '--label', label, volume]);
    }
    stageStudyInputs({docker,image,binding,name:names.stager,label,stores,inspect,remove});
    assert.deepEqual(bind(),binding);
    await withSchemaCheckContainer({ imageName: image, runSpec: spec, command, action: async () => {
      try {
      const source = spec.containerName;
      const paths = ['/archives', '/receipts', '/catalogs', '/configuration', '/results'];
      docker(['exec', '--user', '0:0', source, 'chown', '1000:1000', ...paths]);
      docker(['exec', '--user', '0:0', source, 'chmod', '700', ...paths]);
      const {fixture,read,execFixture} = createStudyExecution({docker,source,binding,stores,inspect,report});
      const create = (kind, mode) => {
        const name = names[kind], archiver = kind === 'archiver'; remove(name);
        const memory = archiver ? '256m' : '1536m';
        docker(['create', '--name', name, '--label', label, '--network', 'none', '--read-only', '--init', '--no-healthcheck',
          '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', memory, '--memory-swap', memory,
          '--cpus', archiver ? '0.5' : '1', '--pids-limit', archiver ? '32' : '64',
          ...mount('archives', '/archives', !archiver), ...mount('receipts', '/receipts', archiver), ...mount('catalogs', '/catalogs', !archiver),
          ...mount('fixtures', '/fixtures', true), ...mount('results','/results',true), ...(archiver ? [...mount('socket', '/source-socket', true), ...mount('configuration', '/configuration', true)] :
            ['--tmpfs', '/verification:rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev']),
          '--tmpfs', '/tmp:rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev', '-e', 'CLASSIFARR_GATEWAY_FIXTURE=isolated',
          '-e', `CLASSIFARR_SOAK_PROFILE=${profile.name}`,
          '--entrypoint', 'node', image,...studyNodeArgs(binding,'soakWorker.mjs',[kind,mode])]);
        const value = inspect(name); assert.equal(value.Image, image);
        assertStudyCommand(value,binding,'soakWorker.mjs',[kind,mode]); assertStudyVolumes(value,stores);
        assert.equal(value.HostConfig.NetworkMode, 'none'); assert.equal(value.HostConfig.ReadonlyRootfs, true);
        assert.equal(value.Config.User, '1000:1000'); assert.equal(value.HostConfig.MemorySwap, value.HostConfig.Memory);
        assert.equal(Object.keys(value.HostConfig.PortBindings ?? {}).length, 0);
        const allowed = archiver ? [...paths, '/fixtures','/source-socket'] : ['/archives', '/receipts', '/catalogs', '/fixtures','/results'];
        assert.equal(value.Mounts.length, allowed.length);
        assert.ok(value.Mounts.every(item => allowed.includes(item.Destination) && item.RW ===
          (archiver ? ['/archives', '/catalogs'].includes(item.Destination) : item.Destination === '/receipts')));
        if (!archiver) assert.ok(value.Config.Env.every(item => !/PASSWORD=|TOKEN=|CONFIG_FILE=/.test(item)));
        docker(['start', name]); return name;
      };
      const check = name => {
        const value = inspect(name);
        const rows = records(docker(['logs', name]));
        rows.forEach(report);
        assert.equal(value.State.Running, false); assert.equal(value.State.OOMKilled, false); assert.equal(value.State.ExitCode, 0);
        assert.ok(rows.some(row => row.fixture === 'resources')); assert.ok(!rows.some(row => row.fixture === 'worker-error'));
        return requireBoundStudyRecords(rows,binding,'soakWorker.mjs');
      };
      const once = async kind => {
        const name = create(kind, 'once'), deadline = Date.now() + 200000;
        while (inspect(name).State.Running) { assert.ok(Date.now() < deadline, 'soak_worker_deadline'); await delay(500); }
        return check(name);
      };
      report({ stage: 'setup', image, revision, profile: profile.name }); fixture('setup');
      assert.ok((await once('archiver')).some(row => row.state === 'awaiting_verification'));
      assert.ok((await once('verifier')).some(row => row.state === 'verified'));
      const seeded = fixture('wide'); seeded.forEach(report); history = seeded.find(row => row.fixture === 'history-storage');
      if (study === 'rowmode') {
        await runGatewayRowModeStudy({ docker,image,revision,source,label,names,stores,mount,remove,inspect,once,report,binding,execFixture });
        return;
      }
      if (study === 'restores') {
        await runGatewayRestoreMemoryStudy({ docker, image, source, label, names, stores, mount, remove, inspect, once, report,binding,execFixture });
        return;
      }
      if (study === 'history') {
        const output = execFixture('historyQueryProfile.mjs',[],{timeoutMs:75000});
        const rows = requireBoundStudyRecords(records(output.stdout),binding,'historyQueryProfile.mjs'); rows.forEach(report);
        assert.equal(output.ok, true, 'history_query_profile_failed');
        assert.ok(rows.some(row => row.fixture === 'history-query-profile' && row.equivalent && row.productionBudgetPassed));
        return;
      }
      if (comparison) for (const name of Object.values(names)) remove(name);
      const value = await runGatewaySoakLoad({ docker,source,binding,profile,read,create,once,fixture,report,
        check(kind, stop) {
          if (stop) { docker(['stop','--time','20',names[kind]]); return check(names[kind]); }
          const running = inspect(names[kind]).State.Running;
          if (!running) check(names[kind]);
          assert.equal(running,true,'soak_worker_early_exit');
        } });
      if (comparison) outcome = { ...value, history, profile:profile.name };
      } finally { assert.deepEqual(bind(),binding); }
    } });
  } finally {
    finishGatewayStudyCleanup([
      ...Object.values(names).map(name => ({ name, run: () => remove(name) })),
      ...Object.values(stores).map(volume => ({ name: volume, run: () => {
        if (docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]).trim()) {
          assert.equal(JSON.parse(docker(['volume', 'inspect', volume]))[0].Labels[key], suffix); docker(['volume', 'rm', volume]);
        }
        assert.equal(docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]).trim(), '');
      } })),
      { name: 'study-labeled-containers', run: () => assert.equal(docker(['ps', '-aq', '--filter', `label=${label}`]).trim(), '') },
      { name: 'study-labeled-volumes', run: () => assert.equal(docker(['volume', 'ls', '-q', '--filter', `label=${label}`]).trim(), '') },
      { name: 'disposable-data-directory', run: () => assert.equal(existsSync(spec.hostDataPath), false) },
    ]);
    report({ stage: 'owned_cleanup_verified', profile: profile.name });
  }
  assert.equal(existsSync(spec.hostDataPath), false);
  report({ stage: study === 'history' ? 'history_profile_passed_cleanup_verified' :
    study === 'restores' ? 'restore_memory_passed_cleanup_verified' : study === 'rowmode' ? 'row_mode_passed_cleanup_verified' : 'soak_passed_cleanup_verified' });
  if (comparison) return { ...outcome, cleanup:'verified' };
}
