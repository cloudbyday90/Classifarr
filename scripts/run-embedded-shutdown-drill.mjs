/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runLoadedShutdownDrill } from './lib/embeddedShutdownChecks.mjs';
import { runQueueRecoveryDrill } from './lib/embeddedQueueRecoveryChecks.mjs';
import { createShutdownReport } from './lib/embeddedShutdownReport.mjs';
import { projectShutdownError } from './lib/embeddedShutdownDiagnostics.mjs';

export async function runShutdownDrillCli(args, { http = runLoadedShutdownDrill, queue = runQueueRecoveryDrill,
  createReport = createShutdownReport } = {}) {
  if (!(args.length === 0 || (args.length === 1 && args[0] === '--queue-claims'))) throw new Error('invalid_arguments');
  const mode = args.length ? 'queue' : 'http';
  const report = createReport(mode);
  let failure;
  try { await (mode === 'queue' ? queue : http)({ diagnostics: report.update }); }
  catch (error) { failure = error; }
  try { report.finish(failure); }
  catch (error) { throw new AggregateError([...(failure ? [failure] : []), error], 'shutdown_diagnostics_write_failed'); }
  if (failure) throw failure;
}

if (import.meta.main) {
  try {
    await runShutdownDrillCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Loaded container shutdown drill failed: ${JSON.stringify(projectShutdownError(error))}\n`);
    process.exitCode = 1;
  }
}
