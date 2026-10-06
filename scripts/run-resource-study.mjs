/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runResourceStudyCompose } from './lib/resourceStudyCompose.mjs';
import { runResourceBudgetComparison } from './lib/resourceBudgetComparison.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !['--smoke', '--soak', '--capacity', '--budget-comparison', '--image-index', '--image-index-capacity', '--image-index-mixed', '--classification-retrieval', '--comparison-control', '--comparison-concurrent', '--comparison-recovery', '--comparison-catalog'].includes(args[0]))) throw new Error('resource_study_arguments_invalid');
  if (args[0] === '--budget-comparison') await runResourceBudgetComparison();
  else if (['--comparison-control', '--comparison-concurrent', '--comparison-recovery', '--comparison-catalog'].includes(args[0])) await runResourceStudyCompose({ mode: args[0].slice(2), budget: 'bounded' });
  else if (args[0] === '--image-index-capacity') await runResourceStudyCompose({ mode: 'image-index', budget: 'image-capacity' });
  else if (args[0] === '--image-index-mixed') await runResourceStudyCompose({ mode: 'image-index-mixed', budget: 'image-capacity' });
  else if (args[0] === '--classification-retrieval') await runResourceStudyCompose({ mode: 'classification-retrieval', budget: 'image-capacity' });
  else await runResourceStudyCompose({ mode: args[0]?.slice(2) ?? 'soak' });
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
