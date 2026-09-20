/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createLogger } from '../utils/logger.mjs';
import { AutomaticClassificationRecoveryRepository } from './automaticClassificationRecoveryRepository.mjs';
import { ClassificationProviderCircuitRepository } from './classificationProviderCircuitRepository.mjs';
import { getAutomaticRecoveryErrorCode } from './automaticClassificationRecoveryPolicy.mjs';
import { aiRouterService } from './aiRouter.mjs';
import { buildClassificationDependencyKey, createProviderDeferredError,
  hasProviderConfigurationRevision, isProviderDeferredError } from './classificationProviderDeferralPolicy.mjs';

export class ClassificationProviderAdmissionService {
  constructor({ repository = new ClassificationProviderCircuitRepository(),
    configuration = new AutomaticClassificationRecoveryRepository(), logger = createLogger('ClassificationProviderAdmission'),
    router = aiRouterService,
  } = {}) { Object.assign(this, { repository, configuration, logger, router }); }

  async getCurrentDependencyKey() {
    try {
      const snapshot = await this.configuration.loadConfiguration();
      const provider = await this.router.getProvider('classification', { configuration: snapshot.config });
      return buildClassificationDependencyKey(snapshot, provider) || '';
    } catch { this.warn(); return null; }
  }

  warn() {
    this.logger.warn('AI provider admission state is unavailable; classification will wait',
      { reasonCode: 'provider_admission_state_unavailable' },
      { dedupeKey: 'provider-admission-state', dedupeWindowMs: 15 * 60 * 1000 });
  }

  async admit(config, provider) {
    if (!hasProviderConfigurationRevision(config)) return null;
    try {
      const snapshot = await this.configuration.loadConfiguration();
      if (String(snapshot.config.configuration_revision) !== String(config.configuration_revision)) throw createProviderDeferredError();
      const key = buildClassificationDependencyKey(snapshot, provider);
      // An incomplete configuration is not proof of an outage. Preserve the
      // existing finite model/configuration failure path instead of waiting forever.
      if (!key) return null;
      const ticket = await this.repository.admit(key);
      if (!ticket) throw createProviderDeferredError();
      return ticket;
    } catch (error) {
      if (!isProviderDeferredError(error)) this.warn();
      throw createProviderDeferredError();
    }
  }

  async failed(ticket, error) {
    const code = getAutomaticRecoveryErrorCode(error);
    if (!ticket || !code) return false;
    try {
      const changed = await this.repository.open(ticket, code);
      if (changed) this.logger.info('AI provider outage detected; dependent classifications will wait', { reasonCode: code });
      return true;
    } catch { this.warn(); return false; }
  }

  async succeeded(ticket) {
    if (!ticket) return;
    try {
      if (await this.repository.close(ticket)) this.logger.info('AI provider recovered; normal classification resumed');
    } catch { this.warn(); }
  }
}

export const classificationProviderAdmissionService = new ClassificationProviderAdmissionService();
