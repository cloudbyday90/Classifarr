/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';

export const INVENTORY_TMDB_CACHE_DAYS = 30;
export const INVENTORY_TMDB_RETRY_HOURS = 6;
const MAX_KEYWORDS = 500;

export function normalizeOriginalLanguage(value) {
    if (typeof value !== 'string') return null;
    const tag = value.trim();
    if (tag.length > 35) return null;
    const subtags = tag.split('-');
    if (!/^[a-z]{2,3}$/i.test(subtags[0]) || subtags.slice(1).some(part => !/^[a-z0-9]{2,8}$/i.test(part)) ||
        /^(und|mul|zxx)$/i.test(subtags[0])) return null;
    try { return Intl.getCanonicalLocales(tag)[0].toLowerCase(); } catch { return null; }
}

function keyword(value) {
    if (typeof value !== 'string' || value.length > 160) return null;
    const text = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    return text && text.length <= 160 && !/^(unknown|n\/a|null|undefined)$/i.test(text) ? text : null;
}

/** Only an attributable observation of this exact movie/TV identity is reusable. */
export function readInventoryTmdbObservation(item) {
    const record = item?.metadata?.inventory_tmdb;
    const id = positiveDatabaseInteger(item?.tmdb_id);
    const type = canonicalMediaType(item?.media_type);
    if (!id || !type || record?.version !== 1 || record.tmdb_id !== id || record.media_type !== type ||
        !Array.isArray(record.keywords) || record.keywords.length > MAX_KEYWORDS ||
        record.keywords.some(value => typeof value !== 'string' || keyword(value) !== value) ||
        (record.original_language !== null && normalizeOriginalLanguage(record.original_language) !== record.original_language)) return null;
    return { keywords: [...new Set(record.keywords)], original_language: record.original_language };
}

export function buildInventoryTmdbObservation(details, tmdbId, mediaType, acquiredAt) {
    const id = positiveDatabaseInteger(tmdbId);
    const type = canonicalMediaType(mediaType);
    if (!id || !type || details?.id !== id || (details.media_type != null && details.media_type !== type)) return null;
    const envelope = details.keywords;
    const values = type === 'movie' ? envelope?.keywords : envelope?.results;
    if (!Array.isArray(values) || values.length > MAX_KEYWORDS ||
        (envelope.id != null && envelope.id !== id) || values.some(value => !keyword(value?.name))) return null;
    return { version: 1, tmdb_id: id, media_type: type,
        keywords: [...new Set(values.map(value => keyword(value.name)))],
        original_language: normalizeOriginalLanguage(details.original_language), fetched_at: acquiredAt };
}

export function inventoryTmdbObservationDue(payload, tmdbId, now) {
    const fetched = new Date(payload.inventory_tmdb_fetched_at ?? NaN).getTime();
    const attempted = new Date(payload.inventory_tmdb_attempted_at ?? NaN).getTime();
    const observation = readInventoryTmdbObservation({ tmdb_id: tmdbId, media_type: payload.media.media_type,
        metadata: { inventory_tmdb: payload.inventory_tmdb } });
    if (observation && fetched <= now && now - fetched < INVENTORY_TMDB_CACHE_DAYS * 86400000) return false;
    return !Number.isFinite(attempted) || now - attempted >= INVENTORY_TMDB_RETRY_HOURS * 3600000;
}
