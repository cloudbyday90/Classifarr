/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createDefaultHealthCache } from './healthCheckServiceShared.mjs';
import { createHealthConfigurationGuard } from './healthConfigurationGuard.mjs';
import { buildUnknownHealthState } from './healthConfigurationRead.mjs';

/** Share admission per service; only the current generation can publish or alert. */
export function createHealthObservationCoordinator() {
    let cache = createDefaultHealthCache();
    let flights = new Map();
    let version = 0;
    return {
        snapshot: () => ({ ...cache }),
        version: () => version,
        reset() {
            cache = createDefaultHealthCache();
            flights = new Map();
            version += 1;
        },
        run(service, compute, onAccepted = (_previous, _result) => {}) {
            if (!Object.hasOwn(cache, service)) throw new RangeError('Unknown health service');
            if (flights.has(service)) return flights.get(service);
            const generation = flights;
            const previous = { ...cache[service] };
            const guard = createHealthConfigurationGuard(previous, service);
            const pending = Promise.resolve().then(async () => {
                let result;
                try {
                    result = await compute(previous, guard);
                    if (generation === flights) result = await guard.validate(result);
                } catch (_error) {
                    result = buildUnknownHealthState(previous, service);
                }
                if (generation === flights) {
                    cache[service] = result;
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
