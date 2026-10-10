/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createComparisonIncidentLedger } from './comparisonIncidentLedger.mjs';
import { COMPARISON_WARNING } from './comparisonIncidentRepository.mjs';

export const COMPARISON_INCIDENT_LOCK = 0x43494e43;

/** Database ownership lasts through refresh, warning insertion and completion. */
export function createComparisonIncidentSession(database) {
  let persistenceDeferred = false;
  return async function withIncidentSession(callback, { worker, log, fallback, isCurrent }) {
    let result;
    const acquired = await database.withSessionAdvisoryLock(COMPARISON_INCIDENT_LOCK, async session => {
      worker.beginRecoveryObservation();
      let ledger = null, available = false;
      const defer = () => {
        if (persistenceDeferred) return;
        persistenceDeferred = true;
        try { log.info('Library comparison incident persistence deferred', { code: 'comparison_resolution_deferred' }); }
        catch { /* Reporting must not alter refresh correctness. */ }
      };
      // A telemetry outage does not disable ordinary retrieval or the existing memory safeguards.
      try { ledger = await createComparisonIncidentLedger(session, isCurrent); } catch { defer(); }
      const incidents = {
        reset: () => fallback.reset(),
        async prepare(report) {
          if (!ledger) return;
          try {
            await ledger.prepare(worker.getRecoveryFingerprint(ledger.secret),
              report.status === 'disabled' || report.reason === 'disabled');
            available = true;
          } catch { available = false; defer(); }
        },
        async warn(diagnostic, scope) {
          if (available) {
            try {
              const metadata = await ledger.warn(diagnostic);
              if (metadata) {
                persistenceDeferred = false;
                try { await log.warn(COMPARISON_WARNING, metadata, { skipDbPersist: true }); } catch { /* DB evidence is durable. */ }
                return;
              }
            } catch { defer(); }
          }
          await fallback.warn(diagnostic, scope);
        },
        async recover(report, scope) {
          let recovered = null;
          if (available) {
            try {
              recovered = await ledger.recover(report);
              if (recovered) persistenceDeferred = false;
            } catch { defer(); }
          }
          const local = await fallback.recover(report, scope);
          return recovered ?? local;
        },
      };
      session.signal.throwIfAborted();
      result = await callback({ signal: session.signal, incidents });
      session.signal.throwIfAborted();
    });
    return acquired ? result : { status: 'deferred', reason: 'busy' };
  };
}
