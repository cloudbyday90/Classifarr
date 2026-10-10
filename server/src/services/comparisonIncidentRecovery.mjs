/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { COMPARISON_WARNING, MAX_COMPARISON_INCIDENT_IDS, isIncidentId } from './comparisonIncidentRepository.mjs';

/** One scheduler owns a bounded episode. No module-wide or historical reconciliation. */
export function createComparisonIncidentRecovery({ log, repository }) {
  let episode = null, stopped = false;
  const select = scopeId => {
    if (stopped || !isIncidentId(scopeId)) { episode = null; return null; }
    if (episode?.scopeId !== scopeId) episode = { scopeId, episodeId: randomUUID(), ids: new Set(), resolutionDeferred: false };
    return episode;
  };
  return {
    stop() { stopped = true; episode = null; },
    reset() { episode = null; },
    async warn(diagnostic, scopeId) {
      if (stopped) return;
      const current = select(scopeId);
      const tracked = current && current.ids.size < MAX_COMPARISON_INCIDENT_IDS;
      const comparisonIncident = tracked ? { version: 1, episodeId: current.episodeId, scopeId } : null;
      try {
        const id = await log.warn(COMPARISON_WARNING, { ...diagnostic, ...(comparisonIncident ? { comparisonIncident } : {}) });
        if (tracked && episode === current && !stopped && isIncidentId(id)) current.ids.add(id);
      } catch { /* Logging failure must not turn an optional refresh into a failed job. */ }
    },
    async recover(report, scopeId) {
      if (!['ready', 'revalidated'].includes(report.status) || stopped) return null;
      const current = select(scopeId);
      if (!current?.ids.size) return null;
      try {
        const resolved = await repository.resolve({ episodeId: current.episodeId, scopeId,
          errorIds: [...current.ids], status: report.status, isCurrent: () => !stopped && episode === current });
        if (stopped || episode !== current) return null;
        episode = null;
        return { episodeId: current.episodeId, scopeId, resolvedCount: resolved.length };
      } catch {
        // Retry only after another verified refresh; exact IDs make an ambiguous commit safe.
        if (!stopped && episode === current && !current.resolutionDeferred) {
          current.resolutionDeferred = true;
          try {
            log.info?.('Library comparison warning resolution deferred until the next verified refresh', {
              code: 'comparison_resolution_deferred', episodeId: current.episodeId, scopeId,
            });
          } catch { /* Never recurse into logging or alter the refresh result. */ }
        }
        return null;
      }
    },
  };
}
