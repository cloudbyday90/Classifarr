/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const file = resolve(root, 'docker-compose.embedded-isolation-drill.yml');

export function runEmbeddedIsolationCompose({ run = spawnSync, random = randomBytes } = {}) {
  const suffix = random(16).toString('hex');
  if (!/^[a-f0-9]{32}$/.test(suffix)) throw new Error('invalid_drill_identity');
  const project = `classifarr-isolation-drill-${suffix}`;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^COMPOSE_/i.test(key)));
  env.COMPOSE_DISABLE_ENV_FILE = '1';
  const options = { cwd: root, env, shell: false, windowsHide: true, timeout: 30_000 };
  const label = `label=com.docker.compose.project=${project}`;
  for (const args of [
    ['ps', '-aq', '--filter', label], ['volume', 'ls', '-q', '--filter', label],
    ['network', 'ls', '-q', '--filter', label], ['image', 'ls', '-q', `${project}-drill`],
  ]) {
    let inventory;
    try { inventory = run('docker', args, { ...options, encoding: 'utf8' }); }
    catch { throw new Error('drill_inventory_failed'); }
    if (inventory?.error || inventory?.status !== 0 || typeof inventory.stdout !== 'string') throw new Error('drill_inventory_failed');
    if (inventory.stdout.trim()) throw new Error('drill_project_not_empty');
  }
  const command = (args, timeout = 120_000) => {
    let result;
    try {
      result = run('docker', ['compose', '--project-name', project, '--file', file,
        '--project-directory', root, ...args], { ...options, timeout, stdio: 'inherit' });
    } catch { throw new Error(`drill_${args[0]}_failed`); }
    if (result?.error || result?.status !== 0) throw new Error(`drill_${args[0]}_failed`);
  };
  command(['config', '--quiet']);
  try {
    command(['build', 'drill'], 1_200_000);
    command(['run', '--rm', '--no-deps', 'drill'], 600_000);
  } finally {
    try {
      // Only this collision-checked random project; no prune, host mounts or live project.
      command(['down', '--volumes', '--rmi', 'local', '--timeout', '45']);
    } catch {
      throw new Error(`drill_cleanup_failed:${project}`);
    }
  }
  return { status: 'passed', cleanup: 'passed' };
}
