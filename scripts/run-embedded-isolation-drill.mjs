/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runEmbeddedIsolationCompose } from './lib/embeddedIsolationCompose.mjs';

if (import.meta.main) {
  try {
    if (process.argv.length !== 2) throw new Error('invalid_arguments');
    const result = runEmbeddedIsolationCompose();
    process.stdout.write(`Embedded isolation drill: ${result.status}; cleanup: ${result.cleanup}.\n`);
  } catch (error) {
    process.stderr.write(`Embedded isolation drill failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
