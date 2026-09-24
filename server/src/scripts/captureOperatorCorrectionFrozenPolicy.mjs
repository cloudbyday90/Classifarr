/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(import.meta.dirname, '../../..');

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
  const settings = validateDescriptionBenchmarkOptions({ seed: values.seed ?? 'release-frozen-policy-v2',
    size: Number(values.size ?? 100), folds: Number(values.folds ?? 3), generateCases: 0,
    maxMinutes: Number(values['max-minutes'] ?? 20) });
  const run = capture ?? (await import('../services/operatorCorrectionFrozenPolicyCohort.mjs'))
    .captureOperatorCorrectionFrozenPolicyCohort;
  const input = await run(settings);
  const tmp = join(PROJECT_ROOT, '.tmp');
  await mkdir(tmp, { recursive: true });
  if (relative(await realpath(PROJECT_ROOT), await realpath(tmp)) !== '.tmp') {
    throw new Error('frozen_policy_tmp_boundary_invalid');
  }
  const dir = await mkdtemp(join(tmp, 'frozen-policy-'));
  try {
    await writeFile(join(dir, 'input.json'), JSON.stringify(input), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    const name = relative(tmp, dir);
    if (name.startsWith('frozen-policy-') && !name.includes(sep)) await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { inputFile: relative(PROJECT_ROOT, join(dir, 'input.json')).split(sep).join('/'),
    sampled: input.cases.length, eligibleCorrections: input.eligibleCorrections,
    folds: input.folds.length, sourceFingerprint: input.sourceFingerprint,
    sampleFingerprint: input.sampleFingerprint };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFrozenPolicyCapture().then(summary => process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`))
    .catch(() => { process.stderr.write('Private frozen-policy capture failed; no routing or learning changed.\n');
      process.exitCode = 1; });
}
