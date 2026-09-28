/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runResourceStudyCompose } from './lib/resourceStudyCompose.mjs';
import { runResourceBudgetComparison } from './lib/resourceBudgetComparison.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !['--smoke', '--soak', '--capacity', '--budget-comparison'].includes(args[0]))) throw new Error('resource_study_arguments_invalid');
  if (args[0] === '--budget-comparison') await runResourceBudgetComparison();
  else await runResourceStudyCompose({ mode: args[0] === '--smoke' ? 'smoke' : args[0] === '--capacity' ? 'capacity' : 'soak' });
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
