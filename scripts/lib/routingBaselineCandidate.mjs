/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { ROUTING_BASELINE } from './manualRoutingRehearsalDocker.mjs';

const root = resolve(import.meta.dirname, '../..');
const scratch = resolve(root, '.tmp');

/** Build only the fixed historical tree, without checkout or network git fetch. */
export async function withRoutingBaseline(operation, { run = spawnSync, random = randomBytes } = {}) {
  const suffix = random(16).toString('hex');
  if (!/^[a-f0-9]{32}$/.test(suffix)) throw new Error('routing_baseline_identity_invalid');
  const tag = `classifarr-routing-baseline-${suffix}:baseline`;
  const command = (binary, args, timeout = 30_000, allowFailure = false) => {
    let result;
    try { result = run(binary, args, { cwd: root, encoding: 'utf8', shell: false, windowsHide: true,
      timeout, maxBuffer: 8 * 1024 * 1024 }); } catch { /* Fixed diagnostics only. */ }
    if (!result || result.error || (!allowFailure && result.status !== 0) || typeof result.stdout !== 'string') {
      throw new Error('routing_baseline_command_failed');
    }
    return result.stdout.trim();
  };
  if (command('git', ['rev-parse', '--verify', `${ROUTING_BASELINE}^{commit}`]) !== ROUTING_BASELINE) {
    throw new Error('routing_baseline_source_missing');
  }
  if (command('docker', ['image', 'ls', '-q', tag])) throw new Error('routing_baseline_collision');
  mkdirSync(scratch, { recursive: true });
  const directory = mkdtempSync(resolve(scratch, 'routing-ci-baseline-'));
  try {
    const archive = resolve(directory, 'source.tar'), context = resolve(directory, 'source');
    mkdirSync(context);
    command('git', ['archive', '--format=tar', `--output=${archive}`, ROUTING_BASELINE]);
    command('tar', ['-xf', archive, '-C', context]);
    command('docker', ['build', '--target', 'production', '--tag', tag,
      '--build-arg', `VCS_REF=${ROUTING_BASELINE}`, context], 1_200_000);
    const imageId = command('docker', ['image', 'inspect', '--format', '{{.Id}}', tag]);
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId) ||
      command('docker', ['image', 'inspect', '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}', imageId]) !== ROUTING_BASELINE) {
      throw new Error('routing_baseline_image_invalid');
    }
    return await operation(imageId);
  } finally {
    let failed = false;
    try {
      command('docker', ['image', 'rm', tag], 30_000, true);
      if (command('docker', ['image', 'ls', '-q', tag])) throw new Error('tag_retained');
    } catch { failed = true; }
    // Only this invocation's mkdtemp child, never the workspace or an input path.
    try {
      if (dirname(directory) !== scratch || !basename(directory).startsWith('routing-ci-baseline-')) throw new Error('unsafe_cleanup');
      rmSync(directory, { recursive: true });
    } catch { failed = true; }
    if (failed) throw new Error('routing_baseline_cleanup_failed');
  }
}
