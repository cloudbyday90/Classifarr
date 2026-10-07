/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Offline CLI only. See docs/architecture/vector-validation-allocation-design.md.
import { readStudyCgroup, assertStudyCgroup } from '../resourceStudyMetrics.mjs';
import { assertStudyBudget, assertStudyBudgetContinuity } from '../resourceStudyBudget.mjs';
import { measureVectorValidationHistory } from './vectorValidation.mjs';

try {
  if (process.platform !== 'linux' || process.env.CLASSIFARR_SYNTHETIC_MEMORY_STUDY !== '1' || process.argv.length !== 2) {
    throw new Error('vector_validation_study_isolated_only');
  }
  const initial = await readStudyCgroup();
  assertStudyCgroup(initial); assertStudyBudget(initial, 'bounded');
  const receipt = await measureVectorValidationHistory();
  const final = await readStudyCgroup();
  assertStudyCgroup(final); assertStudyBudget(final, 'bounded');
  assertStudyBudgetContinuity(initial, final);
  if (final.oomKill !== initial.oomKill || final.memoryLimitHits !== initial.memoryLimitHits || final.oom !== initial.oom) {
    throw new Error('vector_validation_study_pressure');
  }
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} catch {
  // No raw profile, stack, environment or payload is emitted on failure.
  process.stderr.write('vector_validation_study_failed\n');
  process.exitCode = 1;
}
