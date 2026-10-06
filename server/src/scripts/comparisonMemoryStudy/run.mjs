/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createComparisonMemoryFixture } from './fixture.mjs';
import { createComparisonMemoryMetrics } from './metrics.mjs';
import { measureIncompleteCache } from './preflight.mjs';
import { measureRefreshCycles } from './refresh.mjs';
import { measureVectorCopies } from './copies.mjs';
import { readStudyCgroup, assertStudyCgroup } from '../resourceStudyMetrics.mjs';
import { assertStudyBudget } from '../resourceStudyBudget.mjs';

const mode = process.argv[2];
if (process.platform !== 'linux' || process.env.CLASSIFARR_SYNTHETIC_MEMORY_STUDY !== '1' ||
    process.argv.length !== 3 || !['natural', 'elapsed', 'collect', 'copies', 'incomplete-baseline', 'incomplete-preflight'].includes(mode)) throw new Error('comparison_memory_isolated_only');
const limits = await readStudyCgroup();
assertStudyCgroup(limits); assertStudyBudget(limits, 'bounded');
const metrics = createComparisonMemoryMetrics({ collect: ['collect', 'copies'].includes(mode) });
let fixture;
try {
  await metrics.start();
  fixture = await createComparisonMemoryFixture();
  if (mode === 'copies') {
    await metrics.settled('copies_baseline');
    await measureVectorCopies({ fixture, metrics });
    await metrics.settled('copies_released');
  } else if (mode.startsWith('incomplete-')) {
    await measureIncompleteCache({ fixture, metrics, requireCompleteVectors: mode === 'incomplete-preflight' });
  } else {
    await measureRefreshCycles({ fixture, metrics, elapsed: mode === 'elapsed' });
  }
} finally {
  try { await fixture?.close(); } finally { await metrics.close(); }
}
