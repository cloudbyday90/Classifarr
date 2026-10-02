/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { runPublishedUpgradeCompose, parseUpgradeReceipt, upgradeBaseline } from '../../../../scripts/lib/publishedUpgradeCompose.mjs';
import { assertUpgradeDrillEnvironment } from '../../scripts/publishedUpgradeFixtures.mjs';
import { SCHEDULED_INSTALLATION_EXPECTED, SCHEDULED_CRASH_BOUNDARY, SCHEDULED_CRASH_RECOVERY } from '../../../../scripts/lib/scheduledInstallationContract.mjs';
import { metrics, pressure, backlog } from '../fixtures/installationBudget.mjs';
import { BACKLOG_BOUNDARY } from '../../scripts/installationBacklogContract.mjs';

const random = size => Buffer.alloc(size, 1);
const report = () => {};
const composeOperation = args => {
  let index = 7;
  while (args[index] === '--file') index += 2;
  return args.slice(index);
};
const operations = run => run.mock.calls.filter(([, args]) => args[0] === 'compose').map(([, args]) => composeOperation(args));
function mockRunner(override = () => undefined) {
  return jest.fn((command, args, options) => {
    const replacement = override(command, args, options);
    if (replacement) return replacement;
    if (args.at(-1)?.endsWith('unfinished-backfill-failed')) return { status: 1, stdout: '' };
    let stdout = '';
    if (args[0] === 'image' && args[1] === 'inspect') stdout = `sha256:${'a'.repeat(64)}`;
    if (args[0] === 'inspect') stdout = args.includes('{{.State.ExitCode}}') ? '1' : 'exited';
    if (args.includes('{{.State.ExitCode}} {{.State.OOMKilled}}')) stdout = '137 false';
    if (args[0] === 'compose') {
      const op = composeOperation(args);
      if (op.join(' ') === 'config --format json') stdout = JSON.stringify({ services: { app: {
        image: options.env.CLASSIFARR_UPGRADE_IMAGE, environment: { FIXED: '1' }, volumes: ['app-data:/app/data'] } } });
      if (op[0] === 'logs') stdout = 'Restore verification is incomplete';
      if (op[0] === 'ps') stdout = 'b'.repeat(64);
      if (op.includes('--input-type=module') && op[0] === 'exec') stdout = 'UPGRADE_SEED {"version":"180000","migrations":20}\n';
      if (op.includes('src/scripts/publishedUpgradeProbe.mjs')) stdout = 'UPGRADE_PROBE {"candidate":{"version":"180000","migrations":21}}\n';
      if (op.at(-1) === 'scheduled') stdout = `UPGRADE_PROBE ${JSON.stringify(SCHEDULED_INSTALLATION_EXPECTED)}\n`;
      if (op.at(-1) === 'scheduled-crash-ready') stdout = `UPGRADE_PROBE ${JSON.stringify(SCHEDULED_CRASH_BOUNDARY)}\n`;
      if (op.at(-1) === 'scheduled-crash-resume') stdout = `UPGRADE_PROBE ${JSON.stringify(SCHEDULED_CRASH_RECOVERY)}\n`;
      if (op.at(-1) === 'scheduled-backlog-ready') stdout = `UPGRADE_PROBE ${JSON.stringify(BACKLOG_BOUNDARY)}\n`;
      if (op.at(-1) === 'scheduled-backlog-resume') stdout = `UPGRADE_PROBE ${JSON.stringify(backlog())}\n`;
      if (op.at(-1) === 'budget-prepare') stdout = 'UPGRADE_PROBE {"maxConnections":32,"restartRequired":true}\n';
      if (op.at(-1) === 'budget-pressure') stdout = `UPGRADE_PROBE ${JSON.stringify(pressure())}\n`;
      if (op.at(-1) === 'budget-snapshot') stdout = `UPGRADE_PROBE ${JSON.stringify(metrics())}\n`;
    }
    if (args[0] === 'inspect' && args.some(arg => arg.includes('.HostConfig.NanoCpus'))) {
      stdout = JSON.stringify({ nanoCpus: 2e9, pids: 128, memoryBytes: 2 * 1024 ** 3, cpuQuota: 0 });
    }
    return { status: 0, stdout };
  });
}
const runWith = (run, options = {}) => runPublishedUpgradeCompose({ run, random, report, saveDiagnostic: () => {}, ...options });

