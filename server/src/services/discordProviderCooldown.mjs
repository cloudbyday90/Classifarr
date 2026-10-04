/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { verificationRetrySeconds } from './discordDeliveryVerificationContract.mjs';

export class DiscordDeliveryDeferredError extends Error {
  constructor(retryAfterSeconds) {
    super('Discord delivery deferred');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function readDiscordProviderCooldown(client) {
  const { rows: [row] } = await client.query(`SELECT CASE WHEN isfinite(next_allowed_at)
    THEN ceil(extract(epoch FROM next_allowed_at - clock_timestamp()))::integer
    ELSE NULL END AS seconds FROM discord_provider_cooldown
    WHERE singleton AND next_allowed_at > clock_timestamp()`);
  return row ? { code: 'rate_limited', retryAfterSeconds: row.seconds } : null;
}

export function createDiscordProviderCooldown(db) {
  const transaction = fn => db.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    return fn(client);
  });
  return {
    read: () => transaction(readDiscordProviderCooldown),
    defer(value) {
      const seconds = verificationRetrySeconds(value);
      return transaction(async client => {
        await client.query(`INSERT INTO discord_provider_cooldown (singleton, next_allowed_at)
          VALUES (true, CASE WHEN $1::integer IS NULL THEN 'infinity'::timestamptz
            ELSE clock_timestamp() + make_interval(secs => $1) END)
          ON CONFLICT (singleton) DO UPDATE SET
            next_allowed_at = greatest(discord_provider_cooldown.next_allowed_at, EXCLUDED.next_allowed_at),
            updated_at = clock_timestamp()`, [seconds]);
        return readDiscordProviderCooldown(client);
      });
    },
  };
}
