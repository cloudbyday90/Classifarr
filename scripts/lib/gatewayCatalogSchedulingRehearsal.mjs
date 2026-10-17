/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSchemaCheckRunSpec, withSchemaCheckContainer } from '../check-schema-snapshot-container.mjs';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';

export async function runGatewayCatalogSchedulingRehearsal(image, revision) {
  const docker = args => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 1048576 });
  assert.equal(JSON.parse(docker(['image', 'inspect', image]))[0].Config.Labels['org.opencontainers.image.revision'], revision);
  const spec = createSchemaCheckRunSpec(), suffix = spec.containerName.slice('classifarr-schema-check-'.length);
  const stores = Object.fromEntries(['archives', 'receipts', 'catalogs'].map(kind => [kind, `classifarr-schedule-${kind}-${suffix}`]));
  const names = ['classifarr-schedule-verify-', 'classifarr-schedule-catalog-verify-'].map(prefix => `${prefix}${suffix}`);
  const label = `io.classifarr.archive-rehearsal=${suffix}`;
  const command = (args, options) => runDockerCheckCommand(args[0] === 'run' && args.includes('--label') ? [
    'run', '--network', 'none', '--memory', '2g', '--cpus', '2', '--pids-limit', '512',
    ...Object.entries(stores).flatMap(([kind, volume]) => ['--mount', `type=volume,source=${volume},target=/${kind}`]), ...args.slice(1)] : args, options);
  try {
    for (const volume of Object.values(stores)) {
      assert.equal(docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]).trim(), '');
      docker(['volume', 'create', '--label', label, volume]);
    }
    await withSchemaCheckContainer({ imageName: image, runSpec: spec, command, action: async () => {
      const source = spec.containerName;
      docker(['exec', '--user', '0:0', source, 'chown', '1000:1000', '/archives', '/receipts', '/catalogs']);
      docker(['exec', '--user', '0:0', source, 'chmod', '700', '/archives', '/receipts', '/catalogs']);
      docker(['cp', resolve('scripts/fixtures/ollamaGatewayRehearsal/catalogScheduling.mjs'), `${source}:/tmp/catalog-scheduling.mjs`]);
      const fixture = action => docker(['exec', '--user', '1000:1000', '-e', 'CLASSIFARR_GATEWAY_FIXTURE=isolated', source,
        'node', '/tmp/catalog-scheduling.mjs', action]).trim();
      for (const [index, name] of names.entries()) {
        assert.equal(docker(['ps', '-aq', '--filter', `name=^${name}$`]).trim(), '');
        const mounts = index ? Object.entries(stores) : Object.entries(stores).filter(([kind]) => kind !== 'catalogs');
        docker(['create', '--name', name, '--label', label, '--network', 'none', '--user', '1000:1000', '--read-only', '--init', '--no-healthcheck',
          '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '1536m', '--memory-swap', '1536m', '--cpus', '1', '--pids-limit', '64',
          ...mounts.flatMap(([kind, volume]) => ['--mount', `type=volume,source=${volume},target=/${kind}${kind === 'receipts' ? '' : ',readonly'}`]),
          '--tmpfs', '/verification:rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
          '--tmpfs', '/tmp:rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
          '--entrypoint', 'node', image, '/app/src/scripts/runGatewayArchiveVerifier.mjs', '--once', ...(index ? ['--catalog'] : [])]);
        const config = JSON.parse(docker(['inspect', name]))[0];
        assert.equal(config.HostConfig.NetworkMode, 'none'); assert.equal(config.HostConfig.ReadonlyRootfs, true);
        assert.equal(config.Config.User, '1000:1000'); assert.equal(config.Image, image);
        assert.equal(config.Mounts.length, mounts.length);
        assert.ok(config.Mounts.every(m => mounts.some(([kind]) => m.Destination === `/${kind}`) && m.RW === (m.Destination === '/receipts')));
        assert.ok(config.Config.Env.every(value => !/PASSWORD=|TOKEN=|CONFIG_FILE=/.test(value)));
      }
      const verify = index => {
        const output = docker(['start', '-a', names[index]]);
        assert.ok(output.includes('"state":"verified"'), output);
        const state = JSON.parse(docker(['inspect', names[index]]))[0].State;
        assert.equal(state.ExitCode, 0); assert.equal(state.OOMKilled, false);
      };
      const advance = expected => {
        const result = JSON.parse(fixture('worker')); assert.ok(expected.includes(result.state), JSON.stringify(result));
      };
      fixture('setup'); verify(0);
      advance(['awaiting_catalog_verification']);
      advance(['awaiting_catalog_verification']); verify(1);
      fixture('register-only');
      advance(['awaiting_catalog_verification']); verify(1);
      advance(['catalog_unchanged']); process.stdout.write(`${fixture('quiet')}\n`);
      for (let index = 0; index < 2; index++) { fixture('inference'); verify(0); fixture('accept-inference'); }
      fixture('refresh'); verify(1);
      advance(['awaiting_catalog_verification']); verify(1);
      advance(['catalog_unchanged', 'catalog_attempts_exhausted']);
      process.stdout.write(`${fixture('handoff')}\n`);
    } });
  } finally {
    for (const name of names) {
      if (docker(['ps', '-aq', '--filter', `name=^${name}$`]).trim()) {
        assert.equal(JSON.parse(docker(['inspect', name]))[0].Config.Labels['io.classifarr.archive-rehearsal'], suffix);
        docker(['rm', '-f', name]);
      }
      assert.equal(docker(['ps', '-aq', '--filter', `name=^${name}$`]).trim(), '');
    }
    for (const volume of Object.values(stores)) {
      if (docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]).trim()) {
        assert.equal(JSON.parse(docker(['volume', 'inspect', volume]))[0].Labels['io.classifarr.archive-rehearsal'], suffix);
        docker(['volume', 'rm', volume]);
      }
      assert.equal(docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]).trim(), '');
    }
  }
  assert.equal(existsSync(spec.hostDataPath), false);
  process.stdout.write('catalog_scheduling_rehearsal_cleanup_verified\n');
}
