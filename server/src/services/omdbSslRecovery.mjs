/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { reserveOmdbQuota } from './omdbQuotaStore.mjs';
import { providerCredentialContext } from './providerCredentialRejection.mjs';
import { readHealthProbeJson } from './healthProbeRequest.mjs';
import { classifyOmdbResponse } from './omdbResponseClassifier.mjs';
import { isCertificateError } from './omdbHealth.mjs';
import { createOmdbPacingObserver } from './omdbPacingObservation.mjs';

const admissionCodes = new Set(['not_configured', 'credentials_rejected', 'invalid_configuration',
    'limit_reached', 'lookup_restart', 'paced']);
const probeCodes = new Set(['authentication', 'access_denied', 'quota_exhausted', 'rate_limited',
    'invalid_request', 'invalid_response', 'provider_error', 'transport_unavailable']);
const deferred = code => ({ status: 'deferred', code });

/** A confirmed miss also proves TLS recovery; it is not enrichment evidence. */
export function createOmdbSslProbe({ readJson = readHealthProbeJson } = {}) {
    /** @param {Parameters<typeof readHealthProbeJson>[2]} options */
    return async (apiKey, options = {}) => {
        const { observeResponse } = options;
        try {
            const data = await readJson('https://www.omdbapi.com/', {}, {
                params: { apikey: apiKey, t: 'Test' }, ...(observeResponse ? { observeResponse } : {}),
            });
            const outcome = classifyOmdbResponse(data, 200);
            return ['success', 'not_found'].includes(outcome.kind)
                ? { status: 'recovered', code: 'transport_verified' } : deferred(outcome.kind);
        } catch (error) {
            if (error?.response) return deferred(classifyOmdbResponse(error.response.data, error.response.status).kind);
            if (isCertificateError(error)) return { status: 'ssl_error', code: 'certificate_validation_failed' };
            return deferred('transport_unavailable');
        }
    };
}

/** Saved automatic recovery joins the same credit and pacing boundary as lookups. */
export function createOmdbSslRecovery({ db, reserve = reserveOmdbQuota, probe = createOmdbSslProbe(),
    observe = createOmdbPacingObserver({ database: db }) }) {
    return async config => {
        const expectedContext = providerCredentialContext('omdb', config);
        if (!expectedContext) return deferred('invalid_configuration');
        let admission;
        try {
            admission = await reserve(db, { pacing: true, expectedContext });
        } catch (_error) {
            return deferred('admission_unavailable');
        }
        if (admission?.status !== 'reserved') {
            return deferred(admissionCodes.has(admission?.status) ? admission.status : 'admission_unavailable');
        }
        try {
            const result = await probe(admission.apiKey, {
                observeResponse: response => observe(response, admission.credentialContext),
            });
            // No lock spans HTTP. Never publish old-key recovery after a saved edit.
            const { rows: [current] } = await db.query(`SELECT id, credential_generation, credential_rejected_at
                FROM omdb_config WHERE is_active = true ORDER BY id DESC LIMIT 1`);
            if (current?.id !== expectedContext.id || current?.credential_generation !== expectedContext.generation ||
                current?.credential_rejected_at) return deferred('configuration_changed');
            if (result?.status === 'recovered') return { status: 'recovered', code: 'transport_verified' };
            if (result?.status === 'ssl_error') return { status: 'ssl_error', code: 'certificate_validation_failed' };
            return deferred(probeCodes.has(result?.code) ? result.code : 'probe_unavailable');
        } catch (_error) {
            // No raw provider/database error can become a log or recovery decision.
            return deferred('probe_unavailable');
        }
    };
}
