/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { readOperatingMode } from '../config/operatingMode.mjs';
import { acquireNormalRuntimeAdmission } from './runtimeAdmission.mjs';
import { readSchemaMaintenanceMode } from '../config/schemaMaintenanceMode.mjs';
import { verifyRuntimeSchemaReadiness, verifySupervisedSchemaReadiness } from '../services/databaseSchemaReadiness.mjs';
import { hasEmbeddedSchemaHandoff } from '../config/embeddedSchemaHandoff.mjs';
import { loadOllamaRoutingStartup, bindOllamaRoutingLifetime } from './ollamaRoutingStartup.mjs';

export async function startApplication({
  database,
  environment = process.env,
  processRef = process,
  acquireAdmission = acquireNormalRuntimeAdmission,
  verifySchema = verifyRuntimeSchemaReadiness,
  verifySupervisedSchema = verifySupervisedSchemaReadiness,
  onAdmissionLost,
  loadNormal = () => import('./normalRuntime.mjs'),
  loadRestore = () => import('./restoreRuntime.mjs'),
  loadRouting = loadOllamaRoutingStartup,
}) {
  const mode = readOperatingMode(environment);
  const externalSchema = readSchemaMaintenanceMode(environment) === 'external';
  const supervisedSchema = hasEmbeddedSchemaHandoff(environment);
  if (mode === 'restore') {
    if (externalSchema) throw new Error('Restore requires a separate maintenance process; external runtime credentials cannot restore.');
    const runtime = await loadRestore();
    return runtime.startRestoreServer({ database });
  }
  if (typeof onAdmissionLost !== 'function') throw new Error('Normal startup requires a fail-stop handler.');
  const routing = await loadRouting(environment);
  const closeRouting = bindOllamaRoutingLifetime(routing, processRef);
  const startNormal = async () => {
    const admission = await acquireAdmission({ database, onLost: routing ? () => { closeRouting(); onAdmissionLost(); } : onAdmissionLost,
      ...(externalSchema || supervisedSchema ? { seedMissingGate: async () => false } : {}) });
    processRef.once('exit', admission.release);
    admission.assertHealthy();
    if (externalSchema) {
      await verifySchema({ database, environment });
      admission.assertHealthy();
    }
    if (supervisedSchema) {
      await verifySupervisedSchema({ database });
      admission.assertHealthy();
    }
    // Normal service constructors must not run before admission or after cancellation.
    routing?.run(() => {});
    const runtime = await loadNormal();
    admission.assertHealthy();
    routing?.run(() => {});
    runtime.registerServerProcessHandlers();
    const server = await runtime.startServer({ database });
    server?.once?.('close', closeRouting);
    try { routing?.run(() => {}); }
    catch (error) { server?.close?.(); throw error; }
    return server;
  };
  try { return await (routing ? routing.run(startNormal) : startNormal()); }
  catch (error) { closeRouting(); throw error; }
}