test.each([true, false])('opt-in budget reuses fixed limits and crash protocol, freshOnly=%s', async freshOnly => {
  const run = mockRunner();
  const result = await runWith(run, { freshOnly, resourceBudget: true });
  expect(result.cleanup).toBe('passed');
  expect(Object.keys(result.resourceBudget)).toEqual(freshOnly ? ['fresh'] : ['fresh', 'upgrade']);
  const ops = operations(run);
  expect(ops.filter(args => args.at(-1) === 'scheduled-crash-budget-arm')).toHaveLength(freshOnly ? 1 : 2);
  expect(ops.filter(args => args.at(-1) === 'scheduled-backlog-arm')).toHaveLength(freshOnly ? 1 : 2);
  expect(ops.some(args => args.at(-1) === 'scheduled')).toBe(false);
  const build = run.mock.calls.find(([, args]) => args.includes('build'));
  expect(build[1][8]).toMatch(/docker-compose.resource-study-budget.yml$/);
  expect(build[2].env).toMatchObject({ CLASSIFARR_RESOURCE_STUDY_CPUS: '2', CLASSIFARR_RESOURCE_STUDY_PIDS: '128',
    CLASSIFARR_RESOURCE_STUDY_MEMORY: '2g', CLASSIFARR_UPGRADE_BUDGET: 'bounded' });
  expect(run.mock.calls.filter(([, args]) => args.includes('build'))).toHaveLength(1);
  expect(run.mock.calls.some(([cmd]) => cmd === 'gh')).toBe(!freshOnly);
});

test('missing budget evidence fails before the crash and owned resources are still cleaned', async () => {
  const run = mockRunner((_cmd, args) => args.at(-1) === 'budget-pressure' ? { status: 0, stdout: 'UPGRADE_PROBE {}\n' } : undefined);
  await expect(runWith(run, { freshOnly: true, resourceBudget: true })).rejects.toThrow('published_upgrade_failed:fresh_scheduler');
  expect(operations(run).some(args => args[0] === 'kill')).toBe(false);
  expect(operations(run).at(-1)).toContain('down');
});

