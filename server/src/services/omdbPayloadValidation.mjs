/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const OPTIONAL_TEXT_FIELDS = [
    'Year', 'Rated', 'Released', 'Runtime', 'Genre', 'Director', 'Writer', 'Actors',
    'Plot', 'Language', 'Country', 'Awards', 'Poster', 'Metascore', 'imdbRating',
    'imdbVotes', 'BoxOffice', 'Production', 'totalSeasons',
];

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value, max = 16384) {
    return typeof value === 'string' && value.length <= max;
}

function isIdentity(data) {
    return isRecord(data) && isText(data.Title, 1024) && data.Title.trim().length > 0 &&
        isText(data.imdbID, 32) && /^tt\d{7,20}$/.test(data.imdbID) &&
        ['movie', 'series', 'episode'].includes(data.Type);
}

/** Validate only consumed fields; optional absent/null values remain legitimate. */
export function isOmdbLookupPayload(data) {
    if (!isIdentity(data) || !OPTIONAL_TEXT_FIELDS.every(field =>
        data[field] == null || isText(data[field]))) return false;
    return data.Ratings == null || (Array.isArray(data.Ratings) && data.Ratings.length <= 20 &&
        data.Ratings.every(rating => isRecord(rating) &&
            isText(rating.Source, 256) && isText(rating.Value, 256)));
}

export function isOmdbSearchPayload(data) {
    return isRecord(data) && Array.isArray(data.Search) && data.Search.length <= 100 &&
        data.Search.every(item => isIdentity(item) &&
            ['Year', 'Poster'].every(field => item[field] == null || isText(item[field])));
}
