/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildStatusHealthState } from './healthCheckServiceShared.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('healthConfigurationRead');
const services = new Set(['radarr', 'sonarr', 'discordBot', 'ollama', 'mediaServer', 'tmdb', 'omdb', 'tavily', 'rag', 'imageEmbeddings']);
const transientCodes = new Set(['08000', '08001', '08003', '08006', '53300', '57P01', '57P02', '57P03', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']);
const messages = {
    configuration_read_unavailable: 'Configuration could not be read because the database is unavailable or busy. Check Database health, then refresh health after it recovers.',
    configuration_schema_unavailable: 'Configuration could not be read because a required database table or column is missing. Review startup and migration logs; do not delete migration records or re-enter provider credentials.',
    configuration_access_denied: 'Configuration could not be read with the current database credentials or permissions. Review database-role and deployment settings; do not replace provider credentials.',
    configuration_read_cancelled: 'The configuration read was cancelled. Check Database health and shutdown activity, then refresh health when the application is stable.',
    configuration_read_invalid: 'The configuration read returned an unexpected result. Open a Classifarr GitHub issue with this service, diagnostic code and check time; exclude credentials and private data.',
    configuration_read_failed: 'Configuration could not be read for an unrecognized reason. Check Database health and startup logs. If it persists, open a Classifarr GitHub issue with this service, diagnostic code and check time; exclude credentials and private data.',
    health_check_failed: 'The health check could not be completed. If it persists, open a Classifarr GitHub issue with this service, diagnostic code and check time; exclude credentials and private data.',
};

function configurationFailureCode(error) {
    if (transientCodes.has(error?.code)) return 'configuration_read_unavailable';
    if (error?.code === '42P01' || error?.code === '42703') return 'configuration_schema_unavailable';
    if (['42501', '28P01', '28000'].includes(error?.code)) return 'configuration_access_denied';
    if (error?.code === '57014' || error?.code === 'ABORT_ERR') return 'configuration_read_cancelled';
    if (error?.code === 'HEALTH_CONFIG_INVALID') return 'configuration_read_invalid';
    return 'configuration_read_failed';
}

/** Never retain configuration, exception text or stale instance membership. */
export function buildUnknownHealthState(previous, service, stage = 'health_check', error = undefined) {
    const safeStage = stage === 'configuration_read' ? stage : 'health_check';
    const code = safeStage === 'configuration_read' ? configurationFailureCode(error) : 'health_check_failed';
    const state = { ...buildStatusHealthState(previous, 'unknown'),
        responseTime: null,
        error: messages[code],
        failure: { stage: safeStage, code },
    };
    if (previous?.failure?.code !== code) {
        try {
            Promise.resolve(logger.warn('Health observation could not be completed', {
                service: services.has(service) ? service : 'unknown',
                ...state.failure,
                checkedAt: state.lastCheck,
            }, { skipDbPersist: true })).catch(() => {}); // swallow-error: console diagnostics must not reject the health check
        } catch (_error) { // swallow-error: diagnostic logging must not change an unknown health outcome
        }
    }
    return state;
}

/** One existing read, no retries; a successful empty row set is different from failure. */
export async function readHealthConfiguration(previous, service, read, guard = undefined) {
    try {
        const result = await read();
        if (!Array.isArray(result?.rows) || result.rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
            return { ok: false, health: buildUnknownHealthState(previous, service, 'configuration_read', { code: 'HEALTH_CONFIG_INVALID' }) };
        }
        guard?.capture(read, result.rows);
        return { ok: true, rows: result.rows };
    } catch (error) {
        return { ok: false, health: buildUnknownHealthState(previous, service, 'configuration_read', error) };
    }
}
