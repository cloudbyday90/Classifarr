/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProjectJsonFile, PROJECT_ROOT } from './lib/project-json-input.mjs';
import { assertPinnedReleaseCommit } from '../server/src/scripts/pinnedReleaseSchema.mjs';
import { compareOperatorCorrectionReleasePair } from '../server/src/services/operatorCorrectionReleasePairComparison.mjs';

/** Reads only bounded project-contained artifacts; never invokes either classifier. */
export async function runOperatorCorrectionReleasePairComparison({ argv = process.argv.slice(2),
  loadJson = loadProjectJsonFile, verifyBaseline = assertPinnedReleaseCommit,
  verifyCleanCheckout = () => {
    const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'],
      { cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 }).trim();
    if (changes) throw new Error('release_pair_checkout_dirty');
  },
  currentCommit = () => execFileSync('git', ['rev-parse', 'HEAD'],
    { cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 1024 }).trim() } = {}) {
  const { values } = parseArgs({ args: argv, options: {
    'baseline-file': { type: 'string' }, 'candidate-file': { type: 'string' },
  }, strict: true });
  if (!values['baseline-file'] || !values['candidate-file']) throw new Error('release_pair_files_required');
  verifyBaseline();
  verifyCleanCheckout();
  const [baseline, candidate] = await Promise.all([
    loadJson(values['baseline-file']), loadJson(values['candidate-file']),
  ]);
  return compareOperatorCorrectionReleasePair({ baseline, candidate, candidateCommit: currentCommit() });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runOperatorCorrectionReleasePairComparison().then(report => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }).catch(() => {
    process.stderr.write('Release-pair comparison could not validate its private inputs. No routing changes were made.\n');
    process.exitCode = 1;
  });
}
