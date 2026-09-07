/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { OMDbLimitReachedError } from './omdbQuota.mjs';

export class OMDbProviderError extends Error {
    constructor(outcome) {
        super(outcome.message);
        this.name = 'OMDbProviderError';
        this.code = `OMDB_${outcome.kind.toUpperCase()}`;
        this.kind = outcome.kind;
    }
}

/** Preserve the quota pause contract only for explicit provider exhaustion. */
export function createOmdbProviderError(outcome) {
    return outcome.kind === 'quota_exhausted'
        ? new OMDbLimitReachedError(outcome.message)
        : new OMDbProviderError(outcome);
}
