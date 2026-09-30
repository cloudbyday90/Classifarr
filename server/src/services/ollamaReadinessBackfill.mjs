/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { backgroundResourceAdmission } from './backgroundResourceAdmission.mjs';
import { readInventoryBackgroundReadiness } from './inventoryBackgroundReadiness.mjs';
import { resolveOllamaVerificationCapabilityIdentity } from './ollamaVerificationCapabilityIdentity.mjs';
import { loadOllamaVerificationCapabilityConfiguration, persistOllamaVerificationCapabilityProbe } from './ollamaVerificationCapabilityRepository.mjs';
import { probeOllamaVerificationCapability } from './ollamaVerificationCapabilityProbe.mjs';
import { createOllamaVerificationSavedConfigurationClient } from './ollamaVerificationSavedConfigurationClient.mjs';
import { recordOllamaVerificationCapabilityOutcomeHistory } from './ollamaVerificationCapabilityOutcomeHistoryRepository.mjs';
import { createLogger } from '../utils/logger.mjs';

function eligibility(configuration) {
  if (configuration?.primary_provider !== 'ollama') return 'not_applicable';
  if (configuration.ollama_verification_capability_checked_at != null) return 'already_checked';
  if (![configuration.ollama_host, configuration.ollama_model]
    .every(value => typeof value === 'string' && value.trim())) return 'waiting_for_configuration';
  return null;
}

/** Missing-result sweep only. No timers, migrations, media prompts or routing writes. */
export function createOllamaReadinessBackfill({ database = db, admission = backgroundResourceAdmission,
  load = loadOllamaVerificationCapabilityConfiguration, readiness = readInventoryBackgroundReadiness,
  createClient = createOllamaVerificationSavedConfigurationClient, probe = probeOllamaVerificationCapability,
  persist = persistOllamaVerificationCapabilityProbe, history = recordOllamaVerificationCapabilityOutcomeHistory,
  logger = createLogger('OllamaReadinessBackfill') } = {}) {
  let stopped = false, active = null;
  const deferred = reason => ({ status: 'deferred', reason });
  async function runOnce() {
    try {
      let reason = eligibility(await load(database));
      if (stopped) return { status: 'stopped' };
      if (reason) return deferred(reason);
      if (database.pool?.options?.max === 1) return deferred('database_capacity');
      reason = await readiness(database, { requireRag: false });
      if (stopped) return { status: 'stopped' };
      if (reason !== 'ready') return deferred(reason);
      const permit = admission.tryAcquire('discovery');
      if (!permit.allowed) return deferred(permit.reason);
      try {
        let result;
        const execute = async ({ signal }) => {
          const cancelled = () => stopped || signal.aborted;
          if (cancelled()) return { status: 'stopped' };
          const configuration = await load(database);
          const skip = eligibility(configuration);
          if (skip) return deferred(skip);
          const state = await readiness(database, { requireRag: false });
          if (cancelled()) return { status: 'stopped' };
          if (state !== 'ready') return deferred(state);
          const identity = resolveOllamaVerificationCapabilityIdentity(configuration);
          const client = createClient({ configuration });
          const assertActive = () => { if (cancelled()) throw new Error('readiness_backfill_stopped'); };
          const ollamaClient = {
            preflightConnection(options) { assertActive(); return client.preflightConnection({ ...options, connectivityTimeoutMs: 5000 }); },
            generate(prompt, model, temperature, options) {
              assertActive(); return client.generate(prompt, model, temperature, { ...options, timeoutMs: 60000 });
            },
          };
          const outcome = await probe({ identity, ollamaClient });
          if (cancelled()) return { status: 'stopped' };
          const saved = await database.withTransaction(async transaction => {
            await transaction.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'; SET LOCAL transaction_timeout='10s'");
            assertActive();
            const result = await persist({ client: transaction, identity, outcome, onlyIfNeverChecked: true });
            assertActive();
            return result;
          });
          if (!saved) return deferred('already_checked');
          try { await history(database, outcome.statusId); }
          catch { logger.warn('AI readiness history unavailable', { reason: 'history_unavailable' }); }
          return { status: 'completed', readiness: outcome.statusId };
        };
        const acquired = await database.withSessionAdvisoryLock(db.DB_ADVISORY_LOCKS.OLLAMA_READINESS_BACKFILL,
          async lease => { result = await execute(lease); });
        return acquired ? result : deferred('busy');
      } finally { permit.release(); }
    } catch (error) {
      if (stopped) return { status: 'stopped' };
      if (error?.code === 'ollama_verification_capability_configuration_changed') return deferred('configuration_changed');
      return { status: 'failed', reason: 'readiness_backfill_unavailable' };
    }
  }
  return {
    stop() { stopped = true; },
    run() {
      if (stopped) return Promise.resolve({ status: 'stopped' });
      active ??= runOnce().finally(() => { active = null; });
      return active;
    },
  };
}
