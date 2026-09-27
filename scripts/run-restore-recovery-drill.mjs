/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runRestoreRecoveryCompose } from './lib/restoreRecoveryCompose.mjs';

try {
  if (process.argv.length !== 2) throw new Error('This drill accepts no arguments.');
  const result = runRestoreRecoveryCompose();
  process.stdout.write(`Restore recovery drill: ${result.status}; disposable resource cleanup: ${result.cleanup}.\n`);
} catch (error) {
  process.stderr.write(`Restore recovery drill failed: ${error.message}\n`);
  process.exitCode = 1;
}
