/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { readInventoryTmdbObservation, INVENTORY_TMDB_CACHE_DAYS, INVENTORY_TMDB_RETRY_HOURS } from './inventoryTmdbObservation.mjs';

export const OBSERVATION_HEALTH_STATES = Object.freeze(['unsupported_type', 'missing_identity', 'observation_withheld',
    'clock_anomaly', 'fresh', 'backoff', 'never_observed', 'due']);

function clock(value, now) {
    if (value == null) return { time: null, invalid: false };
    const time = typeof value === 'string' || value instanceof Date ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) && time <= now ? { time, invalid: false } : { time: null, invalid: true };
}

/** Row-based health: task completion and source placement never establish capture. */
export function measureLibraryObservationRow(item, now) {
    const supported = ['movie', 'tv'].includes(item.media_type);
    const identified = supported && Boolean(positiveDatabaseInteger(item.tmdb_id));
    const observation = identified && !item.observation_withheld ? readInventoryTmdbObservation(item) : null;
    const fetched = clock(item.inventory_tmdb_fetched_at, now);
    const attempted = clock(item.inventory_tmdb_attempted_at, now);
    let state;
    if (!supported) state = 'unsupported_type';
    else if (!identified) state = 'missing_identity';
    else if (item.observation_withheld) state = 'observation_withheld';
    else if (fetched.invalid || attempted.invalid) state = 'clock_anomaly';
    else if (observation && fetched.time !== null && now - fetched.time < INVENTORY_TMDB_CACHE_DAYS * 86400000) state = 'fresh';
    else if (attempted.time !== null && now - attempted.time < INVENTORY_TMDB_RETRY_HOURS * 3600000) state = 'backoff';
    else if (!observation && !item.has_observation && fetched.time === null && attempted.time === null) state = 'never_observed';
    else state = 'due';
    return {
        state, supported, identified, captured: Boolean(observation),
        keywordsKnown: Boolean(observation?.keywords.length), languageKnown: Boolean(observation?.original_language),
        emptyKeywords: Boolean(observation && !observation.keywords.length),
        unknownLanguage: Boolean(observation && !observation.original_language),
        invalidObservation: Boolean(identified && item.has_observation && !item.observation_withheld && !observation),
        undatedObservation: Boolean(observation && item.inventory_tmdb_fetched_at == null),
        clockAnomaly: Boolean(identified && (fetched.invalid || attempted.invalid)),
        attemptWithoutRefresh: Boolean(identified && !item.observation_withheld && attempted.time !== null &&
            (!observation || fetched.time === null || attempted.time > fetched.time)),
        successfulAt: observation && fetched.time !== null ? fetched.time : null,
        queueState: item.has_processing_task ? 'processing' : item.has_pending_task ? 'pending' : 'idle',
    };
}
