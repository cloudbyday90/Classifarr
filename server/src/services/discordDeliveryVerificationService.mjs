/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function createDiscordDeliveryVerificationService({ repository, deliveries, read, logger }) {
  let active = false;
  return async (classificationId, messageId, signal) => {
    if (active) return { code: 'busy' };
    active = true;
    try {
      if (signal?.aborted) return { code: 'cancelled' };
      const admission = await repository.admit(classificationId);
      if (admission.code !== 'admitted') return admission;
      let result;
      try {
        result = signal?.aborted ? { code: 'cancelled' } : await read({ ...admission, messageId, signal });
        if (result.code === 'verified') {
          const completed = !signal?.aborted && await deliveries.complete({
            ...result.proof, verificationConfig: admission.config,
          });
          result = { code: completed ? 'confirmed' : signal?.aborted ? 'cancelled' : 'configuration_changed',
            ...(completed ? { messageId: result.proof.messageId } : {}) };
        }
      } catch {
        result = { code: 'verification_unavailable' };
      }
      await repository.finish(admission.operationId, result.code,
        result.code === 'rate_limited' ? result.retryAfterSeconds : 60);
      logger?.info('Discord delivery verification finished', { classificationId, code: result.code });
      return result;
    } catch {
      return { code: 'verification_unavailable' };
    } finally {
      active = false;
    }
  };
}
