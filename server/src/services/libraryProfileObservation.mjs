/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { ratingNormalizer } from '../utils/ratingNormalizer.mjs';
import { profileObservationCoverage } from './libraryProfileObservationPresentation.mjs';

export const LIBRARY_PROFILE_OBSERVATION_VERSION = 'library.profile_observation.v1';
const fields = ['rating', 'genres', 'studio', 'keywords', 'language'];
const percent = (count, total) => total ? Math.round(count * 1000 / total) / 10 : 0;

function label(value) {
    if (typeof value !== 'string') return null;
    const text = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    return text && text.length <= 160 && !/^(unknown|n\/a|null|undefined)$/i.test(text) ? text : null;
}
const list = value => [...new Set(normalizeMetadataList(value).map(label).filter(Boolean))];
const firstLabel = values => values.map(label).find(Boolean);

function observedRating(values, mediaType) {
    for (const value of values.map(label).filter(Boolean)) {
        const normalized = ratingNormalizer.normalizeRating(value, mediaType);
        if (normalized !== 'NR' || value.toUpperCase() === 'NR') return normalized;
    }
    return null;
}

function traits(item) {
    const metadata = item.metadata || {};
    const tmdb = metadata.tmdb || {};
    const omdb = metadata.omdb || {};
    const rating = observedRating([item.content_rating, omdb.data?.rated, omdb.rated, tmdb.certification], item.media_type);
    const genres = list(item.genres);
    const studio = firstLabel([item.studio, list(tmdb.production_companies)[0]]);
    const keywords = list(tmdb.keywords?.keywords ?? tmdb.keywords?.results ?? tmdb.keywords);
    const language = firstLabel([metadata.original_language, tmdb.original_language]);
    return {
        rating: rating ? [rating] : [],
        genres: genres.length ? genres : list(tmdb.genres),
        studio: studio ? [studio] : [], keywords,
        language: language ? [language.toLowerCase()] : [],
    };
}

/** Measurements describe inventory rows, never verified labels or hard exclusions. */
export function buildLibraryProfileObservation(items) {
    const counts = new Map(fields.map(field => [field, new Map()]));
    const observed = new Map(fields.map(field => [field, 0]));
    const identities = new Set();
    let identifiedRowCount = 0;
    let enrichedCount = 0;
    for (const item of items) {
        if ([item.metadata?.omdb, item.metadata?.tmdb].some(value => value && typeof value === 'object' && !Array.isArray(value))) enrichedCount++;
        if (Number.isInteger(item.tmdb_id) && item.tmdb_id > 0 && ['movie', 'tv'].includes(item.media_type)) {
            identifiedRowCount++;
            identities.add(`${item.media_type}:${item.tmdb_id}`);
        }
        for (const [field, values] of Object.entries(traits(item))) {
            if (values.length) observed.set(field, observed.get(field) + 1);
            const fieldCounts = counts.get(field);
            for (const value of values) fieldCounts.set(value, (fieldCounts.get(value) || 0) + 1);
        }
    }
    return {
        version: LIBRARY_PROFILE_OBSERVATION_VERSION, population: 'inventory_rows', itemCount: items.length, enrichedCount,
        identifiedRowCount, unidentifiedRowCount: items.length - identifiedRowCount,
        distinctTypedIdentityCount: identities.size, duplicateIdentifiedRowCount: identifiedRowCount - identities.size,
        traits: Object.fromEntries(fields.map(field => {
            const observedCount = observed.get(field);
            return [field, {
                observedCount, unknownCount: items.length - observedCount, coveragePercent: percent(observedCount, items.length),
                entries: [...counts.get(field)].sort(([a, ac], [b, bc]) => bc - ac || (a < b ? -1 : a > b ? 1 : 0))
                    .map(([value, count]) => ({ value, count, percentOfAllItems: percent(count, items.length), percentOfObservedItems: percent(count, observedCount) })),
            }];
        })),
    };
}

export function observationDistribution(observation, field) {
    return Object.fromEntries((observation.traits[field]?.entries || []).map(entry => [entry.value, entry.percentOfAllItems]));
}

export function observationStats(observation, observedAt) {
    const distribution = (field, key, limit) => observation.traits[field].entries.slice(0, limit)
        .map(entry => ({ [key]: entry.value, count: entry.count, percentage: entry.percentOfAllItems }));
    return {
        certificationDistribution: distribution('rating', 'certification', 10),
        genreDistribution: distribution('genres', 'genre', 10),
        studioDistribution: distribution('studio', 'studio', 5),
        languageDistribution: distribution('language', 'language', 5),
        totalItems: observation.itemCount, lastUpdated: observedAt, observation: profileObservationCoverage(observation),
    };
}
