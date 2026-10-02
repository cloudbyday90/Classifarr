/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

/** Own only a random local tag. Never delete the underlying ID or any live tag. */
export async function withFrozenUpgradeCandidate(operation, { run = spawnSync, random = randomBytes, noCache = false, sourceRevision } = {}) {
  if (typeof noCache !== 'boolean') throw new TypeError('invalid_rehearsal_cache_mode');
  if (typeof sourceRevision !== 'string' || !/^[a-f0-9]{40,64}$/.test(sourceRevision)) throw new TypeError('invalid_rehearsal_source');
  const suffix = random(16).toString('hex');
  if (!/^[a-f0-9]{32}$/.test(suffix)) throw new Error('invalid_rehearsal_identity');
  const tag = `classifarr-release-rehearsal-${suffix}:candidate`;
  const docker = (args, timeout = 30_000, allowFailure = false) => {
    let result;
    try {
      result = run('docker', args, { cwd: root, env: process.env, shell: false, windowsHide: true,
        encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
    } catch { /* Never expose command output or exception details. */ }
    if (result?.error || !result || (!allowFailure && result.status !== 0) || typeof result.stdout !== 'string') {
      throw new Error('frozen_candidate_command_failed');
    }
    return result.stdout.trim();
  };
  // No cleanup authority until this exact, generated tag is proven absent.
  if (docker(['image', 'ls', '-q', tag])) throw new Error('frozen_candidate_collision');
  try {
    docker(['build', '--target', 'production', '--tag', tag, '--build-arg', `VCS_REF=${sourceRevision}`,
      ...(noCache ? ['--no-cache'] : []), '.'], 1_200_000);
    const imageId = docker(['image', 'inspect', '--format', '{{.Id}}', tag]);
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('frozen_candidate_invalid');
    if (docker(['image', 'inspect', '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}', imageId]) !== sourceRevision) {
      throw new Error('frozen_candidate_revision_mismatch');
    }
    return await operation(imageId);
  } finally {
    try {
      docker(['image', 'rm', tag], 30_000, true);
      if (docker(['image', 'ls', '-q', tag])) throw new Error('candidate_tag_retained');
    } catch { throw new Error('frozen_candidate_cleanup_failed'); }
  }
}
