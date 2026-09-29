/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createProviderRecoveryProbeRepository } from './providerRecoveryProbeRepository.mjs';
import { verifyProviderRecovery } from './providerRecoveryProbeTransport.mjs';

export function createProviderRecoveryProbeService({ db, logger,
  repository = createProviderRecoveryProbeRepository(db), verify = verifyProviderRecovery }) {
  let active = null;
  async function run() {
    try {
      for (const candidate of await repository.candidates()) {
        const claim = await repository.claim(candidate);
        if (!claim) continue;
        let outcome;
        try { outcome = await verify(claim); }
        catch { outcome = { category: 'unavailable' }; }
        const accepted = await repository.finish(claim, outcome);
        const recovered = accepted && outcome.category === 'verified';
        if (recovered) logger?.info?.('Provider access verified; eligible enrichment can resume', {
          provider: claim.provider_key, recovery: 'Existing due times, quotas and item retry budgets remain unchanged.',
        });
        return { checked: 1, recovered: recovered ? 1 : 0 };
      }
      return { checked: 0, recovered: 0 };
    } catch {
      // Never leak provider/SQL errors or prevent ordinary healthy-provider work.
      logger?.debug?.('Provider recovery check deferred; ordinary enrichment continues');
      return { checked: 0, recovered: 0, deferred: true };
    }
  }
  return { run() { active ??= run().finally(() => { active = null; }); return active; } };
}
