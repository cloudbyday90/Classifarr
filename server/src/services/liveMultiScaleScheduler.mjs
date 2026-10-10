/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createInventoryRepresentativeProfileRepository } from './inventoryRepresentativeProfileRepository.mjs';
import { createInventoryDescriptionRefreshRepository } from './inventoryDescriptionRefreshRepository.mjs';
import { createLocalStudyEmbeddingClient } from './localStudyEmbeddingClient.mjs';
import { getInventoryDescriptionRefreshRevision } from './inventoryDescriptionRefreshSignal.mjs';
import { createLiveMultiScaleRefresh } from './liveMultiScaleRefresh.mjs';
import { installLiveMultiScaleContext } from './liveMultiScaleRuntime.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { withInventoryBackgroundReadiness } from './inventoryBackgroundReadiness.mjs';
import { describeLiveMultiScaleRetry } from './liveMultiScaleDiagnostics.mjs';
import { diagnoseLiveMultiScaleFailure } from './liveMultiScaleFailure.mjs';
import { createComparisonMemoryEvidence, describeComparisonMemoryEvidence } from './comparisonMemoryEvidence.mjs';
import { createComparisonIncidentRecovery } from './comparisonIncidentRecovery.mjs';
import { createComparisonIncidentRepository } from './comparisonIncidentRepository.mjs';

export function createLiveMultiScaleRuntime(database = db) {
  return withInventoryBackgroundReadiness(createLiveMultiScaleRefresh({ repository: createInventoryRepresentativeProfileRepository(database),
    memoryEvidence: createComparisonMemoryEvidence(),
    withAdmission: createInventoryDiscoveryAdmission(database),
    readState: createInventoryDescriptionRefreshRepository(database).readState,
    createEmbedder: createLocalStudyEmbeddingClient, getRevision: getInventoryDescriptionRefreshRevision }), database,
    undefined, error => diagnoseLiveMultiScaleFailure('readiness', error));
}

export function registerLiveMultiScaleSchedule(scheduler, { worker = createLiveMultiScaleRuntime(),
  log = createLogger('LibraryComparisonContext'), incidentRepository = createComparisonIncidentRepository(db) } = {}) {
  scheduler.liveMultiScaleWorker?.stop();
  const disconnect = installLiveMultiScaleContext(worker);
  const incidents = createComparisonIncidentRecovery({ log, repository: incidentRepository });
  let last = null, lastScope = null, active = null, stopped = false;
  scheduler.liveMultiScaleWorker = { stop() { stopped = true; incidents.stop(); disconnect(); worker.stop(); } };
  const execute = async () => {
    const report = await worker.run();
    if (stopped) return report;
    const scope = report.failure?.stage === 'readiness' ? null : worker.getRecoveryScope?.() ?? null;
    if (scope !== lastScope || report.status === 'disabled' || report.reason === 'disabled') {
      incidents.reset(); last = null; lastScope = scope;
    }
    const recovery = await incidents.recover(report, scope);
    if (stopped) return report;
    const diagnostic = describeLiveMultiScaleRetry(report);
    const state = diagnostic ? `${diagnostic.status}:${diagnostic.reason}:${diagnostic.stage || ''}:${diagnostic.code || ''}`
      : ['ready', 'revalidated'].includes(report.status) ? 'ready' : null;
    if (state && state !== last) {
      if (diagnostic) {
        if (diagnostic.reason === 'busy') log.info('Library comparison context is waiting for other background work', diagnostic);
        else await incidents.warn(diagnostic, scope);
      } else if (last && last !== 'ready') {
        const memory = describeComparisonMemoryEvidence(report.memory);
        if (memory || recovery) log.info('Library comparison context recovered automatically', {
          ...(memory ? { memory } : {}), ...(recovery ? { comparisonRecovery: recovery } : {}),
        });
        else log.info('Library comparison context recovered automatically');
      }
      last = state;
    } else if (recovery) {
      log.info('Library comparison warning resolution recorded', { comparisonRecovery: recovery });
    }
    return report;
  };
  // Initial and periodic callbacks share ownership through warning persistence and resolution.
  const run = () => {
    if (stopped) return Promise.resolve({ status: 'stopped' });
    if (!active) active = execute().finally(() => { active = null; });
    return active;
  };
  scheduler.schedule('inventory-multi-scale-context', '45 * * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial('inventory-multi-scale-context', 180_000, run);
}
