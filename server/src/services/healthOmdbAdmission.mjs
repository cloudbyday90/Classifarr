/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { reserveOmdbQuota } from './omdbQuotaStore.mjs';
import { providerCredentialContext } from './providerCredentialRejection.mjs';
import { probeOmdbConnection } from './healthMetadataProbe.mjs';
import { measureConnectionProbe, buildConnectionProbeHealthState } from './healthConnectionProbe.mjs';
import { buildStatusHealthState } from './healthCheckServiceShared.mjs';

const outcomes = new Map([
    ['limit_reached', ['local_quota_exhausted', 'Health check skipped: the local OMDb daily request budget is used up. Wait for the next budget period, or review the limit in OMDb settings.']],
    ['paced', ['provider_wait', 'Health check deferred to respect OMDb request pacing. Wait for the next heartbeat, or refresh health after other OMDb requests finish.']],
    ['credentials_rejected', ['credentials_rejected', 'Health check skipped: the saved OMDb key was previously rejected. Review OMDb settings and credential-recovery diagnostics.']],
    ['lookup_restart', ['configuration_changed', 'OMDb settings changed before this check could start. Refresh health, or wait for the next heartbeat.']],
    ['not_configured', ['configuration_changed', 'OMDb was disabled or its key was removed before this check could start. Refresh health to read the current settings.']],
    ['invalid_configuration', ['admission_configuration_invalid', 'Health check skipped: OMDb request-budget settings are invalid. Review OMDb settings; if this persists, open a Classifarr issue.']],
]);
const unavailable = ['admission_unavailable', 'Health check skipped: the OMDb request budget could not be reserved. Check Database health and startup logs, then refresh health.'];

function deferred(previous, status) {
    const [code, error] = outcomes.get(status) ?? unavailable;
    return buildStatusHealthState(previous, 'unknown', {
        responseTime: null, error, failure: { stage: 'request_admission', code },
    });
}

/** Saved health attempts share lookup admission. No HTTP before confirmed commit. */
export function createOmdbHealthAdmission({ db, reserve = reserveOmdbQuota, probe = probeOmdbConnection }) {
    return async (previous, config) => {
        const expectedContext = providerCredentialContext('omdb', config);
        if (!expectedContext) return deferred(previous, 'invalid_configuration');
        let admission;
        try {
            admission = await reserve(db, { pacing: true, expectedContext });
        } catch (_error) {
            // Uncertain commit/timeout is not permission to send or refund a request.
            return deferred(previous, 'unavailable');
        }
        if (admission?.status !== 'reserved') return deferred(previous, admission?.status);
        const result = await measureConnectionProbe(() => probe(admission.apiKey));
        return buildConnectionProbeHealthState(previous, result);
    };
}
