/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildStatusHealthState, buildTimedResultHealthState } from './healthCheckServiceShared.mjs';

const messages = {
    connection_failed: 'Connection check failed. Check the service and its saved connection settings, then refresh health.',
    authentication_failed: 'The service refused access. Check its saved API key and permissions, then refresh health.',
    rate_limited: 'The service is limiting requests. Wait before refreshing health.',
    connection_timeout: 'The service did not respond in time. Check connectivity, then refresh health.',
    check_cancelled: 'The connection check was cancelled. Refresh health when the application is stable.',
    response_invalid: 'The service returned an unexpected response. Check the saved endpoint. If this persists, open a Classifarr issue.',
    response_too_large: 'The service response exceeded the health-check limit. Check the endpoint; report this if it persists.',
    configuration_invalid: 'Saved connection settings are incomplete or invalid. Review the URL, API key and connection options.',
    quota_exhausted: 'The provider request quota is exhausted. Wait for it to reset or review your provider plan; repeated refreshes will not restore quota.',
};

/** Strict helper contract. Never publish untrusted helper/transport error text. */
export async function measureConnectionProbe(probe) {
    const start = Date.now();
    let code;
    try {
        const result = await probe();
        if (result?.success === true) return { success: true, time: Date.now() - start };
        code = result?.success === false
            ? (Object.hasOwn(messages, result.code) ? result.code : 'connection_failed') : 'response_invalid';
    } catch (error) {
        if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') code = 'check_cancelled';
        else if (error?.code === 'ETIMEDOUT' || error?.name === 'TimeoutError') code = 'connection_timeout';
        else if ([401, 403].includes(error?.response?.status)) code = 'authentication_failed';
        else if (error?.response?.status === 429) code = 'rate_limited';
        else if (error?.code === 'HTTP_RESPONSE_TOO_LARGE') code = 'response_too_large';
        else code = 'connection_failed';
    }
    return { success: false, time: Date.now() - start, code, error: messages[code] };
}

export function buildConnectionProbeHealthState(previous, result, overrides = {}) {
    const unknown = ['response_invalid', 'check_cancelled', 'response_too_large', 'configuration_invalid'].includes(result.code);
    return buildTimedResultHealthState(previous, result, {
        ...(unknown ? { status: 'unknown' } : {}),
        ...(!result.success ? { failure: { stage: result.code === 'configuration_invalid'
            ? 'connection_configuration' : 'connection_probe', code: result.code } } : {}),
        ...overrides,
    });
}

export function buildInvalidConnectionHealthState(previous, unsupported = false) {
    return buildStatusHealthState(previous, 'unknown', {
        responseTime: null,
        error: unsupported
            ? 'This provider type is not supported by the health check. Review the selected provider in settings.'
            : 'The saved endpoint is invalid for this connection. Review the host, port and URL in settings.',
        failure: { stage: 'connection_configuration', code: unsupported ? 'provider_unsupported' : 'endpoint_invalid' },
    });
}
