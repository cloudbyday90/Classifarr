/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runFrozenReleaseRehearsal, formatFrozenRehearsalSummary } from './lib/frozenReleaseRehearsal.mjs';

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some(arg => arg !== '--no-cache')) throw new Error('invalid_arguments');
    const receipt = await runFrozenReleaseRehearsal({ noCache: args.includes('--no-cache') });
    const directory = resolve(import.meta.dirname, '../.tmp/release-rehearsal');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(resolve(directory, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    writeFileSync(resolve(directory, 'summary.md'), formatFrozenRehearsalSummary(receipt), { mode: 0o600 });
    process.stdout.write(`Frozen release rehearsal: ${receipt.status}. Receipt: .tmp/release-rehearsal/receipt.json\n`);
    if (receipt.provenanceFailure) process.stdout.write(`Next: ${receipt.provenanceFailure.nextStep}\n`);
    if (receipt.status !== 'passed') process.exitCode = 1;
  } catch {
    process.stderr.write('Frozen release rehearsal could not produce evidence.\n');
    process.exitCode = 1;
  }
}
