/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validVerificationInput } from '../../services/discordDeliveryVerificationContract.mjs';
import { createDiscordDeliveryRepository } from '../../services/discordDeliveryRepository.mjs';
import { createDiscordDeliveryVerificationRepository } from '../../services/discordDeliveryVerificationRepository.mjs';
import { createDiscordDeliveryVerificationReader } from '../../services/discordDeliveryVerificationReader.mjs';
import { createDiscordDeliveryVerificationService } from '../../services/discordDeliveryVerificationService.mjs';
import { createDiscordProviderCooldown } from '../../services/discordProviderCooldown.mjs';
import { createDiscordProviderGate } from '../../services/discordProviderGate.mjs';

export function createDiscordDeliveryVerificationHandler(db, logger,
  gate = createDiscordProviderGate({ cooldown: createDiscordProviderCooldown(db) })) {
  const verify = createDiscordDeliveryVerificationService({
    repository: createDiscordDeliveryVerificationRepository(db),
    deliveries: createDiscordDeliveryRepository(db),
    read: createDiscordDeliveryVerificationReader({ gate }), logger,
  });
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!validVerificationInput(req.params.classificationId, req.body)) {
      return res.status(400).json({ code: 'invalid_input' });
    }
    const controller = new AbortController();
    const cancel = () => controller.abort();
    res.once('close', cancel);
    try {
      const result = await verify(req.params.classificationId, req.body.messageId, controller.signal);
      if (controller.signal.aborted) return;
      const status = result.code === 'confirmed' ? 200
        : ['cooldown', 'rate_limited', 'busy'].includes(result.code) ? 429
          : result.code === 'verification_unavailable' ? 503 : 409;
      if (result.retryAfterSeconds != null) res.set('Retry-After', String(result.retryAfterSeconds));
      return res.status(status).json(result);
    } finally {
      res.removeListener('close', cancel);
    }
  };
}
