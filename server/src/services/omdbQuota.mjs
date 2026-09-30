/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { readOmdbQuota, reserveOmdbQuota } from './omdbQuotaStore.mjs';
import { ServiceUnavailableError } from '../utils/appError.mjs';
import { rejectProviderCredential } from './providerCredentialRejection.mjs';
import { OmdbAdmissionWaitError } from './omdbPacingPolicy.mjs';
import { rememberProviderRequest } from './providerRequestEvidence.mjs';

export class OMDbLimitReachedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OMDbLimitReachedError';
    }
}

function unavailableReason(status) {
    if (status === 'credentials_rejected') return 'OMDb access rejected; correct the saved API key or disable and re-enable after fixing account access';
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
export async function checkAndIncrementUsage({ metadataProviderIntegrityService, expectedContext }) {
    let quota;
    try {
        quota = await reserveOmdbQuota(db, { pacing: true, expectedContext });
    } catch {
        throw new ServiceUnavailableError('OMDb quota is unavailable', {
            code: 'OMDB_ADMISSION_UNAVAILABLE', retryAfterSeconds: 60,
        });
    }
    const tracked = error => rememberProviderRequest(error, [{ ...quota.credentialContext, providerKey: 'omdb' }]);
    if (quota.status === 'paced') throw tracked(new OmdbAdmissionWaitError(quota.retryAfterSeconds));
    if (quota.status === 'lookup_restart') {
        const error = new OmdbAdmissionWaitError(1);
        error.code = 'OMDB_LOOKUP_RESTART';
        throw tracked(error);
    }
    if (quota.status === 'limit_reached') {
        metadataProviderIntegrityService.warnProviderRuntimeFailure({
            provider: 'omdb', category: 'daily_limit', message: 'OMDb daily limit reached',
            metadata: { source: 'omdb_service', limit: quota.limit, used: quota.used },
            dedupeSignature: `${quota.day}:${quota.limit}:${quota.used}`,
        });
        throw tracked(new OMDbLimitReachedError(`OMDb daily limit of ${quota.limit} reached`));
    }
    if (quota.status !== 'reserved') {
        const error = new ServiceUnavailableError(unavailableReason(quota.status), {
            code: 'OMDB_ADMISSION_UNAVAILABLE', retryAfterSeconds: 60,
        });
        if (quota.status === 'credentials_rejected') error.code = 'OMDB_AUTHENTICATION';
        throw tracked(error);
    }
    return { apiKey: quota.apiKey, configId: quota.configId, credentialContext: quota.credentialContext };
}

export async function rejectOmdbCredential(context) { return rejectProviderCredential(db, context); }
