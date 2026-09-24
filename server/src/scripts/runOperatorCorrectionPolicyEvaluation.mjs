/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { validateDescriptionBenchmarkOptions } from '../services/inventoryDescriptionBenchmarkSelection.mjs';

/** Private, read-only evaluation. No case content or failure detail is printed. */
export async function runOperatorCorrectionPolicyEvaluation({ argv = process.argv.slice(2), evaluate } = {}) {
  const { values } = parseArgs({ args: argv, options: {
    seed: { type: 'string' }, size: { type: 'string' }, folds: { type: 'string' },
    'generate-cases': { type: 'string' }, 'max-minutes': { type: 'string' }, 'source-pair': { type: 'boolean', default: false },
    'saved-decisions': { type: 'boolean', default: false },
  } });
  if (values['saved-decisions'] && Object.entries(values).some(([key, value]) => key !== 'saved-decisions' && value !== false)) {
    throw new Error('saved_decisions_uses_fixed_retention_and_budget');
  }
  const options = validateDescriptionBenchmarkOptions({ seed: values.seed ?? 'operator-correction-readonly-v1',
    size: Number(values.size ?? (values['source-pair'] ? 300 : 100)), folds: Number(values.folds ?? 3),
    generateCases: Number(values['generate-cases'] ?? 0), maxMinutes: Number(values['max-minutes'] ?? 20) });
  if (!options.folds) throw new Error('operator_correction_evaluation_requires_grouped_folds');
  if (values['source-pair'] && (options.generateCases || values.folds !== undefined || values['max-minutes'] !== undefined)) {
    throw new Error('source_pair_uses_cached_vectors_and_fixed_grouped_folds');
  }
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000`.trim();
  if (values['saved-decisions']) {
    const run = evaluate ?? (await import('../services/destinationOutcomeEvaluationRepository.mjs')).runDestinationOutcomeEvaluation;
    return run();
  }
  const run = evaluate ?? (values['source-pair']
    ? (await import('../services/sourceDescriptionEvaluationRuntime.mjs')).runSourceDescriptionEvaluation
    : (await import('../services/freshInventoryPolicyEvaluation.mjs')).runFreshInventoryPolicyEvaluation);
  return values['source-pair'] ? run(options) : run(options, { operatorCorrectionsOnly: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runOperatorCorrectionPolicyEvaluation().then(report => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!['preflight', 'complete', 'no_eligible_corrections', 'no_eligible_cases', 'no_eligible_outcomes'].includes(report.status) ||
        report.sampleShortfall && report.sampled > 0) process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('Operator-correction evaluation did not complete. No routing changes were made.\n');
    process.exitCode = 1;
  });
}