test('pins provenance, preserves real entrypoints, checks recovery and cleans only owned resources', async () => {
  const run = mockRunner();
  const result = await runWith(run);
  expect(result).toMatchObject({ status: 'passed', cleanup: 'passed', baseline: upgradeBaseline });
  expect(result.checks).toHaveLength(12);
  expect(run.mock.calls[0][0]).toBe('gh');
  expect(run.mock.calls[0][1]).toEqual(['attestation', 'verify', `oci://${upgradeBaseline.image}`, '--repo', 'cloudbyday90/Classifarr',
    '--signer-workflow', 'cloudbyday90/Classifarr/.github/workflows/ci.yml', '--source-digest', upgradeBaseline.revision,
    '--deny-self-hosted-runners', '--hostname', 'github.com']);
  const ops = operations(run);
  expect(ops.some(args => args.join(' ') === 'kill --signal SIGKILL app')).toBe(true);
  expect(ops.at(-1)).toEqual(['--profile', 'tools', 'down', '--volumes', '--timeout', '10']);
  const starts = run.mock.calls.filter(([, args]) => args[7] === 'up');
  expect(starts.map(([, , opts]) => opts.env.CLASSIFARR_UPGRADE_MODE)).toEqual(['normal', 'normal', 'normal', 'normal', 'restore', 'normal', 'restore', 'normal']);
  expect(starts[0][2].env.CLASSIFARR_UPGRADE_IMAGE).toMatch(/-candidate$/);
  expect(starts[2][2].env.CLASSIFARR_UPGRADE_IMAGE).toBe(upgradeBaseline.image);
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

test('fresh-only scope never claims or accesses a published baseline', async () => {
  const run = mockRunner();
  const result = await runWith(run, { freshOnly: true });
  expect(result).toMatchObject({ scope: 'fresh-only', baseline: null, cleanup: 'passed' });
  expect(result.checks).toEqual(['fresh_install_and_operational_seeds', 'fresh_startup_scheduler_progress', 'fresh_backfill_crash_recovery']);
  expect(run.mock.calls.some(([cmd, args]) => cmd === 'gh' || args[0] === 'pull')).toBe(false);
  expect(operations(run).filter(args => args.includes('src/scripts/publishedUpgradeProbe.mjs')).map(args => args.at(-1)))
    .toEqual(['fresh', 'scheduled-crash-arm', 'scheduled-crash-ready', 'scheduled-crash-resume']);
});

test.each(['unraid', 'custom'])('preserves frozen %s deployment and uses runtime identity for every probe', async profile => {
  const run = mockRunner();
  const result = await runWith(run, { deploymentProfile: profile });
  expect(result.deployment).toEqual({ profile, unchanged: true, configurationDigest: expect.stringMatching(/^[a-f0-9]{64}$/) });
  const calls = run.mock.calls.filter(([, args]) => args[0] === 'compose');
  for (const [, args] of calls) expect(args[8]).toMatch(new RegExp(`published-upgrade[\\\\/]${profile}.yml$`));
  for (const op of operations(run).filter(args => args[0] === 'exec')) {
    expect(op[op.indexOf('--user') + 1]).toBe(profile === 'unraid' ? '99:100' : '2345:2345');
  }
});

test('changed deployment refuses upgrade before candidate can touch the baseline database', async () => {
  let configs = 0;
  const run = mockRunner((_cmd, args) => {
    if (args[0] === 'compose' && composeOperation(args).join(' ') === 'config --format json' && ++configs === 2) {
      return { status: 0, stdout: JSON.stringify({ services: { app: { image: 'candidate', environment: { FIXED: 'changed' }, volumes: ['app-data:/app/data'] } } }) };
    }
    return undefined;
  });
  await expect(runWith(run)).rejects.toThrow('published_upgrade_failed:candidate_upgrade');
  expect(operations(run).some(args => args.at(-1) === 'upgraded')).toBe(false);
  expect(operations(run).at(-1)).toContain('down');
});

test('invalid deployment refuses all commands', async () => {
  const run = mockRunner();
  await expect(runWith(run, { deploymentProfile: 'live' })).rejects.toThrow('invalid_upgrade_deployment');
  expect(run).not.toHaveBeenCalled();
});

test('borrowed immutable candidate is inspected and run without rebuilding or deleting it', async () => {
  const candidateImageId = `sha256:${'a'.repeat(64)}`;
  const run = mockRunner();
  expect((await runWith(run, { candidateImageId })).candidateImageId).toBe(candidateImageId);
  expect(run.mock.calls.some(([, args]) => args.includes('build') || args[1] === 'rm')).toBe(false);
  const starts = run.mock.calls.filter(([, args]) => args[7] === 'up');
  expect(starts[0][2].env.CLASSIFARR_UPGRADE_IMAGE).toBe(candidateImageId);
  expect(starts[3][2].env.CLASSIFARR_UPGRADE_IMAGE).toBe(candidateImageId);
});

test.each(['classifarr:latest', '', {}, `sha256:${'f'.repeat(63)}`])('rejects invalid borrowed image %j before commands', async candidateImageId => {
  const run = mockRunner();
  await expect(runWith(run, { candidateImageId })).rejects.toThrow('invalid_upgrade_candidate');
  expect(run).not.toHaveBeenCalled();
});

test('borrowed image mismatch cleans project but never deletes the borrowed image', async () => {
  const run = mockRunner();
  await expect(runWith(run, { candidateImageId: `sha256:${'b'.repeat(64)}` })).rejects.toThrow('published_upgrade_failed:build');
  expect(operations(run).some(args => args[0] === 'up')).toBe(false);
  expect(run.mock.calls.some(([, args]) => args[1] === 'rm')).toBe(false);
  expect(operations(run).at(-1)).toContain('down');
});

test('command failure identifies bounded phase and timeout without raw output', async () => {
  const run = mockRunner((_cmd, args) => args.at(-1) === 'scheduled-backlog-resume'
    ? { status: null, stdout: 'private-value', stderr: 'private-value', error: { code: 'ETIMEDOUT' } } : undefined);
  const diagnostic = jest.fn();
  await expect(runWith(run, { resourceBudget: true, report: diagnostic })).rejects.toThrow('published_upgrade_failed:');
  const output = diagnostic.mock.calls.map(([line]) => line).join('\n');
  expect(output).toContain('"probe":"scheduled-backlog-resume","exitCode":null,"timedOut":true');
  expect(output).not.toContain('private-value');
});

test('detached probe evidence is retained in the sanitized failure file', async () => {
  const evidence = { category: 'assertion', code: null, stage: null, locations: ['installationBacklogCheckpoint.mjs:42:12'] };
  const run = mockRunner((_cmd, args) => args.at(-1)?.endsWith('unfinished-backfill-failed') ? { status: 0, stdout: '' }
    : args.at(-1) === 'scheduled-backlog-failure' ? { status: 0, stdout: `UPGRADE_PROBE ${JSON.stringify({ ...evidence, secret: 'private' })}` } : undefined);
  const saveDiagnostic = jest.fn();
  await expect(runWith(run, { resourceBudget: true, saveDiagnostic })).rejects.toThrow('published_upgrade_failed:');
  const saved = saveDiagnostic.mock.calls[0][1];
  expect(saved).toContain(`UPGRADE_BACKLOG_FAILURE ${JSON.stringify(evidence)}`);
  expect(saved).not.toContain('private');
});

test.each([['fresh_scheduler', 'scheduled-crash-ready'], ['fresh_backfill_crash', 'scheduled-crash-resume'],
  ['upgrade_scheduler', 'scheduled']])('a stalled %s fails closed and still cleans resources', async (stage, phase) => {
  const run = mockRunner((_cmd, args) => args.at(-1) === phase
    ? { status: 1, stdout: 'private-value' } : undefined);
  await expect(runWith(run)).rejects.toThrow(`published_upgrade_failed:${stage}`);
  expect(operations(run).at(-1)).toContain('down');
});

test('fresh-only scope still rejects malformed scheduler evidence', async () => {
  const run = mockRunner((_cmd, args) => args.at(-1) === 'scheduled-crash-ready' ? { status: 0, stdout: 'UPGRADE_PROBE {}\n' } : undefined);
  await expect(runWith(run, { freshOnly: true })).rejects.toThrow('published_upgrade_failed:fresh_scheduler');
  expect(operations(run).at(-1)).toContain('down');
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

test('failure diagnostics include safe stderr evidence before cleanup without retaining raw output', async () => {
  const run = mockRunner((_cmd, args) => {
    if (args[7] === 'up') return { status: 1, stdout: 'password=secret' };
    if (args[0] === 'inspect') return { status: 0, stdout: JSON.stringify({
      status: 'exited', exitCode: 1, oomKilled: false, errorPresent: false, health: 'unhealthy',
    }) };
    if (args[0] === 'logs') return { status: 0, stdout: 'secret',
      stderr: 'Failed to start server: Restore verification is incomplete.\n::error::secret' };
  });
  const saveDiagnostic = jest.fn();
  const reportDiagnostic = jest.fn();
  await expect(runWith(run, { saveDiagnostic, report: reportDiagnostic })).rejects.toThrow('published_upgrade_failed:fresh_install');
  expect(saveDiagnostic.mock.calls[0][1]).toContain('restore_verification_incomplete (stderr)');
  expect(JSON.stringify(saveDiagnostic.mock.calls) + JSON.stringify(reportDiagnostic.mock.calls)).not.toMatch(/secret|::error::/);
  expect(run.mock.calls.findIndex(([, args]) => args[0] === 'logs'))
    .toBeLessThan(run.mock.calls.findIndex(([, args]) => args.includes('down')));
});
test('does not call arbitrary normal startup failure a recovery success', async () => {
  const run = mockRunner((_cmd, args) => args[7] === 'logs' ? { status: 0, stdout: 'unrelated crash' } : undefined);
  await expect(runWith(run)).rejects.toThrow('published_upgrade_failed:normal_rejection');
});

test('cannot start the published release with the fresh-install volume left over', async () => {
  let volumeChecks = 0;
  const run = mockRunner((_cmd, args) => args[0] === 'volume' && ++volumeChecks === 2
    ? { status: 0, stdout: 'fresh-volume' } : undefined);
  await expect(runWith(run)).rejects.toThrow('published_upgrade_failed:fresh_backfill_crash');
  expect(run.mock.calls.some(([, args]) => args[0] === 'pull')).toBe(false);
});
test('requires actual lock-wait marker before killing the container', async () => {
  let time = 0;
  const run = mockRunner((_cmd, args) => args.at(-1) === '/app/data/upgrade-drill/ready-to-kill' ? { status: 1, stdout: '' } : undefined);
  await expect(runWith(run, { now: () => time, sleep: async () => { time += 10_000; } })).rejects.toThrow('published_upgrade_failed:restore_interrupt');
  // The earlier, independently verified fresh-install crash already happened.
  expect(operations(run).filter(args => args[0] === 'kill')).toHaveLength(1);
});
test('bounds normal-rejection polling and cleans up on timeout', async () => {
  let time = 0;
  let normalStarted = false;
  const run = mockRunner((_cmd, args) => {
    if (args[7] === 'up' && !args.includes('--wait')) normalStarted = true;
    return normalStarted && args[0] === 'inspect' ? { status: 0, stdout: 'running' } : undefined;
  });
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
