/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function createMemoryDescriptionIsolation(now = Date.now) {
  const records = new Map();
  const prefix = identity => JSON.stringify([identity.provider, identity.model, identity.digest, identity.dimensions]);
  const key = (identity, hash) => `${prefix(identity)}:${hash}`;
  return {
    records,
    async read(identity, hashes) {
      return new Map(hashes.map(hash => [hash, records.get(key(identity, hash))])
        .filter(([, row]) => row && row.expiresAt > now())
        .sort(([a, x], [b, y]) => x.retryAt - y.retryAt || a.localeCompare(b))
        .map(([hash, row]) => [hash, { attempts: row.attempts, due: row.retryAt <= now() }]));
    },
    async defer(identity, hashes, { attempts, delayMs, code }) {
      for (const hash of hashes) records.set(key(identity, hash), { attempts, code, retryAt: now() + delayMs, expiresAt: now() + 30 * 86400_000 });
    },
    async clear(identity, hashes) { for (const hash of hashes) records.delete(key(identity, hash)); },
    async pruneExpired() {
      for (const [hash, row] of [...records].slice(0, 1000)) if (row.expiresAt <= now()) records.delete(hash);
    },
  };
}
