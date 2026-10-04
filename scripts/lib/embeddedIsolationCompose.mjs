/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { checkEmbeddedSupervisor } from './embeddedSupervisorChecks.mjs';

const root = resolve(import.meta.dirname, '../..');
const file = resolve(root, 'docker-compose.embedded-isolation-drill.yml');
const services = ['drill', 'runtime', 'custom', 'unraid'];
const imagePattern = /^sha256:[a-f0-9]{64}$/;

export function parseEmbeddedIsolationArguments(args) {
  if (args.length === 0) return {};
  if (args.length === 2 && args[0] === '--image' && imagePattern.test(args[1])) return { image: args[1] };
  throw new Error('invalid_arguments');
}

export function runEmbeddedIsolationCompose({ image, run = spawnSync, random = randomBytes, verify = checkEmbeddedSupervisor } = {}) {
  if (image !== undefined && !imagePattern.test(image)) throw new Error('invalid_image_identity');
  const suffix = random(16).toString('hex');
  if (!/^[a-f0-9]{32}$/.test(suffix)) throw new Error('invalid_drill_identity');
  const project = `classifarr-isolation-drill-${suffix}`;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^COMPOSE_/i.test(key)));
  env.COMPOSE_DISABLE_ENV_FILE = '1';
  const options = { cwd: root, env, shell: false, windowsHide: true, timeout: 30_000 };
  const label = `label=com.docker.compose.project=${project}`;
  const inventories = [
    ['ps', '-aq', '--filter', label], ['volume', 'ls', '-q', '--filter', label],
    ['network', 'ls', '-q', '--filter', label],
    ...services.map(service => ['image', 'ls', '-q', `${project}-${service}`]),
  ];
  const assertEmptyProject = () => { for (const args of inventories) {
    let inventory;
    try { inventory = run('docker', args, { ...options, encoding: 'utf8' }); }
    catch { throw new Error('drill_inventory_failed'); }
    if (inventory?.error || inventory?.status !== 0 || typeof inventory.stdout !== 'string') throw new Error('drill_inventory_failed');
    if (inventory.stdout.trim()) throw new Error('drill_project_not_empty');
  } };
  assertEmptyProject();
  const imageCommand = args => {
    let result;
    try { result = run('docker', args, { ...options, encoding: 'utf8', maxBuffer: 64 * 1024 }); }
    catch { throw new Error('drill_image_failed'); }
    if (result?.error || result?.status !== 0) throw new Error('drill_image_failed');
    return result.stdout;
  };
  if (image) {
    // Retain an existing caller tag: deleting our last alias must not delete an untagged caller image.
    let identity;
    try { identity = JSON.parse(imageCommand(['image', 'inspect', image, '--format', '{{json .}}'])); }
    catch { throw new Error('drill_image_unavailable'); }
    if (identity?.Id !== image || !Array.isArray(identity.RepoTags) || identity.RepoTags.length === 0) {
      throw new Error('drill_tagged_image_required');
    }
  }
  const command = (args, timeout = 120_000, { capture = false, expectedStatus = [0] } = {}) => {
    let result;
    try {
      result = run('docker', ['compose', '--project-name', project, '--file', file,
        '--project-directory', root, ...args], { ...options, timeout,
        ...(capture ? { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] } : { stdio: 'inherit' }) });
    } catch { throw new Error(`drill_${args[0]}_failed`); }
    if (result?.error || !expectedStatus.includes(result?.status)) throw new Error(`drill_${args[0]}_failed`);
    return capture ? String(result.stdout ?? '') : undefined;
  };
  command(['config', '--quiet']);
  try {
    if (image) {
      for (const service of services) imageCommand(['tag', image, `${project}-${service}:latest`]);
    } else command(['build', ...services], 1_200_000);
    // `run` has --build (opt-in), not the --no-build option accepted by `up`.
    command(['run', '--rm', '--no-deps', '--pull', 'never', 'drill'], 600_000);
    verify(command);
  } finally {
    try {
      // Only this collision-checked random project; no prune, host mounts or live project.
      command(['down', '--volumes', '--rmi', 'local', '--timeout', '60']);
      assertEmptyProject();
    } catch {
      throw new Error(`drill_cleanup_failed:${project}`);
    }
  }
  if (image) {
    if (imageCommand(['image', 'inspect', image, '--format', '{{.Id}}']).trim() !== image) {
      throw new Error('drill_caller_image_changed');
    }
  }
  return { status: 'passed', cleanup: 'passed', ...(image ? { image } : {}) };
}
