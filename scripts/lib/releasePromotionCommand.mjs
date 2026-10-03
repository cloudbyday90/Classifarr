/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawnSync } from 'node:child_process';

/** Bounded, shell-free execution. Never surface CLI output in public failure receipts. */
export function createPromotionCommand(run = spawnSync) {
  return (binary, args, timeout = 120_000) => {
    let result;
    try {
      result = run(binary, args, { encoding: 'utf8', shell: false, windowsHide: true,
        timeout, maxBuffer: 4 * 1024 * 1024 });
    } catch { /* Use the same sanitized failure for spawn and command errors. */ }
    if (!result || result.error || result.status !== 0 || typeof result.stdout !== 'string') {
      throw new Error('release_promotion_command_failed');
    }
    return result.stdout;
  };
}
