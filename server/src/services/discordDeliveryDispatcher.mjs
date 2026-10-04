/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const cancelledReasons = new Set(['configuration_changed', 'classification_changed', 'classification_missing',
  'already_notified', 'delivery_attempts_exhausted', 'delivery_not_retained', 'delivery_rejected']);

export function createDiscordDeliveryDispatcher({ outbox, delivery, getContext, report = () => {}, timeoutMs = 45000 }) {
  const lifetime = new AbortController();
  let running = false;
  return {
    stop() { lifetime.abort(); },
    async run() {
      if (running || lifetime.signal.aborted) return { status: 'skipped' };
      running = true;
      const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(timeoutMs)]);
      const counts = { attempted: 0, delivered: 0, discarded: 0 };
      try {
        counts.discarded = await outbox.cleanup();
        const context = await getContext();
        if (!signal.aborted && context?.config?.enabled && context?.client) {
          const candidates = await outbox.candidates();
          for (const candidate of candidates.slice(0, 4)) {
            if (signal.aborted) break;
            if (candidate.configId !== context.config.id) {
              await outbox.discard(candidate.nonce); counts.discarded += 1; continue;
            }
            const result = await delivery.send({ ...context, ...candidate, dispatchNonce: candidate.nonce,
              channelId: context.config.channel_id, signal });
            counts.attempted += 1;
            if (result.sent) counts.delivered += 1;
            if (cancelledReasons.has(result.reason)) {
              await outbox.discard(candidate.nonce); counts.discarded += 1;
            }
            // The shared provider cooldown applies to every remaining candidate.
            if (result.reason === 'delivery_deferred') break;
          }
        }
        if (Object.values(counts).some(Boolean)) report(counts);
        return { status: signal.aborted ? 'cancelled' : 'complete', ...counts };
      } catch {
        return { status: 'failed', ...counts };
      } finally { running = false; }
    },
  };
}
