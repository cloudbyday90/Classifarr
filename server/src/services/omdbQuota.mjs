/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { readOmdbQuota, reserveOmdbQuota } from './omdbQuotaStore.mjs';
import { ServiceUnavailableError } from '../utils/appError.mjs';

export class OMDbLimitReachedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OMDbLimitReachedError';
    }
}

function unavailableReason(status) {
    return status === 'not_configured' ? 'OMDb API key not configured' : 'OMDb quota configuration is invalid';
}

export async function hasRemainingQuota() {
    try {
        const quota = await readOmdbQuota(db);
        if (quota.status === 'available' || quota.status === 'limit_reached') {
            return { available: quota.status === 'available', used: quota.used, limit: quota.limit };
        }
        return { available: false, used: 0, limit: 0, reason: unavailableReason(quota.status) };
    } catch {
        return { available: false, used: 0, limit: 0, reason: 'OMDb quota is unavailable' };
    }
}

/** Reserves and commits one local attempt before returning a credential to the caller. */
export async function checkAndIncrementUsage({ metadataProviderIntegrityService }) {
    let quota;
    try {
        quota = await reserveOmdbQuota(db);
    } catch {
        throw new ServiceUnavailableError('OMDb quota is unavailable');
    }
    if (quota.status === 'limit_reached') {
        metadataProviderIntegrityService.warnProviderRuntimeFailure({
            provider: 'omdb', category: 'daily_limit', message: 'OMDb daily limit reached',
            metadata: { source: 'omdb_service', limit: quota.limit, used: quota.used },
            dedupeSignature: `${quota.day}:${quota.limit}:${quota.used}`,
        });
        throw new OMDbLimitReachedError(`OMDb daily limit of ${quota.limit} reached`);
    }
    if (quota.status !== 'reserved') throw new ServiceUnavailableError(unavailableReason(quota.status));
    return { apiKey: quota.apiKey, configId: quota.configId };
}
