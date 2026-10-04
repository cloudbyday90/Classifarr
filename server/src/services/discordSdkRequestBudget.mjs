/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { DiscordRestError } from './discordRestResponse.mjs';

/** Bound SDK queue wait and retries, not just each socket attempt. */
export function bindDiscordSdkRequestBudget(rest, lifetime, { timeoutMs = 15000, maxConcurrent = 16 } = {}) {
  if (![timeoutMs, maxConcurrent].every(value => Number.isSafeInteger(value) && value > 0) || timeoutMs > 2147483647) {
    throw new TypeError('Invalid Discord request budget');
  }
  const request = rest.request.bind(rest);
  let active = 0;
  rest.request = async options => {
    if (lifetime.aborted || options.signal?.aborted) {
      throw new DiscordRestError('DISCORD_REST_CANCELLED', 'Discord request cancelled');
    }
    if (active >= maxConcurrent) throw new DiscordRestError('DISCORD_REST_BUSY', 'Discord request capacity reached');
    active += 1;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, lifetime, ...options.signal ? [options.signal] : []]);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await request({ ...options, signal });
    } catch (error) {
      if (signal.aborted) throw new DiscordRestError(controller.signal.aborted
        ? 'DISCORD_REST_DEADLINE' : 'DISCORD_REST_CANCELLED', 'Discord request cancelled or timed out');
      throw error;
    } finally { clearTimeout(timer); active -= 1; }
  };
}
