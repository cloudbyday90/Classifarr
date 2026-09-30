/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { readOperatingMode } from '../config/operatingMode.mjs';
import { acquireNormalRuntimeAdmission } from './runtimeAdmission.mjs';
import { readSchemaMaintenanceMode } from '../config/schemaMaintenanceMode.mjs';
import { verifyRuntimeSchemaReadiness } from '../services/databaseSchemaReadiness.mjs';

export async function startApplication({
  database,
  environment = process.env,
  processRef = process,
  acquireAdmission = acquireNormalRuntimeAdmission,
  verifySchema = verifyRuntimeSchemaReadiness,
  onAdmissionLost,
  loadNormal = () => import('./normalRuntime.mjs'),
  loadRestore = () => import('./restoreRuntime.mjs'),
}) {
  const mode = readOperatingMode(environment);
  const externalSchema = readSchemaMaintenanceMode(environment) === 'external';
  if (mode === 'restore') {
    if (externalSchema) throw new Error('Restore requires a separate maintenance process; external runtime credentials cannot restore.');
    const runtime = await loadRestore();
    return runtime.startRestoreServer({ database });
  }
  if (typeof onAdmissionLost !== 'function') throw new Error('Normal startup requires a fail-stop handler.');
  const admission = await acquireAdmission({ database, onLost: onAdmissionLost,
    ...(externalSchema ? { seedMissingGate: async () => false } : {}) });
  processRef.once('exit', admission.release);
  admission.assertHealthy();
  if (externalSchema) {
    await verifySchema({ database, environment });
    admission.assertHealthy();
  }
  // Normal service constructors must not run before admission.
  const runtime = await loadNormal();
  admission.assertHealthy();
  runtime.registerServerProcessHandlers();
  return runtime.startServer({ database });
}
