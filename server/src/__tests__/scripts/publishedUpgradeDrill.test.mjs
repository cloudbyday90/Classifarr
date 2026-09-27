/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { runPublishedUpgradeCompose, parseUpgradeReceipt, upgradeBaseline } from '../../../../scripts/lib/publishedUpgradeCompose.mjs';
import { assertUpgradeDrillEnvironment } from '../../scripts/publishedUpgradeFixtures.mjs';

const random = size => Buffer.alloc(size, 1);
const report = () => {};
const operations = run => run.mock.calls.filter(([, args]) => args[0] === 'compose').map(([, args]) => args.slice(7));
function mockRunner(override = () => undefined) {
  return jest.fn((command, args, options) => {
    const replacement = override(command, args, options);
    if (replacement) return replacement;
    let stdout = '';
    if (args[0] === 'image' && args[1] === 'inspect') stdout = `sha256:${'a'.repeat(64)}`;
    if (args[0] === 'inspect') stdout = args.includes('{{.State.ExitCode}}') ? '1' : 'exited';
    if (args[0] === 'compose') {
      const op = args.slice(7);
      if (op[0] === 'logs') stdout = 'Restore verification is incomplete';
      if (op[0] === 'ps') stdout = 'b'.repeat(64);
      if (op.includes('--input-type=module') && op[0] === 'exec') stdout = 'UPGRADE_SEED {"version":"180000","migrations":20}\n';
      if (op.includes('src/scripts/publishedUpgradeProbe.mjs')) stdout = 'UPGRADE_PROBE {"candidate":{"version":"180000","migrations":21}}\n';
    }
    return { status: 0, stdout };
  });
}
const runWith = (run, options = {}) => runPublishedUpgradeCompose({ run, random, report, saveDiagnostic: () => {}, ...options });

test('pins provenance, preserves real entrypoints, checks recovery and cleans only owned resources', async () => {
  const run = mockRunner();
  const result = await runWith(run);
  expect(result).toMatchObject({ status: 'passed', cleanup: 'passed', baseline: upgradeBaseline });
  expect(result.checks).toHaveLength(9);
  expect(run.mock.calls[0][0]).toBe('gh');
  expect(run.mock.calls[0][1]).toEqual(['attestation', 'verify', `oci://${upgradeBaseline.image}`, '--repo', 'cloudbyday90/Classifarr',
    '--signer-workflow', 'cloudbyday90/Classifarr/.github/workflows/ci.yml', '--source-digest', upgradeBaseline.revision, '--deny-self-hosted-runners']);
  const ops = operations(run);
  expect(ops.some(args => args.join(' ') === 'kill --signal SIGKILL app')).toBe(true);
  expect(ops.at(-1)).toEqual(['--profile', 'tools', 'down', '--volumes', '--timeout', '10']);
  const starts = run.mock.calls.filter(([, args]) => args[7] === 'up');
  expect(starts.map(([, , opts]) => opts.env.CLASSIFARR_UPGRADE_MODE)).toEqual(['normal', 'normal', 'normal', 'restore', 'normal', 'restore', 'normal']);
  expect(starts[0][2].env.CLASSIFARR_UPGRADE_IMAGE).toMatch(/-candidate$/);
  expect(starts[1][2].env.CLASSIFARR_UPGRADE_IMAGE).toBe(upgradeBaseline.image);
  expect(ops.findIndex(args => args[0] === 'down')).toBeLessThan(ops.findIndex(args => args.includes('--input-type=module')));
  for (const [cmd, args, options] of run.mock.calls) {
    expect(['docker', 'gh']).toContain(cmd);
    expect(options.shell).toBe(false);
    expect(options.windowsHide).toBe(true);
    expect(options.timeout).toBeGreaterThan(0);
    expect(options.maxBuffer).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(options.env.COMPOSE_DISABLE_ENV_FILE).toBe('1');
    expect(args).not.toContain('prune');
    if (args[0] === 'compose') expect(args[2]).toMatch(/^classifarr-upgrade-drill-[a-f0-9]{32}$/);
  }
});

