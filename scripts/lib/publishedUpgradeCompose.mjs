/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const upgradeBaseline = Object.freeze({
  release: 'v0.48.4-beta',
  image: 'ghcr.io/cloudbyday90/classifarr@sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f',
  revision: 'a0e417fd714919bb4ca30e20f9cd2380136ca74e',
});
const root = resolve(import.meta.dirname, '../..');
const composeFile = resolve(root, 'docker-compose.published-upgrade-drill.yml');

export function parseUpgradeReceipt(output, prefix) {
  const lines = output.split(/\r?\n/).filter(line => line.startsWith(`${prefix} `));
  if (lines.length !== 1) throw new Error('missing_or_duplicate_upgrade_receipt');
  return JSON.parse(lines[0].slice(prefix.length + 1));
}

/** Fixed disposable target and immutable release; never accepts live configuration. */
export async function runPublishedUpgradeCompose({ run = spawnSync, random = randomBytes,
  sleep = delay, now = Date.now, report = message => process.stdout.write(`${message}\n`),
  saveDiagnostic = (project, diagnostic) => {
    const directory = resolve(root, '.tmp/published-upgrade', project);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(resolve(directory, 'failure.log'), diagnostic, { mode: 0o600 });
  } } = {}) {
  const suffix = random(16).toString('hex');
  if (!/^[a-f0-9]{32}$/.test(suffix)) throw new Error('invalid_upgrade_identity');
  const project = `classifarr-upgrade-drill-${suffix}`;
  const candidateImage = `${project}-candidate`;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^COMPOSE_/i.test(key)));
  Object.assign(env, { COMPOSE_DISABLE_ENV_FILE: '1', CLASSIFARR_UPGRADE_IMAGE: upgradeBaseline.image,
    CLASSIFARR_UPGRADE_CANDIDATE: candidateImage, CLASSIFARR_UPGRADE_MODE: 'normal' });
  const base = ['compose', '--project-name', project, '--file', composeFile, '--project-directory', root];
  let commandDiagnostic = '';
  const invoke = (binary, args, timeout = 120_000, allowFailure = false, input) => {
    try {
      const result = run(binary, args, { cwd: root, env: { ...env }, shell: false, windowsHide: true,
        encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024, input });
      if (!result.error && (allowFailure || result.status === 0) && typeof result.stdout === 'string') return result;
      commandDiagnostic = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.slice(-16_384);
    } catch { /* Never propagate command output or credentials. */ }
    throw new Error(`upgrade_command_failed:${binary}:${args[0]}`);
  };
  const docker = (args, ...options) => invoke('docker', args, ...options);
  const compose = (args, ...options) => docker([...base, ...args], ...options);
  const probe = phase => parseUpgradeReceipt(compose(['exec', '-T', 'app', 'node', 'src/scripts/publishedUpgradeProbe.mjs', phase]).stdout, 'UPGRADE_PROBE');
  const poll = async (check, label, timeout = 60_000) => {
    const deadline = now() + timeout;
    while (now() < deadline) { if (check()) return; await sleep(500); }
    throw new Error(`upgrade_timeout:${label}`);
  };
  const start = mode => {
    env.CLASSIFARR_UPGRADE_MODE = mode;
    compose(['up', '--no-build', '--detach', '--force-recreate', '--wait', '--wait-timeout', '180', 'app'], 240_000);
  };
  const checks = [];
  const passed = name => { checks.push(name); report(`PASS ${name}`); };
  report(`UPGRADE_PROJECT ${project}`);
  invoke('gh', ['attestation', 'verify', `oci://${upgradeBaseline.image}`, '--repo', 'cloudbyday90/Classifarr',
    '--signer-workflow', 'cloudbyday90/Classifarr/.github/workflows/ci.yml', '--source-digest', upgradeBaseline.revision,
    '--deny-self-hosted-runners']);
  passed('published_provenance');
  const label = `label=com.docker.compose.project=${project}`;
  for (const args of [['ps', '-aq', '--filter', label], ['volume', 'ls', '-q', '--filter', label],
    ['network', 'ls', '-q', '--filter', label], ['image', 'ls', '-q', candidateImage]]) {
    if (docker(args).stdout.trim()) throw new Error('upgrade_project_not_empty');
  }
  compose(['config', '--quiet']);
  let failure, result, stage = 'build';
  try {
    report('BUILD candidate');
    compose(['build', 'candidate'], 1_200_000);
    const candidateId = docker(['image', 'inspect', '--format', '{{.Id}}', candidateImage]).stdout.trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(candidateId)) throw new Error('invalid_candidate_image_id');
    stage = 'fresh_install';
    env.CLASSIFARR_UPGRADE_IMAGE = candidateImage;
    start('normal');
    const fresh = probe('fresh');
    passed('fresh_install_and_operational_seeds');
    // Remove only the owned fresh volume before booting the published release.
    // Never seed the upgrade with a candidate-created database.
    compose(['down', '--volumes', '--timeout', '30']);
    if (docker(['volume', 'ls', '-q', '--filter', label]).stdout.trim()) throw new Error('fresh_volume_cleanup_failed');
    stage = 'published_start';
    env.CLASSIFARR_UPGRADE_IMAGE = upgradeBaseline.image;
    docker(['pull', upgradeBaseline.image], 300_000);
    start('normal');
    // Docker cp rejects read-only rootfs even for tmpfs targets. Stream the fixed
    // local fixture into Node; preserve the image and its filesystem protections.
    const seed = readFileSync(resolve(root, 'server/src/scripts/publishedUpgradeFixtures.mjs'), 'utf8');
    const baselineDatabase = parseUpgradeReceipt(compose(['exec', '-T', 'app', 'node', '--input-type=module'],
      120_000, false, `${seed}\nprocess.stdout.write('UPGRADE_SEED ' + JSON.stringify(await seedPublishedFixtures()) + '\\n');\n`).stdout, 'UPGRADE_SEED');
    passed('published_startup_and_export');
    stage = 'candidate_upgrade';
    compose(['stop', '--timeout', '30', 'app']);
    env.CLASSIFARR_UPGRADE_IMAGE = candidateImage;
    start('normal');
    const upgraded = probe('upgraded');
    passed('persisted_volume_migrations');
    stage = 'restore_interrupt';
    compose(['stop', '--timeout', '30', 'app']);
    start('restore');
    compose(['exec', '--detach', 'app', 'node', 'src/scripts/publishedUpgradeProbe.mjs', 'interrupt']);
    await poll(() => compose(['exec', '-T', 'app', 'test', '-f', '/app/data/upgrade-drill/ready-to-kill'], 10_000, true).status === 0,
      'restore_lock_wait', 30_000);
    compose(['kill', '--signal', 'SIGKILL', 'app']);
    passed('container_killed_during_restore');
    stage = 'normal_rejection';
    env.CLASSIFARR_UPGRADE_MODE = 'normal';
    compose(['up', '--no-build', '--detach', '--force-recreate', 'app']);
    const id = compose(['ps', '--all', '--quiet', 'app']).stdout.trim();
    if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('invalid_drill_container');
    await poll(() => docker(['inspect', '--format', '{{.State.Status}}', id]).stdout.trim() === 'exited', 'normal_exit');
    if (docker(['inspect', '--format', '{{.State.ExitCode}}', id]).stdout.trim() !== '1' ||
      !compose(['logs', '--no-color', 'app']).stdout.includes('Restore verification is incomplete')) {
      throw new Error('unexpected_normal_rejection');
    }
    passed('unverified_normal_startup_rejected');
    stage = 'explicit_retry';
    start('restore');
    const recovery = probe('retry');
    passed('rollback_and_explicit_verified_retry');
    stage = 'recovery_handoff';
    const handoff = probe('handoff');
    passed('movie_tv_recovery_to_learning');
    stage = 'verified_restart';
    compose(['stop', '--timeout', '30', 'app']);
    start('normal');
    probe('normal');
    passed('verified_normal_restart_and_profiles');
    result = { status: 'passed', baseline: upgradeBaseline, candidateImageId: candidateId, fresh,
      database: { baseline: baselineDatabase, candidate: upgraded.candidate }, recovery, handoff, checks };
  } catch (error) {
    // All runner errors are fixed classifications; probe bodies and logs stay out of receipts.
    if (/^(upgrade_|missing_or_duplicate_upgrade_receipt)/.test(error.message)) report(error.message);
    try {
      const logs = compose(['logs', '--no-color', '--tail', '100', 'app'], 30_000, true);
      saveDiagnostic(project, `${stage}\n${commandDiagnostic}\n${logs.stdout}\n${logs.stderr ?? ''}`.slice(-32_768));
      report(`UPGRADE_DIAGNOSTIC .tmp/published-upgrade/${project}/failure.log`);
    } catch { report('UPGRADE_DIAGNOSTIC unavailable'); }
    failure = new Error(`published_upgrade_failed:${stage}`);
  }
  finally {
    try {
      compose(['--profile', 'tools', 'down', '--volumes', '--timeout', '10']);
      // Only the freshly owned random image tag, never the published baseline or live tag.
      docker(['image', 'rm', candidateImage], 30_000, true);
      if (docker(['image', 'ls', '-q', candidateImage]).stdout.trim()) throw new Error('candidate_cleanup_failed');
      for (const args of [['ps', '-aq', '--filter', label], ['volume', 'ls', '-q', '--filter', label], ['network', 'ls', '-q', '--filter', label]]) {
        if (docker(args).stdout.trim()) throw new Error('resource_cleanup_failed');
      }
    } catch { throw new Error(`published_upgrade_cleanup_failed:${project}${failure ? `:${stage}` : ''}`); }
  }
  if (failure) throw failure;
  return { ...result, cleanup: 'passed' };
}
