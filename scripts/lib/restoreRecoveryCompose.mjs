/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../..');
const composeFile = resolve(repoRoot, 'docker-compose.restore-recovery-drill.yml');

/** No live project, compose file, endpoint, credentials or command overrides. */
export function runRestoreRecoveryCompose({ run = spawnSync, random = randomBytes } = {}) {
  const suffix = random(16).toString('hex');
  if (!/^[a-f0-9]{32}$/.test(suffix)) throw new Error('invalid_drill_identity');
  const project = `classifarr-restore-drill-${suffix}`;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^COMPOSE_/i.test(key)));
  env.COMPOSE_DISABLE_ENV_FILE = '1';
  env.CLASSIFARR_DRILL_PASSWORD = random(32).toString('hex');
  if (!/^[a-f0-9]{64}$/.test(env.CLASSIFARR_DRILL_PASSWORD)) throw new Error('invalid_drill_credentials');
  const args = ['compose', '--project-name', project, '--file', composeFile, '--project-directory', repoRoot];
  const command = (extra, timeout = 120_000) => {
    try {
      const result = run('docker', [...args, ...extra], {
        cwd: repoRoot, env, shell: false, windowsHide: true, stdio: 'inherit', timeout,
      });
      if (result?.status === 0 && !result.error) return;
    } catch { /* Preserve only the fixed operation, never command output or credentials. */ }
    throw new Error(`drill_${extra[0]}_failed`);
  };
  // Reject even an astronomically unlikely project collision before owning cleanup.
  const label = `label=com.docker.compose.project=${project}`;
  for (const inventoryArgs of [
    ['ps', '-aq', '--filter', label],
    ['volume', 'ls', '-q', '--filter', label],
    ['network', 'ls', '-q', '--filter', label],
    ['image', 'ls', '-q', `${project}-drill`],
  ]) {
    let inventory;
    try {
      inventory = run('docker', inventoryArgs,
        { cwd: repoRoot, env, shell: false, windowsHide: true, encoding: 'utf8', timeout: 30_000 });
    } catch { throw new Error('drill_inventory_failed'); }
    if (inventory?.status !== 0 || typeof inventory.stdout !== 'string') throw new Error('drill_inventory_failed');
    if (inventory.stdout.trim()) throw new Error('drill_project_not_empty');
  }
  command(['config', '--quiet']);
  let failure;
  try {
    command(['build', 'drill'], 1_200_000);
    command(['up', '--detach', '--wait', '--wait-timeout', '90', 'database']);
    command(['run', '--rm', '--no-deps', 'drill'], 300_000);
  } catch (error) {
    failure = error;
  } finally {
    try {
      // Only this fresh random project owns these scratch resources; never prune.
      command(['down', '--volumes', '--rmi', 'local', '--timeout', '10']);
    } catch {
      throw new Error(`drill_cleanup_failed:${project}${failure ? ':scenario_failed' : ''}`);
    }
  }
  if (failure) throw failure;
  return { status: 'passed', cleanup: 'passed' };
}
