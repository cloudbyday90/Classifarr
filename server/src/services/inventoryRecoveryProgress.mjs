/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readInventoryProviderRecovery } from './inventoryProviderRecoveryPolicy.mjs';
import { INVENTORY_TMDB_RETRY_HOURS } from './inventoryTmdbObservation.mjs';

const time = value => value == null ? NaN : new Date(value).getTime();
const uuid = value => typeof value === 'string' && value.length === 36 &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const median = values => {
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return { samples: values.length, seconds: values.length ? Math.round((values[mid] + values[Math.floor((values.length - 1) / 2)]) / 2) : null };
};

export function summarizeInventoryRecoveryProgress(rows, asOf, readiness) {
    const now = time(asOf), stages = { waiting: 0, ready: 0, queued: 0, checking: 0, blocked: 0, recovered: 0, unknown: 0 };
    const queueTimes = [], recoveryTimes = [];
    let oldestReadySeconds = 0;
    for (const row of rows.slice(0, 1000)) {
        const r = readInventoryProviderRecovery(row.recovery, row.tmdb_id, row.media_type), p = row.progress;
        const released = time(p?.released_at), eligible = time(p?.eligible_at), queued = time(p?.queued_at), saved = time(p?.persisted_at);
        if (!r || p?.version !== 1 || p.case_id !== r.case_id || !uuid(p.generation) ||
            !Number.isFinite(released) || released > now || !Number.isFinite(eligible) || eligible < released) { stages.unknown++; continue; }
        const recovered = r.status === 'resolved' && saved >= released && saved <= now;
        const due = Math.max(time(row.retry_after) || 0, row.attempted_at ? time(row.attempted_at) + INVENTORY_TMDB_RETRY_HOURS * 3600000 : 0);
        const state = recovered ? 'recovered' : r.status !== 'open' ? 'unknown' : row.source_blocked ? 'blocked'
            : time(row.lease_until) > now ? 'checking' : due > now ? 'waiting' : row.queued ? 'queued'
                : Number.isFinite(due) && due > 0 ? 'ready' : 'unknown';
        stages[state]++;
        if (state === 'ready') oldestReadySeconds = Math.max(oldestReadySeconds, Math.floor((now - due) / 1000));
        if (queued >= eligible && queued <= now) queueTimes.push((queued - eligible) / 1000);
        if (recovered && queued >= released && saved >= queued) recoveryTimes.push((saved - queued) / 1000);
    }
    return { version: 1, asOf, readiness, windowDays: 30, limit: 1000, truncated: rows.length > 1000,
        total: Math.min(rows.length, 1000), stages, oldestReadySeconds,
        eligibleToQueue: median(queueTimes), queueToRecovery: median(recoveryTimes) };
}
