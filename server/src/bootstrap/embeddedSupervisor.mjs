/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as sleep } from 'node:timers/promises';
import { waitForEmbeddedExit } from './embeddedChildProcess.mjs';
import { watchEmbeddedDatabase } from './embeddedDatabaseMonitor.mjs';

/** No restart or maintenance loop. Docker owns restart policy; this owns drain order. */
export async function runEmbeddedSupervisor({
  database, startApplication, processRef = process, report: diagnostic = () => {},
  delay = sleep, waitForExit = waitForEmbeddedExit, startMaintenance = null,
  attachRuntimeMaintenance = null,
  maintenanceTimeoutMs = 200_000,
  maintenanceOnly = false,
}) {
  if (typeof maintenanceOnly !== 'boolean' || (maintenanceOnly
    && (typeof startMaintenance !== 'function' || startApplication != null || attachRuntimeMaintenance != null))) {
    throw new Error('maintenance_only_composition_invalid');
  }
  const monitor = new AbortController();
  const adoption = new AbortController();
  const report = (...args) => { try { diagnostic(...args); } catch { /* diagnostics cannot interrupt cleanup */ } };
  const operationReason = error => ['database_operation_timeout', 'database_operation_cancelled', 'database_operation_unjoined']
    .includes(error?.code) ? error.code : undefined;
  let request;
  let wake;
  const stopped = new Promise(resolve => { wake = resolve; });
  const requestStop = event => { if (!request) { request = event; adoption.abort(); wake(); } };
  const onTerm = () => requestStop({ reason: 'SIGTERM', failed: false });
  const onInt = () => requestStop({ reason: 'SIGINT', failed: false });
  processRef.on('SIGTERM', onTerm);
  processRef.on('SIGINT', onInt);
  let application;
  let maintenance;
  let maintenanceStopped = true;
  let watching;
  let adopted = false;
  let failed = false;
  let applicationStopped = true;
  let runtimeMaintenance, runtimeMaintenanceStopped = true;
  try {
    await database.adopt({ signal: adoption.signal });
    adopted = true;
    if (!request && startMaintenance) {
      maintenance = startMaintenance();
      maintenanceStopped = false;
      report('maintenance_started');
      // A host signal cancels the handoff. No normal process exists in this phase.
      const result = await waitForExit(Promise.race([
        maintenance.done, stopped.then(() => null),
      ]), maintenanceTimeoutMs);
      if (result) {
        maintenanceStopped = true;
        if (result.code !== 0 || result.signal !== null) throw new Error('maintenance_failed');
        report('maintenance_completed');
        if (maintenanceOnly) requestStop({ reason: 'maintenance_completed', failed: false });
      }
    }
    if (!request) {
      application = startApplication();
      applicationStopped = false;
      application.done.then(result => requestStop({ reason: 'application_exit', failed: result.code !== 0 || result.signal !== null }));
      if (attachRuntimeMaintenance) {
        runtimeMaintenance = attachRuntimeMaintenance(application, () => requestStop({ reason: 'maintenance_exit_unconfirmed', failed: true }));
        runtimeMaintenanceStopped = false;
      }
      watching = watchEmbeddedDatabase({ database, signal: monitor.signal, requestStop, delay, report });
      report('supervising');
    }
    await stopped;
    // A cancelled one-shot restore is not a completed restoration, even if drained cleanly.
    failed = request.failed || (maintenanceOnly && request.reason !== 'maintenance_completed');
    report('stopping', request.reason);
  } catch (error) {
    failed = true;
    report('startup_failed', operationReason(error));
  } finally {
    monitor.abort();
    // Cancel online maintenance concurrently with application drain. Join before stopping PG.
    const maintenanceDrain = runtimeMaintenance ? Promise.resolve().then(() => runtimeMaintenance.stop())
      .then(() => { runtimeMaintenanceStopped = true; }, () => { failed = true; report('maintenance_exit_unconfirmed'); }) : null;
    if (maintenance && !maintenanceStopped) {
      try {
        maintenance.signal('SIGTERM');
        await waitForExit(maintenance.done, 2000);
        maintenanceStopped = true;
      } catch {
        failed = true;
        try {
          maintenance.signal('SIGKILL');
          await waitForExit(maintenance.done, 2000);
          maintenanceStopped = true;
        } catch { report('maintenance_exit_unconfirmed'); }
      }
    }
    if (application) {
      try {
        application.signal('SIGTERM');
        const result = await waitForExit(application.done, 15_000);
        applicationStopped = true;
        if (result.code !== 0 || result.signal !== null) failed = true;
      } catch {
        failed = true;
        report('application_drain_failed');
        try {
          application.signal('SIGKILL');
          await waitForExit(application.done, 2000);
          applicationStopped = true;
        } catch { report('application_exit_unconfirmed'); }
      }
      if (applicationStopped) report('application_stopped');
    }
    // Drain immediately; a pending status probe must not consume the host's
    // shutdown window before SIGTERM reaches Node. Join it before stopping PG.
    const databaseProbeJoined = (await watching)?.joined !== false;
    if (!databaseProbeJoined) failed = true;
    await maintenanceDrain;
    if (adopted && applicationStopped && maintenanceStopped && runtimeMaintenanceStopped && databaseProbeJoined) {
      try {
        await database.stop();
        report('database_stopped');
      } catch (error) {
        failed = true;
        report('database_shutdown_unconfirmed', operationReason(error));
      }
    }
    processRef.removeListener('SIGTERM', onTerm);
    processRef.removeListener('SIGINT', onInt);
  }
  report(failed ? 'failed' : 'stopped');
  return failed ? 1 : 0;
}
