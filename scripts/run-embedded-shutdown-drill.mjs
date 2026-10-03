/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runLoadedShutdownDrill } from './lib/embeddedShutdownChecks.mjs';

if (import.meta.main) {
  try {
    if (process.argv.length !== 2) throw new Error('invalid_arguments');
    await runLoadedShutdownDrill();
  } catch (error) {
    process.stderr.write(`Loaded container shutdown drill failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
