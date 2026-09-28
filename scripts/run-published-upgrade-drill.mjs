/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runPublishedUpgradeCompose } from './lib/publishedUpgradeCompose.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== '--fresh-only')) throw new Error('upgrade_drill_arguments_not_allowed');
  const freshOnly = args[0] === '--fresh-only';
  process.stdout.write(`${freshOnly ? 'FRESH_INSTALL_RESULT' : 'PUBLISHED_UPGRADE_RESULT'} ${JSON.stringify(await runPublishedUpgradeCompose({ freshOnly }))}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
