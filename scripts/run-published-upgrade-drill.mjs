/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runPublishedUpgradeCompose } from './lib/publishedUpgradeCompose.mjs';
import { readProvenanceFailure } from './lib/publishedUpgradeProvenance.mjs';

try {
  const args = process.argv.slice(2);
  const profiles = args.filter(arg => arg.startsWith('--deployment='));
  if (new Set(args).size !== args.length || profiles.length > 1
    || args.some(arg => !['--fresh-only', '--resource-budget', '--deployment=standard', '--deployment=unraid', '--deployment=custom'].includes(arg))) {
    throw new Error('upgrade_drill_arguments_not_allowed');
  }
  const freshOnly = args.includes('--fresh-only'), resourceBudget = args.includes('--resource-budget');
  const deploymentProfile = profiles[0]?.slice('--deployment='.length) ?? 'standard';
  process.stdout.write(`${freshOnly ? 'FRESH_INSTALL_RESULT' : 'PUBLISHED_UPGRADE_RESULT'} ${JSON.stringify(await runPublishedUpgradeCompose({ freshOnly, resourceBudget, deploymentProfile }))}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  const diagnostic = readProvenanceFailure(error);
  if (diagnostic) process.stderr.write(`Next: ${diagnostic.nextStep}\n`);
  process.exitCode = 1;
}
