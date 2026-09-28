/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/** One owned build for a matched comparison; never rebuild between scenarios. */
export async function withResourceStudyImage(work, { run = spawnSync, random = randomBytes } = {}) {
  const suffix = random(16).toString('hex');
  if (!/^[a-f0-9]{32}$/.test(suffix) || typeof work !== 'function') throw new Error('resource_study_image_identity_invalid');
  const image = `classifarr-resource-image-${suffix}`, root = resolve(import.meta.dirname, '../..');
  const docker = (args, timeout = 120000) => {
    let result;
    try { result = run('docker', args, { cwd: root, shell: false, windowsHide: true,
      encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 }); } catch { /* Fixed error only. */ }
    if (!result || result.error || result.status !== 0 || typeof result.stdout !== 'string') {
      throw new Error('resource_study_image_command_failed');
    }
    return result.stdout.trim();
  };
  const inventory = ['image', 'ls', '-q', image];
  if (docker(inventory)) throw new Error('resource_study_image_not_empty');
  let imageId;
  try {
    docker(['build', '--target', 'production', '--tag', image, '.'], 1200000);
    imageId = docker(['image', 'inspect', '--format', '{{.Id}}', image]);
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('resource_study_image_invalid');
    return await work(imageId);
  } finally {
    if (docker(inventory)) {
      if (imageId && docker(['image', 'inspect', '--format', '{{.Id}}', image]) !== imageId) {
        throw new Error('resource_study_image_identity_changed');
      }
      docker(['image', 'rm', image], 30000);
    }
    if (docker(inventory)) throw new Error('resource_study_image_cleanup_failed');
  }
}
