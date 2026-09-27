/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createInventoryCredentialWakeupRepository } from './inventoryCredentialWakeupRepository.mjs';
import { verifyInventoryCredential, inventoryCredentialProbeDelay } from './inventoryCredentialProbe.mjs';

export function createInventoryCredentialWakeupService({ db, logger, verify = verifyInventoryCredential,
    repository = createInventoryCredentialWakeupRepository(db) }) {
    let running = null;
    async function run() {
        try {
            const claim = await repository.claim();
            if (claim) {
                const outcome = await verify(claim.api_key);
                const accepted = await repository.finish(claim, outcome,
                    inventoryCredentialProbeDelay(claim.probe_failures, outcome.retryAfterMs));
                if (accepted && !outcome.verified && (claim.probe_failures === 0 || claim.last_failure_category !== outcome.category)) {
                    logger?.warn?.('TMDb credential recovery verification deferred', { category: outcome.category,
                        recovery: 'Check the saved TMDb credential and connectivity. Scheduled verification will retry; item cooldowns are unchanged.' });
                }
            }
            const result = await repository.release();
            if (result?.released) logger?.info?.('TMDb authentication recovery cases made eligible', result);
            return result ?? { released: 0 };
        } catch {
            // This optional accelerator must not stop ordinary queue refill or leak DB/provider errors.
            logger?.debug?.('TMDb credential recovery wakeup deferred; ordinary refill continues');
            return { released: 0, deferred: true };
        }
    }
    return { run() {
        if (!running) running = run().finally(() => { running = null; });
        return running;
    } };
}
