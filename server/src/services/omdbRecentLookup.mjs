/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { providerCredentialContext } from './providerCredentialRejection.mjs';

const lifetimeMs = 60_000;
const fixedEndpoints = new Set(['https://www.omdbapi.com', 'https://www.omdbapi.com/']);

/** One process-local observation, not a response cache or retry authority. */
export function createOmdbRecentLookup({ clock = Date.now, monotonic = () => performance.now() } = {}) {
    let observation = null;
    let completedAt = 0;
    let epoch = Symbol();
    let active = 0;
    const invalidate = () => { observation = null; epoch = Symbol(); };
    return {
        invalidate,
        begin(context, endpoint = undefined) {
            const overlapping = active > 0;
            invalidate();
            const token = epoch;
            const startedAt = monotonic();
            const credential = context?.source === 'omdb' ? providerCredentialContext('omdb', {
                id: context.id, credential_generation: context.generation,
            }) : null;
            active++;
            let settled = false;
            // Default completion is failure. Calling twice never changes the result.
            return (kind = 'unavailable') => {
                if (settled) return;
                settled = true;
                active--;
                if (overlapping || active || token !== epoch || !credential || !fixedEndpoints.has(endpoint) ||
                    !['success', 'not_found'].includes(kind)) return;
                const now = monotonic();
                const wall = clock();
                const duration = now - startedAt;
                if (!Number.isFinite(duration) || duration < 0 || !Number.isFinite(wall) ||
                    !Number.isFinite(new Date(wall).getTime())) return;
                completedAt = now;
                observation = Object.freeze({ id: credential.id, generation: credential.generation.toLowerCase(),
                    kind, lastCheck: new Date(wall).toISOString(), responseTime: Math.round(duration) });
            };
        },
        read(context) {
            if (!observation || active || context?.source !== 'omdb' || context.id !== observation.id ||
                typeof context.generation !== 'string' || context.generation.toLowerCase() !== observation.generation) return null;
            const age = monotonic() - completedAt;
            const wallAge = clock() - Date.parse(observation.lastCheck);
            if (![age, wallAge].every(value => Number.isFinite(value) && value >= 0 && value < lifetimeMs)) {
                invalidate();
                return null;
            }
            return observation;
        },
    };
}

export const omdbRecentLookup = createOmdbRecentLookup();
