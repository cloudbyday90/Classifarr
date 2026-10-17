/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export function runGatewayCatalogRetentionRehearsal({ docker, image, source, archives, receipts, catalogs, label, suffix }) {
  const script = resolve('scripts/fixtures/ollamaGatewayRehearsal/catalogRetention.mjs');
  docker(['cp', script, `${source}:/tmp/catalog-retention.mjs`]);
  const fixture = (...args) => docker(['exec', '--user', '1000:1000', '-e', 'CLASSIFARR_GATEWAY_FIXTURE=isolated',
    source, 'node', '/tmp/catalog-retention.mjs', ...args]).trim();
  const name = `classifarr-catalog-retention-${suffix}`;
  fixture('setup');
  process.stdout.write(`${fixture('capacity')}\n`);
  for (let cycle = 0; cycle < 3; cycle++) {
    const id = fixture('capture'); assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    assert.equal(docker(['ps', '-aq', '--filter', `name=^${name}$`]).trim(), '');
    try {
      docker(['create', '--name', name, '--label', label, '--network', 'none', '--user', '1000:1000', '--read-only', '--init', '--no-healthcheck',
        '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '1536m', '--memory-swap', '1536m', '--cpus', '1', '--pids-limit', '64',
        '--mount', `type=volume,source=${archives},target=/archives,readonly`, '--mount', `type=volume,source=${receipts},target=/receipts,readonly`,
        '--mount', `type=volume,source=${catalogs},target=/catalogs,readonly`, '--mount', `type=bind,source=${script},target=/catalog-retention.mjs,readonly`,
        '--tmpfs', '/verification:rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
        '--tmpfs', '/tmp:rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
        '-e', 'CLASSIFARR_GATEWAY_FIXTURE=isolated', '--entrypoint', 'node', image, '/catalog-retention.mjs', 'verify', id]);
      const config = JSON.parse(docker(['inspect', name]))[0];
      assert.equal(config.HostConfig.NetworkMode, 'none'); assert.equal(config.HostConfig.ReadonlyRootfs, true);
      assert.equal(config.Config.User, '1000:1000'); assert.equal(config.Image, image);
      assert.equal(config.Mounts.length, 4); assert.ok(config.Mounts.every(m => !m.RW));
      assert.ok(config.Config.Env.every(value => !/PASSWORD=|TOKEN=|CONFIG_FILE=/.test(value)));
      const receipt = JSON.parse(docker(['start', '-a', name]));
      const stopped = JSON.parse(docker(['inspect', name]))[0];
      assert.equal(stopped.State.ExitCode, 0); assert.equal(stopped.State.OOMKilled, false);
      assert.equal(receipt.archiveId, id);
      process.stdout.write(`${fixture('accept', JSON.stringify(receipt))}\n`);
    } finally {
      if (docker(['ps', '-aq', '--filter', `name=^${name}$`]).trim()) {
        assert.equal(JSON.parse(docker(['inspect', name]))[0].Config.Labels['io.classifarr.archive-rehearsal'], suffix);
        docker(['rm', '-f', name]);
      }
      assert.equal(docker(['ps', '-aq', '--filter', `name=^${name}$`]).trim(), '');
    }
  }
  process.stdout.write(`${fixture('faults')}\n${fixture('resume')}\n`);
}
