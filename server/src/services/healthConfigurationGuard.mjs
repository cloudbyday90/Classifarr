/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHmac, randomBytes } from 'node:crypto';
import { readHealthConfiguration } from './healthConfigurationRead.mjs';
import { buildStatusHealthState } from './healthCheckServiceShared.mjs';

// Private process key: configuration fingerprints must never become public identifiers.
const fingerprintKey = randomBytes(32);

function fingerprint(rows) {
    const serialized = rows.map(row => JSON.stringify(row, (_key, value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
        }
        return value;
    })).sort();
    return createHmac('sha256', fingerprintKey).update(JSON.stringify(serialized)).digest('hex');
}

/** One observation owns one read callback and digest, never a retained row set. */
export function createHealthConfigurationGuard(previous, service) {
    let captured = null;
    return {
        capture(read, rows) {
            if (captured) throw new Error('Health configuration already captured');
            captured = { read, digest: fingerprint(rows) };
        },
        async validate(observation) {
            if (!captured) return observation;
            const result = await readHealthConfiguration(previous, service, captured.read);
            if (!result.ok) return result.health;
            if (fingerprint(result.rows) === captured.digest) return observation;
            return {
                ...buildStatusHealthState(previous, 'unknown'),
                responseTime: null,
                error: 'Settings changed while this health check was running. Refresh health to check the current settings, or wait for the next heartbeat.',
                failure: { stage: 'configuration_validation', code: 'configuration_changed' },
            };
        },
    };
}
