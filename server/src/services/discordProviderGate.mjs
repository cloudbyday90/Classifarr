/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { DiscordDeliveryDeferredError } from './discordProviderCooldown.mjs';
import { verificationRetrySeconds } from './discordDeliveryVerificationContract.mjs';
import { DiscordRestError } from './discordRestResponse.mjs';

const unavailable = () => new DiscordRestError('DISCORD_COOLDOWN_UNAVAILABLE', 'Discord cooldown unavailable');

/** One bounded, on-demand gate shared by all bot HTTP consumers in a process. */
export function createDiscordProviderGate({ cooldown, warn = () => {}, maxConcurrent = 16 }) {
  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1) throw new TypeError('Invalid Discord gate limit');
  let active = 0;
  let pending = null;
  let warned = false;
  const persist = async () => {
    const observation = pending;
    try {
      const result = await cooldown.defer(observation.seconds);
      if (pending === observation) { pending = null; warned = false; }
      return result;
    } catch {
      if (pending && !warned) { warned = true; warn(); }
      throw unavailable();
    }
  };
  const observe = seconds => {
    const normalized = verificationRetrySeconds(seconds);
    pending = { seconds: !pending ? normalized : pending.seconds === null || normalized === null
      ? null : Math.max(pending.seconds, normalized) };
    return persist();
  };
  const bounded = async fn => {
    if (active >= maxConcurrent) throw new DiscordRestError('DISCORD_REST_BUSY', 'Discord request capacity reached');
    active += 1;
    try { return await fn(); } finally { active -= 1; }
  };
  return {
    defer: seconds => bounded(async () => {
      const result = await observe(seconds);
      throw new DiscordDeliveryDeferredError(result.retryAfterSeconds);
    }),
    run: (request, url, init) => bounded(async () => {
      init.signal?.throwIfAborted();
      if (pending) await persist();
      // An overlapping, newer observation still needs its own durable save.
      if (pending) throw unavailable();
      let waiting;
      try { waiting = await cooldown.read(); } catch { throw unavailable(); }
      if (waiting) throw new DiscordDeliveryDeferredError(waiting.retryAfterSeconds);
      if (pending) throw unavailable();
      init.signal?.throwIfAborted();
      const response = await request(url, init);
      if (response.status === 429) {
        const body = await response.json().catch(() => null);
        const result = await observe(response.headers.get('retry-after') ?? body?.retry_after);
        throw new DiscordDeliveryDeferredError(result.retryAfterSeconds);
      }
      if (response.headers.get('x-ratelimit-remaining') === '0') {
        // Errors consume quota too. Preserve the original result, including a
        // permanent refusal, even if the separate observation cannot be saved.
        await observe(response.headers.get('x-ratelimit-reset-after')).catch(() => {}); // swallow-error: persist already warns and retains the hold; preserve the provider result.
      }
      return response;
    }),
  };
}
