/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as sleep } from 'node:timers/promises';
import { waitForEmbeddedExit } from './embeddedChildProcess.mjs';

async function watchDatabase(database, signal, requestStop, delay) {
  try {
    while (!signal.aborted) {
      await delay(5000, undefined, { signal });
      if (signal.aborted) return;
      await database.check();
    }
  } catch {
    if (!signal.aborted) requestStop({ reason: 'database_unavailable', failed: true });
  }
}

/** No restart or maintenance loop. Docker owns restart policy; this owns drain order. */
export async function runEmbeddedSupervisor({
  database, startApplication, processRef = process, report = () => {},
  delay = sleep, waitForExit = waitForEmbeddedExit, startMaintenance = null,
  attachRuntimeMaintenance = null,
}) {
  const monitor = new AbortController();
  let request;
  let wake;
  const stopped = new Promise(resolve => { wake = resolve; });
  const requestStop = event => { if (!request) { request = event; wake(); } };
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
    await database.adopt();
    adopted = true;
    if (!request && startMaintenance) {
      maintenance = startMaintenance();
      maintenanceStopped = false;
      report('maintenance_started');
      // A host signal cancels the handoff. No normal process exists in this phase.
      const result = await waitForExit(Promise.race([
        maintenance.done, stopped.then(() => null),
      ]), 200_000);
      if (result) {
        maintenanceStopped = true;
        if (result.code !== 0 || result.signal !== null) throw new Error('maintenance_failed');
        report('maintenance_completed');
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
      watching = watchDatabase(database, monitor.signal, requestStop, delay);
      report('supervising');
    }
    await stopped;
    failed = request.failed;
    report('stopping', request.reason);
  } catch {
    failed = true;
    report('startup_failed');
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
    await watching;
    await maintenanceDrain;
    if (adopted && applicationStopped && maintenanceStopped && runtimeMaintenanceStopped) {
      try {
        await database.stop();
        report('database_stopped');
      } catch {
        failed = true;
        report('database_shutdown_unconfirmed');
      }
    }
    processRef.removeListener('SIGTERM', onTerm);
    processRef.removeListener('SIGINT', onInt);
  }
  report(failed ? 'failed' : 'stopped');
  return failed ? 1 : 0;
}