test.each(['gh', 'inventory', 'config'])('fails closed before ownership for %s failure', async stage => {
  const run = mockRunner((cmd, args) => (stage === 'gh' && cmd === 'gh') ||
    (stage === 'inventory' && args[0] === 'ps') || (stage === 'config' && args[7] === 'config') ? { status: 1, stdout: '' } : undefined);
  await expect(runWith(run)).rejects.toThrow('upgrade_command_failed');
  expect(operations(run).some(args => args.includes('down'))).toBe(false);
});
test.each(['ps', 'volume', 'network', 'image'])('does not delete a colliding %s resource', async type => {
  const run = mockRunner((_cmd, args) => args[0] === type ? { status: 0, stdout: 'existing' } : undefined);
  await expect(runWith(run)).rejects.toThrow('upgrade_project_not_empty');
  expect(operations(run)).toHaveLength(0);
});
test.each(['build', 'pull', 'kill', 'up'])('cleans after %s failure and retains phase', async operation => {
  const run = mockRunner((_cmd, args) => (args[7] === operation || args[0] === operation) ? { status: 1, stdout: 'private-payload' } : undefined);
  await expect(runWith(run)).rejects.toThrow('published_upgrade_failed:');
  expect(operations(run).at(-1)).toContain('down');
});
test('cleanup failure takes precedence without losing scenario phase', async () => {
  const run = mockRunner((_cmd, args) => args[7] === 'build' || args.includes('down') ? { status: 1, stdout: '' } : undefined);
  await expect(runWith(run)).rejects.toThrow(/published_upgrade_cleanup_failed:.*:build/);
});
test('does not call arbitrary normal startup failure a recovery success', async () => {
  const run = mockRunner((_cmd, args) => args[7] === 'logs' ? { status: 0, stdout: 'unrelated crash' } : undefined);
  await expect(runWith(run)).rejects.toThrow('published_upgrade_failed:normal_rejection');
});

test('cannot start the published release with the fresh-install volume left over', async () => {
  let volumeChecks = 0;
  const run = mockRunner((_cmd, args) => args[0] === 'volume' && ++volumeChecks === 2
    ? { status: 0, stdout: 'fresh-volume' } : undefined);
  await expect(runWith(run)).rejects.toThrow('published_upgrade_failed:fresh_install');
  expect(run.mock.calls.some(([, args]) => args[0] === 'pull')).toBe(false);
});
test('requires actual lock-wait marker before killing the container', async () => {
  let time = 0;
  const run = mockRunner((_cmd, args) => args.includes('test') ? { status: 1, stdout: '' } : undefined);
  await expect(runWith(run, { now: () => time, sleep: async () => { time += 10_000; } })).rejects.toThrow('published_upgrade_failed:restore_interrupt');
  expect(operations(run).some(args => args[0] === 'kill')).toBe(false);
});
test('bounds normal-rejection polling and cleans up on timeout', async () => {
  let time = 0;
  const run = mockRunner((_cmd, args) => args[0] === 'inspect' ? { status: 0, stdout: 'running' } : undefined);
  await expect(runWith(run, { now: () => time, sleep: async () => { time += 30_000; } })).rejects.toThrow('published_upgrade_failed:normal_rejection');
});
test('rejects bad project entropy without running commands', async () => {
  const run = mockRunner();
  await expect(runWith(run, { random: () => Buffer.alloc(0) })).rejects.toThrow('invalid_upgrade_identity');
  expect(run).not.toHaveBeenCalled();
});
test.each(['', 'UPGRADE_PROBE {}\nUPGRADE_PROBE {}', 'UPGRADE_PROBE invalid'])('rejects invalid evidence %j', output => {
  expect(() => parseUpgradeReceipt(output, 'UPGRADE_PROBE')).toThrow();
});
test('isolates Compose and uses unmodified image entrypoints', () => {
  const document = load(readFileSync(new URL('../../../../docker-compose.published-upgrade-drill.yml', import.meta.url), 'utf8'));
  expect(document.networks).toEqual({ default: { internal: true } });
  expect(document.volumes).toEqual({ 'app-data': null });
  expect(document.services.candidate.profiles).toEqual(['tools']);
  expect(document.services.app.volumes).toEqual(['app-data:/app/data']);
  expect(document.services.app.user).toBe('1000:1000');
  expect(document.services.app.cap_drop).toEqual(['ALL']);
  expect(document.services.app.read_only).toBe(true);
  for (const service of Object.values(document.services)) {
    for (const key of ['ports', 'network_mode', 'env_file', 'privileged', 'entrypoint', 'command', 'container_name']) expect(service[key]).toBeUndefined();
  }
});
test('fixture refuses absent or altered environment before database access', () => {
  const env = { CLASSIFARR_UPGRADE_DRILL: 'isolated-compose-v1', POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432',
    POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr', BACKUP_DIR: '/app/data/backups', MIGRATIONS_DIR: '/app/database/migrations' };
  expect(() => assertUpgradeDrillEnvironment(env)).not.toThrow();
  for (const key of Object.keys(env)) expect(() => assertUpgradeDrillEnvironment({ ...env, [key]: 'live' })).toThrow();
});
