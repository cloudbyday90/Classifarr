/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runLoadedShutdownDrill } from './lib/embeddedShutdownChecks.mjs';
import { runQueueRecoveryDrill } from './lib/embeddedQueueRecoveryChecks.mjs';

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0) await runLoadedShutdownDrill();
    else if (args.length === 1 && args[0] === '--queue-claims') await runQueueRecoveryDrill();
    else throw new Error('invalid_arguments');
  } catch (error) {
    process.stderr.write(`Loaded container shutdown drill failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
