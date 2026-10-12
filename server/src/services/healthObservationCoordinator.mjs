/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createDefaultHealthCache } from './healthCheckServiceShared.mjs';
import { createHealthConfigurationGuard } from './healthConfigurationGuard.mjs';
import { buildUnknownHealthState } from './healthConfigurationRead.mjs';

/** Share admission per service; only the current generation can publish or alert. */
export function createHealthObservationCoordinator() {
    let cache = createDefaultHealthCache();
    let flights = new Map();
    let watches = new Map();
    let epochs = new Map();
    let reconciliation = null;
    let version = 0;
    return {
        snapshot: () => ({ ...cache }),
        version: () => version,
        reset() {
            cache = createDefaultHealthCache();
            flights = new Map();
            watches = new Map();
            epochs = new Map();
            version += 1;
        },
        reconcile() {
            if (reconciliation) return reconciliation;
            const generation = watches;
            const entries = [...watches];
            let next = 0;
            const worker = async () => {
                while (next < entries.length && generation === watches) {
                    const [service, watch] = entries[next++];
                    if (watches.get(service) !== watch) continue;
                    let result;
                    try {
                        result = await watch.guard.validate(watch.observation, { reconcile: true });
                    } catch (_error) {
                        result = { ...buildUnknownHealthState(watch.observation, service), lastCheck: watch.observation.lastCheck };
                    }
                    if (generation !== watches || watches.get(service) !== watch || result === watch.observation) continue;
                    cache[service] = result;
                    watches.delete(service);
                    epochs.set(service, (epochs.get(service) ?? 0) + 1);
                    version += 1;
                }
            };
            // Keep admission occupied across reset until existing reads settle.
            const pending = Promise.all([worker(), worker()]).finally(() => {
                reconciliation = null;
            });
            reconciliation = pending;
            return pending;
        },
        run(service, compute, onAccepted = (_previous, _result) => {}) {
            if (!Object.hasOwn(cache, service)) throw new RangeError('Unknown health service');
            if (flights.has(service)) return flights.get(service);
            const generation = flights;
            const epoch = epochs.get(service) ?? 0;
            const isCurrent = () => generation === flights && epoch === (epochs.get(service) ?? 0);
            const previous = { ...cache[service] };
            const guard = createHealthConfigurationGuard(previous, service);
            const pending = Promise.resolve().then(async () => {
                let result;
                try {
                    result = await compute(previous, guard);
                    if (isCurrent()) result = await guard.validate(result);
                } catch (_error) {
                    result = buildUnknownHealthState(previous, service);
                }
                if (isCurrent()) {
                    cache[service] = result;
                    // A provider failure still describes validly read settings. Keep
                    // watching them so a saved correction retires the old diagnosis.
                    const watchable = !result.failure || ['connection_probe', 'connection_configuration', 'request_admission'].includes(result.failure.stage);
                    if (guard.hasCapture() && watchable) watches.set(service, { guard, observation: result });
                    else watches.delete(service);
                    version += 1;
                    onAccepted(previous, result);
                }
                return cache[service];
            }).finally(() => {
                // Never delete a replacement generation's work.
                if (generation === flights) flights.delete(service);
            });
            flights.set(service, pending);
            return pending;
        },
    };
}
