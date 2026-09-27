/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { rm } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PRIVATE_STUDY_ROOT as PROJECT_ROOT, createPrivateStudyDirectory, writePrivateStudyJsonFile } from './privateStudyFileBoundary.mjs';

/** Creates one private evidence input; prints no media, labels or profile data. */
export async function runFrozenPolicyCapture({ argv = process.argv.slice(2), capture } = {}) {
  const { values } = parseArgs({ args: argv, options: {
    seed: { type: 'string' }, size: { type: 'string' }, folds: { type: 'string' },
    'max-minutes': { type: 'string' },
  }, strict: true });
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000`.trim();
  const { validateDescriptionBenchmarkOptions } = await import('../services/inventoryDescriptionBenchmarkSelection.mjs');
  const settings = validateDescriptionBenchmarkOptions({ seed: values.seed ?? 'release-frozen-inventory-v3',
    size: Number(values.size ?? 100), folds: Number(values.folds ?? 3), generateCases: 0,
    maxMinutes: Number(values['max-minutes'] ?? 20) });
  const run = capture ?? (await import('../services/operatorCorrectionFrozenPolicyCohort.mjs'))
    .captureOperatorCorrectionFrozenPolicyCohort;
  const input = await run(settings);
  const tmp = join(PROJECT_ROOT, '.tmp');
  const dir = await createPrivateStudyDirectory('frozen-policy-');
  const inputFile = relative(PROJECT_ROOT, join(dir, 'input.json')).split(sep).join('/');
  try {
    await writePrivateStudyJsonFile(inputFile, input, { label: 'Frozen-policy capture' });
  } catch (error) {
    const name = relative(tmp, dir);
    if (name.startsWith('frozen-policy-') && !name.includes(sep)) await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { inputFile,
    sampled: input.cases.length, eligibleCorrections: input.eligibleCorrections,
    folds: input.folds.length, sourceFingerprint: input.sourceFingerprint,
    sampleFingerprint: input.sampleFingerprint };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFrozenPolicyCapture().then(summary => process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`))
    .catch(() => { process.stderr.write('Private frozen-policy capture failed; no routing or learning changed.\n');
      process.exitCode = 1; });
}
