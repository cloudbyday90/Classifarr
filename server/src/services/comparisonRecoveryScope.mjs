/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHmac, randomUUID } from 'node:crypto';

/** Private configuration/representation keys never leave this runtime-owned scope. */
export function createComparisonRecoveryScope() {
  let configuration = null, representation = null, scope = null, observed = null, verified = false;
  return {
    begin() { observed = null; verified = false; },
    configure(key) {
      if (configuration !== key) {
        configuration = key; representation = null; scope = key ? randomUUID() : null;
      }
      observed = scope;
    },
    identify(identity) {
      const key = JSON.stringify([identity.provider, identity.model, identity.digest, identity.dimensions]);
      if (representation !== null && representation !== key) scope = randomUUID();
      representation = key; observed = scope; verified = true;
    },
    current() { return observed; },
    fingerprint(secret) {
      if (!observed) return null;
      const digest = value => createHmac('sha256', secret).update(value).digest('hex');
      return { configuration: digest(`configuration:${configuration}`),
        representation: verified ? digest(`representation:${representation}`) : null };
    },
    clear() { configuration = null; representation = null; scope = null; observed = null; verified = false; },
  };
}
