/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as database from '../config/database.mjs';
import { radarrService } from './radarr.mjs';
import { sonarrService } from './sonarr.mjs';
import { normalizeArrId } from './arrResourceVerification.mjs';
import { createManualRoutingCheckRepository } from './manualRoutingCheckRepository.mjs';
import { createManualRoutingCheckService } from './manualRoutingCheckService.mjs';
import { createManualRoutingCheckState } from './manualRoutingCheckState.mjs';
import { createManualRoutingProviderGuard, routingProviderRevision } from './manualRoutingProviderGuard.mjs';
import { createLogger } from '../utils/logger.mjs';

const reply = reason => ({ reason, recorded: false, message: {
  busy: 'A routing check is already running. Try again shortly.',
  cooldown: 'This item was checked recently. Wait before checking again.',
  off: 'Background checks are off or the three-check limit was reached.',
  stopped: 'Routing check stopped. No media was added or moved.',
  not_found: 'Classification not found.',
  not_eligible: 'No usable saved routing intent. Review this record in Radarr/Sonarr.',
  configuration_changed: 'Routing settings changed. Review the original destination.',
  unavailable: 'Could not check routing. Try again later.',
  provider_paused: 'Checks for this provider are paused. They will resume after its cooldown; no item check was used.',
  provider_auth_required: 'Provider access was rejected. Correct its API key or permissions, then check routing again after the cooldown.',
  provider_configuration_required: 'Provider checks need review. Correct its endpoint or settings, then check routing again after the cooldown.',
}[reason] });

export function createManualRoutingCheckCoordinator({ db = database,
  providers = { radarr: radarrService, sonarr: sonarrService }, records, state, checker, guard,
  logger = createLogger('ManualRoutingBackground') } = {}) {
  records ??= createManualRoutingCheckRepository({ db, providers });
  state ??= createManualRoutingCheckState({ db });
  checker ??= createManualRoutingCheckService({ db, providers, repository: records });
  guard ??= createManualRoutingProviderGuard({ db });
  async function read(id) {
    const result = await state.read(id);
    if (!result.enabled) return result;
    const context = await records.load(id);
    return { ...result, provider: context.reason ? null : await guard.read(context) };
  }
  return {
    read,
    next: () => state.next(),
    async setEnabled(id, enabled) {
      let attemptId = null;
      if (enabled) {
        const context = await records.load(id);
        if (context.reason) return reply(context.reason);
        attemptId = context.row.metadata.classification_details.manual_routing_attempt_id;
      }
      const result = await state.setEnabled(id, attemptId, enabled);
      logger.info('Background routing checks updated', { classificationId: id, enabled: result.enabled });
      return enabled ? read(id) : result;
    },
    async check(value, { automatic = false, signal } = {}) {
      const id = normalizeArrId(value);
      if (!id) return reply('not_found');
      let result = reply('busy');
      try {
        await db.withSessionAdvisoryLock(database.DB_ADVISORY_LOCKS.MANUAL_ROUTING_CHECK, async (lease = {}) => {
          const signals = [signal, lease.signal].filter(Boolean);
          const combined = signals.length ? AbortSignal.any(signals) : undefined;
          if (combined?.aborted) { result = reply('stopped'); return; }
          const context = await records.load(id);
          if (context.reason) {
            result = reply(context.reason);
            if (automatic) {
              await state.finish(id, context.reason);
              logger.info('Background routing checks stopped', { classificationId: id, reason: context.reason });
            }
            return;
          }
          if (combined?.aborted) { result = reply('stopped'); return; }
          const paused = await guard.prepare(context, automatic);
          if (paused) {
            if (automatic) await state.defer(id, paused.reason, paused.nextCheckAt);
            result = { ...reply(paused.reason), nextCheckAt: paused.nextCheckAt };
            return;
          }
          const claim = await state.claim(id, context.row.metadata.classification_details.manual_routing_attempt_id, automatic);
          if (!claim.admitted) {
            result = { ...reply(claim.reason), nextCheckAt: claim.nextCheckAt };
            if (automatic && claim.reason === 'not_eligible') {
              await state.finish(id, claim.reason);
              logger.info('Background routing checks stopped', { classificationId: id, reason: claim.reason });
            }
            return;
          }
          const reservationId = await guard.reserve(context);
          let providerFailure = false;
          result = await checker.check(id, { signal: combined, expectedProviderRevision: routingProviderRevision(context),
            onProviderResult: async failure => {
              if (combined?.aborted) throw new Error('Routing check stopped');
              await guard.finish(context, failure, reservationId);
              providerFailure = failure !== null;
            } });
          if (combined?.aborted) { result = reply('stopped'); return; }
          if (providerFailure) await state.finish(id, result.reason, { providerFailure, automatic });
          else await state.finish(id, result.reason);
        });
        return result;
      } catch {
        logger.warn('Routing check unavailable; any admitted check retains its cooldown', { classificationId: id });
        return reply('unavailable');
      }
    },
  };
}
