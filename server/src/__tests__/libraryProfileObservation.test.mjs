/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test } from '@jest/globals';
import { buildLibraryProfileObservation, observationDistribution, observationStats } from '../services/libraryProfileObservation.mjs';
import { formatObservationContext, profileObservationCoverage } from '../services/libraryProfileObservationPresentation.mjs';
import { computeProfileScoreDetails } from '../services/libraryProfileComputations.mjs';

describe('library inventory observations', () => {
    test('counts a trait once per item and names both denominators', () => {
        const observation = buildLibraryProfileObservation([
            { genres: ['Action', 'Drama', 'Action'] }, { genres: ['Action'] }, { genres: [] },
        ]);
        expect(observation.traits.genres).toEqual({ observedCount: 2, unknownCount: 1, coveragePercent: 66.7, entries: [
            { value: 'Action', count: 2, percentOfAllItems: 66.7, percentOfObservedItems: 100 },
            { value: 'Drama', count: 1, percentOfAllItems: 33.3, percentOfObservedItems: 50 },
        ] });
        expect(observationDistribution(observation, 'genres')).toEqual({ Action: 66.7, Drama: 33.3 });
        expect(observationStats(observation, 'time').genreDistribution[0]).toEqual({ genre: 'Action', count: 2, percentage: 66.7 });
    });
    test('reports repeated known identities without collapsing movie and TV namespaces', () => {
        const observation = buildLibraryProfileObservation([{ tmdb_id: 7, media_type: 'movie' }, { tmdb_id: 7, media_type: 'tv' },
            { tmdb_id: 7, media_type: 'movie' }, { tmdb_id: null }, { tmdb_id: 7, media_type: 'person' }]);
        expect(observation).toMatchObject({ population: 'inventory_rows', itemCount: 5, identifiedRowCount: 3, distinctTypedIdentityCount: 2, unidentifiedRowCount: 2, duplicateIdentifiedRowCount: 1 });
    });
    test('normalizes typed ratings, provider shapes, source precedence, and metadata fallbacks', () => {
        const observation = buildLibraryProfileObservation([
            { media_type: 'tv', content_rating: '16', genres: ['Drama'], studio: 'Source studio', metadata: { original_language: 'EN', tmdb: { genres: [{ name: 'Action' }], production_companies: [{ name: 'Other studio' }] } } },
            { media_type: 'movie', content_rating: 'N/A', metadata: { omdb: { data: { rated: null }, rated: 'PG' }, tmdb: { genres: '[{"name":"Action"}]', production_companies: [{ name: 'Provider studio' }], keywords: { results: [{ name: 'space' }, { name: 'space' }] }, original_language: 'FR' } } },
        ]);
        expect(observationDistribution(observation, 'rating')).toEqual({ PG: 50, 'TV-MA': 50 });
        expect(observationDistribution(observation, 'genres')).toEqual({ Action: 50, Drama: 50 });
        expect(observationDistribution(observation, 'studio')).toEqual({ 'Provider studio': 50, 'Source studio': 50 });
        expect(observationDistribution(observation, 'language')).toEqual({ en: 50, fr: 50 });
        expect(observation.traits.keywords).toMatchObject({ observedCount: 1, unknownCount: 1, entries: [{ value: 'space', count: 1 }] });
    });
    test.each([null, '', 'N/A', 'Unknown', 'unsupported', 16, {}, []])('missing or unusable rating %j does not invent NR evidence', value => {
        const observation = buildLibraryProfileObservation([{ content_rating: value }]);
        expect(observation.traits.rating).toEqual({ observedCount: 0, unknownCount: 1, coveragePercent: 0, entries: [] });
    });
    test('preserves explicit NR and Unrated and bounds untrusted label text', () => {
        const observation = buildLibraryProfileObservation([{ content_rating: 'NR', genres: ['Action\nDrama', 'x'.repeat(161)] }, { content_rating: 'Unrated' }]);
        expect(observationDistribution(observation, 'rating')).toEqual({ NR: 50, Unrated: 50 });
        expect(observationDistribution(observation, 'genres')).toEqual({ 'Action Drama': 50 });
    });
    test('treats object-prototype keys as data and never lets inherited keys affect scores', () => {
        const observation = buildLibraryProfileObservation([{ genres: ['__proto__', 'constructor', 'toString'] }]);
        expect(Object.keys(observationDistribution(observation, 'genres'))).toEqual(['__proto__', 'constructor', 'toString']);
        expect(Object.prototype).not.toHaveProperty('polluted');
        expect(computeProfileScoreDetails({ genre_distribution: {} }, { genres: ['constructor', '__proto__'] }).finalScore).toBe(50);
    });
    test('coverage projection excludes trait entries and prompt context explains missingness', () => {
        const observation = buildLibraryProfileObservation([{ genres: ['Private genre'] }, {}]);
        const coverage = profileObservationCoverage(observation);
        expect(JSON.stringify(coverage)).not.toContain('Private genre');
        expect(formatObservationContext(coverage).join('\n')).toContain('Genres: 1/2 known; 1 missing.');
        expect(formatObservationContext(coverage).join('\n')).toContain('shares of all inventory rows');
        expect(observationStats(observation, 'time').observation).toEqual(coverage);
    });
    test('zero population is measured without division errors or invented traits', () => {
        const observation = buildLibraryProfileObservation([]);
        expect(observation.traits.rating).toEqual({ observedCount: 0, unknownCount: 0, coveragePercent: 0, entries: [] });
        expect(profileObservationCoverage(observation).itemCount).toBe(0);
    });
    test.each([null, {}, { version: 'other' }, { version: 'library.profile_observation.v1', population: 'inventory_rows', itemCount: -1 },
        { version: 'library.profile_observation.v1', population: 'inventory_rows', itemCount: 1, traits: { rating: { observedCount: 2, unknownCount: -1 } } }])('rejects unmeasured or inconsistent coverage %j', value => {
        expect(profileObservationCoverage(value)).toBeNull();
        expect(formatObservationContext(value).join('')).toContain('coverage was not measured');
    });
});
