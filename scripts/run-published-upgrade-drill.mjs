/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runPublishedUpgradeCompose } from './lib/publishedUpgradeCompose.mjs';

try {
  if (process.argv.length !== 2) throw new Error('upgrade_drill_arguments_not_allowed');
  process.stdout.write(`PUBLISHED_UPGRADE_RESULT ${JSON.stringify(await runPublishedUpgradeCompose())}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
