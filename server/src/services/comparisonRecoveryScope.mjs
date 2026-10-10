/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';

/** Private configuration/representation keys never leave this runtime-owned scope. */
export function createComparisonRecoveryScope() {
  let configuration = null, representation = null, scope = null, observed = null;
  return {
    begin() { observed = null; },
    configure(key) {
      if (configuration !== key) {
        configuration = key; representation = null; scope = key ? randomUUID() : null;
      }
      observed = scope;
    },
    identify(identity) {
      const key = JSON.stringify([identity.provider, identity.model, identity.digest, identity.dimensions]);
      if (representation !== null && representation !== key) scope = randomUUID();
      representation = key; observed = scope;
    },
    current() { return observed; },
    clear() { configuration = null; representation = null; scope = null; observed = null; },
  };
}
