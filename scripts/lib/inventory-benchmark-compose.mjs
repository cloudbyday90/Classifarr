/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseArgs } from 'node:util';
import { validateDescriptionBenchmarkOptions } from '../../server/src/services/inventoryDescriptionBenchmarkSelection.mjs';
import { validateCrossEncoderCases } from '../../server/src/services/inventoryCrossEncoderEvaluation.mjs';

export const BENCHMARK_HOST_RESERVE = 3 * 1024 ** 3;
export function inventoryBenchmarkComposePlan(container, argv, runId, freeMemory) {
  const { values } = parseArgs({ args: argv, options: Object.fromEntries([
    ...['seed', 'size', 'folds', 'generate-cases', 'score-cases', 'context', 'max-minutes', 'exclude-prior-sizes', 'exclude-prior-size']
      .map(name => [name, { type: 'string' }]),
    ...['leader-grounded', 'leader-semantic', 'leader-challenge', 'leader-cross-encoder'].map(name => [name, { type: 'boolean' }]),
  ]) });
  const modes = ['leader-grounded', 'leader-semantic', 'leader-challenge', 'leader-cross-encoder'].filter(name => values[name]);
  const options = validateDescriptionBenchmarkOptions({ seed: values.seed, ...Object.fromEntries([
    ['size', 'size'], ['folds', 'folds'], ['generate-cases', 'generateCases'], ['context', 'context'],
    ['max-minutes', 'maxMinutes'], ['exclude-prior-size', 'excludePriorSize'],
  ].filter(([name]) => values[name] !== undefined).map(([name, key]) => [key, Number(values[name])])),
  ...(values['exclude-prior-sizes'] === undefined ? {} : { excludePriorSizes: values['exclude-prior-sizes'].split(',').map(Number) }) });
  const project = container?.project;
  validateCrossEncoderCases(Number(values['score-cases'] ?? 0), options.size);
  if (values['score-cases'] !== undefined && !values['leader-cross-encoder']) throw new Error('cross_encoder_mode_invalid');
  if (modes.length !== 1 || !options.folds || options.generateCases > 32 ||
      (['leader-challenge', 'leader-cross-encoder'].includes(modes[0]) && options.generateCases !== 0) ||
      !/^[a-z0-9][a-z0-9_-]{0,100}$/.test(project ?? '') ||
      container?.health !== 'healthy' || container?.running !== true ||
      !/^sha256:[a-f0-9]{64}$/.test(container?.image ?? '') || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(runId)) {
    throw new Error('inventory_benchmark_compose_preflight_invalid');
  }
  if (!Number.isSafeInteger(freeMemory) || freeMemory < BENCHMARK_HOST_RESERVE) throw new Error('inventory_benchmark_host_memory_pressure');
  const name = `classifarr-benchmark-${runId}`;
  return { name, runId, image: container.image, timeoutMs: options.maxMinutes * 60_000 + 60_000,
    args: ['compose', '--project-name', project,
      '-f', 'docker-compose.yml', '-f', 'docker-compose.benchmark.yml', 'run', '--detach', '--no-deps', '--pull', 'never',
      '--name', name, '--label', `org.classifarr.benchmark-run=${runId}`,
      '--', 'inventory-benchmark', ...argv, '--admission-wait-ms', '300000'] };
}
