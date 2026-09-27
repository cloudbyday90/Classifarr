/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';

const HOUR = 3600000;
const CATEGORIES = new Set(['not_found', 'authentication', 'rate_limited', 'upstream_error',
    'request_rejected', 'timeout', 'cancelled', 'response_too_large', 'tls', 'network', 'unknown', 'invalid_response']);
const SLOW = new Set(['not_found', 'authentication', 'request_rejected', 'response_too_large', 'tls', 'invalid_response']);
const MAX_ATTEMPTS = 1000000;
const uuid = value => typeof value === 'string' && value.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const timestamp = value => typeof value === 'string' && value.length <= 32 && Number.isFinite(Date.parse(value));

/** Read only our bounded schema; never spread an arbitrary stored/provider object. */
export function readInventoryProviderRecovery(value, tmdbId, mediaType) {
    if (value?.version !== 1 || value.tmdb_id !== tmdbId || value.media_type !== mediaType ||
        !uuid(value.case_id) || !['open', 'resolved'].includes(value.status) || !CATEGORIES.has(value.category) ||
        !Number.isInteger(value.attempt_count) || value.attempt_count < 1 || value.attempt_count > MAX_ATTEMPTS ||
        !timestamp(value.first_seen) || !timestamp(value.last_seen) ||
        (value.status === 'resolved' ? !timestamp(value.resolved_at) : value.resolved_at != null)) return null;
    return { version: 1, case_id: value.case_id, tmdb_id: tmdbId, media_type: mediaType,
        status: value.status, category: value.category, attempt_count: value.attempt_count,
        first_seen: value.first_seen, last_seen: value.last_seen, resolved_at: value.resolved_at ?? null };
}

export function nextInventoryProviderRecovery({ previous, tmdbId, mediaType, failure, now = Date.now(), random = Math.random }) {
    const prior = readInventoryProviderRecovery(previous, tmdbId, mediaType);
    const at = new Date(now).toISOString();
    if (!failure) return { record: prior?.status === 'open' ? { ...prior, status: 'resolved',
        last_seen: at, resolved_at: at, attempt_count: Math.min(MAX_ATTEMPTS, prior.attempt_count + 1) } : prior,
    retryAfter: null, transition: prior?.status === 'open' ? 'resolved' : null };
    const category = CATEGORIES.has(failure.category) ? failure.category : 'unknown';
    const current = prior?.status === 'open' ? prior : null;
    const attempts = Math.min(MAX_ATTEMPTS, (current?.attempt_count ?? 0) + 1);
    const consecutive = current?.category === category ? attempts : 1;
    const base = SLOW.has(category) ? 24 : 6;
    const cap = SLOW.has(category) ? 168 : 24;
    const jitter = Math.max(0, Math.min(1, Number(random()) || 0));
    // Retain jitter at saturation instead of aligning every long-lived case at the cap.
    const delay = Math.min(cap / 1.2, base * 2 ** Math.min(10, consecutive - 1)) * (1 + jitter * 0.2) * HOUR;
    const hint = Number.isFinite(failure.retryAfterMs) ? Math.max(0, Math.min(30 * 24 * HOUR, failure.retryAfterMs)) : 0;
    return { record: { version: 1, case_id: current?.case_id ?? randomUUID(), tmdb_id: tmdbId, media_type: mediaType,
        status: 'open', category, attempt_count: attempts, first_seen: current?.first_seen ?? at,
        last_seen: at, resolved_at: null }, retryAfter: new Date(now + Math.max(delay, hint)).toISOString(),
    transition: !current || current.category !== category ? 'opened' : null };
}
