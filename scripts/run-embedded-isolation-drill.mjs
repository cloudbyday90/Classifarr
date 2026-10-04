/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseEmbeddedIsolationArguments, runEmbeddedIsolationCompose } from './lib/embeddedIsolationCompose.mjs';

if (import.meta.main) {
  try {
    const result = runEmbeddedIsolationCompose(parseEmbeddedIsolationArguments(process.argv.slice(2)));
    process.stdout.write(`Embedded isolation drill: ${result.status}; cleanup: ${result.cleanup}.\n`);
  } catch (error) {
    process.stderr.write(`Embedded isolation drill failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
