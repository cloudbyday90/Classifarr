/*
 * Classifarr - Copyright (C) 2024-2026 Classifarr Contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { createLogger } from '../utils/logger.mjs';
import { classificationRetryService } from './classificationRetryService.mjs';
import { AutomaticClassificationRecoveryRepository } from './automaticClassificationRecoveryRepository.mjs';
import { ClassificationRecoveryReadiness } from './classificationRecoveryReadiness.mjs';
import { AUTOMATIC_RECOVERY_TASK_SOURCE } from './automaticClassificationRecoveryPolicy.mjs';

export class AutomaticClassificationRecoveryService {
  constructor({ repository = new AutomaticClassificationRecoveryRepository(),
    readiness = new ClassificationRecoveryReadiness(), retryService = classificationRetryService,
    logger = createLogger('AutomaticClassificationRecovery'),
  } = {}) {
    Object.assign(this, { repository, readiness, retryService, logger });
  }

  async run() {
    let queued = 0;
    try {
      const candidates = await this.repository.findDue();
      if (candidates.length === 0) return { state: 'idle', queued: 0 };
      const lease = await this.repository.claimProbe();
      if (!lease) return { state: 'cooldown', queued: 0 };

      const snapshot = await this.repository.loadConfiguration();
      // Provider I/O is outside all database transactions; cooldown already survives a crash.
      let proof = null;
      try { proof = await this.readiness.probe(snapshot); } catch { /* unavailable; never log provider bodies */ }
      if (!proof) {
        await this.repository.completeProbe(lease, 'unavailable');
        this.logger.debug('Automatic classification recovery waits for generation readiness');
        return { state: 'unavailable', queued: 0 };
      }

      let configurationChanged = false;
      for (const candidate of candidates) {
        const result = await this.retryService.retrySingle({
          classificationId: candidate.id, actor: 'scheduler', correlationId: lease,
          taskSource: AUTOMATIC_RECOVERY_TASK_SOURCE,
          metadataEnrichmentSource: 'provider_recovery_followup',
          route: 'scheduler:provider-recovery',
          retryEligibilityCheck: ({ client, classification }) => this.repository.checkReadiness(client, proof, lease, classification),
        });
        if (result.queued) queued += 1;
        if (result.reasonCode === 'recovery_configuration_changed') {
          configurationChanged = true;
          break;
        }
        if (result.reasonCode === 'recovery_readiness_expired' || result.reasonCode === 'recovery_lease_expired') break;
      }
      const state = configurationChanged ? 'configuration_changed' : 'ready';
      await this.repository.completeProbe(lease, state);
      if (queued > 0) this.logger.info('Exhausted classifications resumed after generation check', { queued });
      return { state, queued };
    } catch {
      this.logger.warn('Automatic classification recovery could not complete; scheduled recovery will retry',
        { reasonCode: 'recovery_processing_failed' },
        { dedupeKey: 'automatic-classification-recovery', dedupeWindowMs: 15 * 60 * 1000 });
      return { state: 'failed', queued };
    }
  }
}

export const automaticClassificationRecoveryService = new AutomaticClassificationRecoveryService();
