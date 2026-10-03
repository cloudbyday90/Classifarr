/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as defaultDb from '../config/database.mjs';
import { radarrService } from './radarr.mjs';
import { sonarrService } from './sonarr.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeArrId, verifyArrResource } from './arrResourceVerification.mjs';
import { createManualRoutingCheckRepository } from './manualRoutingCheckRepository.mjs';
import { routingProviderRevision } from './manualRoutingProviderGuard.mjs';
import { routingProviderFailure } from './arrLookupFailure.mjs';

const messages = {
  verified_present: 'Found in the saved destination. This does not prove which request added it.',
  not_present: 'Not found in the provider. No add was attempted; review before retrying.',
  mismatch: 'The provider item does not match the saved destination. Review it before retrying.',
  unavailable: 'Could not verify routing. Check the provider connection and try again later.',
  provider_auth_required: 'Provider access was rejected. Check its API key and permissions, then check routing again.',
  provider_configuration_required: 'Provider checks need review. Check the endpoint and provider settings, then check routing again.',
  not_eligible: 'No usable saved routing intent. Review this record in Radarr/Sonarr.',
  configuration_changed: 'Routing settings changed. Review the original destination before retrying.',
  changed: 'The record or settings changed during this check. Refresh History before checking again.',
  busy: 'A routing check is already running. Try again shortly.',
  not_found: 'Classification not found.',
  stopped: 'Routing check stopped. No media was added or moved.',
};
const response = (reason, recorded = false) => ({ reason, recorded, message: messages[reason] });

export function createManualRoutingCheckService({ db = defaultDb,
  providers = { radarr: radarrService, sonarr: sonarrService }, repository,
  logger = createLogger('ManualRoutingCheck'), now = () => new Date().toISOString() } = {}) {
  const records = repository || createManualRoutingCheckRepository({ db, providers });
  const active = new Set();
  return {
    async check(classificationId, { signal, expectedProviderRevision, onProviderResult } = {}) {
      const id = normalizeArrId(classificationId);
      if (!id) return response('not_found');
      if (active.size >= 2 || active.has(id)) return response('busy');
      active.add(id);
      try {
        if (signal?.aborted) return response('stopped');
        const context = await records.load(id);
        if (context.reason) return response(context.reason);
        if (expectedProviderRevision && routingProviderRevision(context) !== expectedProviderRevision) return response('changed');
        if (signal?.aborted) return response('stopped');
        const { intent, baseUrl, apiKey } = context;
        let reason, failure = null;
        try {
          const provider = providers[intent.arrType];
          const args = [baseUrl, apiKey, intent.identity];
          if (signal) args.push({ signal });
          const item = intent.arrType === 'radarr'
            ? await provider.getMovieByTmdbId(...args)
            : await provider.getSeriesByTvdbId(...args);
          reason = item === null ? 'not_present' : verifyArrResource(item, intent) ? 'verified_present' : 'mismatch';
        } catch (error) {
          failure = routingProviderFailure(error);
          reason = failure.kind === 'authentication' ? 'provider_auth_required'
            : failure.kind === 'configuration' ? 'provider_configuration_required' : 'unavailable';
        }
        if (signal?.aborted) return response('stopped');
        // Persist provider admission outcome even if the later item observation conflicts.
        if (onProviderResult) await onProviderResult(failure);
        const checkedAt = now();
        const recorded = await records.save(context, { version: 1, reason, checkedAt });
        logger.info('Manual routing check finished', { classificationId: id, reason, recorded });
        return recorded ? { ...response(reason, true), checkedAt } : response('changed');
      } catch {
        if (signal?.aborted) return response('stopped');
        logger.warn('Manual routing check unavailable', { classificationId: id });
        return response('unavailable');
      } finally { active.delete(id); }
    },
  };
}
