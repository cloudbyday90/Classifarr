/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseUpgradeReceipt } from './publishedUpgradeCompose.mjs';

const root = resolve(import.meta.dirname, '../..');

/** Reuses the isolated installation topology, never the user's compose project. */
export async function runResourceStudyCompose({ smoke = false, run = spawnSync, random = randomBytes,
  report = message => process.stdout.write(`${message}\n`), save = (project, result) => {
    const directory = resolve(root, '.tmp/resource-study', project);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(resolve(directory, 'result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  } } = {}) {
  if (typeof smoke !== 'boolean') throw new TypeError('invalid_study_scope');
  const suffix = random(16).toString('hex');
  if (!/^[a-f0-9]{32}$/.test(suffix)) throw new Error('invalid_study_identity');
  const project = `classifarr-resource-study-${suffix}`, image = `${project}-candidate`;
  const label = `label=com.docker.compose.project=${project}`;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^COMPOSE_/i.test(key)));
  Object.assign(env, { COMPOSE_DISABLE_ENV_FILE: '1', CLASSIFARR_UPGRADE_IMAGE: image,
    CLASSIFARR_UPGRADE_CANDIDATE: image, CLASSIFARR_UPGRADE_MODE: 'normal' });
  const base = ['compose', '--project-name', project, '--file', resolve(root, 'docker-compose.published-upgrade-drill.yml'),
    '--project-directory', root];
  const docker = (args, timeout = 120000, allowFailure = false) => {
    let result;
    try { result = run('docker', args, { cwd: root, env: { ...env }, shell: false, windowsHide: true,
      encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 }); } catch { /* Fixed error only. */ }
    if (!result || result.error || (!allowFailure && result.status !== 0) || typeof result.stdout !== 'string') {
      // The study CLI emits fixed classifications and source locations, not payloads.
      if (args.includes('src/scripts/runResourceStudy.mjs')) {
        const diagnostic = String(result?.stderr ?? '').split(/\r?\n/).filter(line =>
          /^resource_study_failed (assertion|execution)$/.test(line) ||
          /^\s+at [\w. ]*\(?file:\/\/\/app\/src\/[\w/.-]+\.mjs:\d+:\d+\)?$/.test(line)).slice(0, 9);
        diagnostic.forEach(report);
      }
      throw new Error('resource_study_command_failed');
    }
    return result;
  };
  const compose = (args, ...options) => docker([...base, ...args], ...options);
  const inventory = [['ps', '-aq', '--filter', label], ['volume', 'ls', '-q', '--filter', label],
    ['network', 'ls', '-q', '--filter', label], ['image', 'ls', '-q', image]];
  for (const args of inventory) if (docker(args).stdout.trim()) throw new Error('resource_study_project_not_empty');
  compose(['config', '--quiet']);
  const probe = mode => parseUpgradeReceipt(compose(['exec', '-T', '-e', 'CLASSIFARR_RESOURCE_STUDY=isolated-synthetic-v1',
    'app', 'node', 'src/scripts/runResourceStudy.mjs', mode], mode === 'soak' ? 2100000 : 360000).stdout, 'RESOURCE_STUDY');
  const start = () => compose(['up', '--no-build', '--detach', '--force-recreate', '--wait', '--wait-timeout', '180', 'app'], 240000);
  let result, failure;
  report(`RESOURCE_STUDY_PROJECT ${project}`);
  try {
    compose(['build', 'candidate'], 1200000);
    const imageId = docker(['image', 'inspect', '--format', '{{.Id}}', image]).stdout.trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('resource_study_image_invalid');
    start();
    const fresh = parseUpgradeReceipt(compose(['exec', '-T', 'app', 'node', 'src/scripts/publishedUpgradeProbe.mjs', 'fresh']).stdout, 'UPGRADE_PROBE');
    if (fresh.status !== 'passed' || probe('seed').seeded !== true) throw new Error('resource_study_seed_invalid');
    compose(['stop', '--timeout', '30', 'app']);
    env.CLASSIFARR_UPGRADE_MODE = 'restore'; start();
    report(`RESOURCE_STUDY_RUNNING ${smoke ? 'smoke-2-minutes' : 'soak-30-minutes'}`);
    result = { mode: smoke ? 'smoke' : 'soak', imageId, study: probe(smoke ? 'smoke' : 'soak') };
    if (result.study.status !== 'passed' || result.study.version !== 'resource_study.v1' ||
      result.study.requestedDurationMs !== (smoke ? 120000 : 1800000) ||
      !Number.isSafeInteger(result.study.durationMs) || result.study.durationMs > 2100000 ||
      result.study.durationMs < result.study.requestedDurationMs) throw new Error('resource_study_receipt_invalid');
    const id = compose(['ps', '--quiet', 'app']).stdout.trim();
    if (!/^[a-f0-9]{12,64}$/.test(id) || docker(['inspect', '--format', '{{.State.OOMKilled}} {{.State.Health.Status}}', id]).stdout.trim() !== 'false healthy') {
      throw new Error('resource_study_container_unhealthy');
    }
  } catch (error) { failure = error; }
  finally {
    // Fixed owned project validated empty before build; no arbitrary paths or prune.
    compose(['--profile', 'tools', 'down', '--volumes', '--timeout', '10']);
    docker(['image', 'rm', image], 30000, true);
    for (const args of inventory) if (docker(args).stdout.trim()) throw new Error('resource_study_cleanup_failed');
  }
  if (failure) throw failure;
  result.cleanup = 'passed'; save(project, result);
  report(`RESOURCE_STUDY_RESULT .tmp/resource-study/${project}/result.json`);
  return result;
}
