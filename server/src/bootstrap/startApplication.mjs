/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { readOperatingMode } from '../config/operatingMode.mjs';
import { acquireNormalRuntimeAdmission } from './runtimeAdmission.mjs';

export async function startApplication({
  database,
  environment = process.env,
  processRef = process,
  acquireAdmission = acquireNormalRuntimeAdmission,
  onAdmissionLost,
  loadNormal = () => import('./normalRuntime.mjs'),
  loadRestore = () => import('./restoreRuntime.mjs'),
}) {
  const mode = readOperatingMode(environment);
  if (mode === 'restore') {
    const runtime = await loadRestore();
    return runtime.startRestoreServer({ database });
  }
  if (typeof onAdmissionLost !== 'function') throw new Error('Normal startup requires a fail-stop handler.');
  const admission = await acquireAdmission({ database, onLost: onAdmissionLost });
  processRef.once('exit', admission.release);
  admission.assertHealthy();
  // Normal service constructors must not run before admission.
  const runtime = await loadNormal();
  admission.assertHealthy();
  runtime.registerServerProcessHandlers();
  return runtime.startServer({ database });
}
