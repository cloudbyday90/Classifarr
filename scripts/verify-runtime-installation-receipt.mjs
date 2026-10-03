/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { openSync, closeSync, fstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateRuntimeInstallationGate } from './lib/runtimeInstallationGate.mjs';

/** Fixed downloaded artifact; never accepts a user-supplied file or command. */
export function verifyDownloadedInstallationReceipt({ env = process.env } = {}) {
  const file = openSync(resolve(import.meta.dirname, '../.tmp/ci/installation/runtime-installation-acceptance.json'), 'r');
  try {
    const stat = fstatSync(file);
    if (!stat.isFile() || stat.size > 128 * 1024) throw new Error('installation_receipt_size_invalid');
    return validateRuntimeInstallationGate(JSON.parse(readFileSync(file, 'utf8')), {
      sourceRevision: env.CLASSIFARR_INSTALLATION_SOURCE_REVISION,
      candidateImageId: env.CLASSIFARR_INSTALLATION_CANDIDATE_IMAGE_ID,
      runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT,
    });
  } finally { closeSync(file); }
}

if (import.meta.main) {
  try {
    if (process.argv.length !== 2) throw new Error('invalid_arguments');
    verifyDownloadedInstallationReceipt();
    process.stdout.write('Same-run installation and routing receipt verified.\n');
  } catch {
    process.stderr.write('Installation receipt missing, invalid or mismatched; acceptance blocked.\n');
    process.exitCode = 1;
  }
}
