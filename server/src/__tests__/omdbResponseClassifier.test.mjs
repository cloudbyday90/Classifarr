/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { classifyOmdbResponse, isOmdbNotFoundMessage } from '../services/omdbResponseClassifier.mjs';
import { formatResponse } from '../services/omdbResponse.mjs';

const valid = { Response: 'True', Title: 'Fixture', imdbID: 'tt0000001', Type: 'movie' };

test.each([
    ['Movie not found!', 'not_found'], ['Series not found!', 'not_found'],
    ['Episode not found.', 'not_found'], ['  MOVIE NOT FOUND!  ', 'not_found'],
    ['Invalid API key!', 'authentication'], ['No API key provided.', 'authentication'],
    ['Request limit reached!', 'quota_exhausted'], ['Daily limit reached!', 'quota_exhausted'],
    ['Too many results.', 'invalid_request'], ['Incorrect IMDb ID.', 'invalid_request'],
    ['Error getting data.', 'provider_error'], ['unknown private-fixture-key', 'provider_error'],
    ['Movie not found! private-fixture-key', 'provider_error'],
    ['Invalid API key! Movie not found!', 'provider_error'], ['', 'invalid_response'],
    ['x'.repeat(257), 'invalid_response'],
])('classifies a bounded provider message: %s', (Error, kind) => {
    const outcome = classifyOmdbResponse({ Response: 'False', Error });
    expect(outcome.kind).toBe(kind);
    expect(outcome.message).not.toContain('private-fixture-key');
});

test.each([401, 403, 404, 429, 500, 503, 522])('HTTP %i cannot become success or missing evidence', status => {
    for (const data of [valid, { Response: 'False', Error: 'Movie not found!' }]) {
        expect(['success', 'not_found']).not.toContain(classifyOmdbResponse(data, status).kind);
    }
});

test.each([200, 401, 429])('explicit provider quota exhaustion is recognized on HTTP %i', status => {
    expect(classifyOmdbResponse({ Response: 'False', Error: 'Request limit reached!' }, status).kind)
        .toBe('quota_exhausted');
});

test.each([null, undefined, [], '<html>private-fixture-key</html>', 42, {},
    { Response: true }, { Response: 'False' }, { Response: 'False', Error: {} },
    { Response: 'True' }, { ...valid, Error: 'Invalid API key!' },
    { ...valid, imdbID: '123' }, { ...valid, Title: ' ' }, { ...valid, Type: 'person' },
    { ...valid, Genre: {} }, { ...valid, imdbVotes: [] }, { ...valid, Ratings: {} },
    { ...valid, Ratings: [null] }, { ...valid, Ratings: [{ Source: {}, Value: '5' }] },
    { ...valid, Ratings: Array(21).fill({ Source: 'fixture', Value: '5' }) },
    { ...valid, Plot: 'x'.repeat(16385) },
])('rejects malformed success/error payload %#', data => {
    expect(classifyOmdbResponse(data).kind).toBe('invalid_response');
});

test.each(['movie', 'series', 'episode'])('allows valid %s metadata with absent optional fields', Type => {
    const data = { ...valid, Type, Ratings: null, Genre: null };
    expect(classifyOmdbResponse(data).kind).toBe('success');
    expect(formatResponse(data)).toMatchObject({ title: 'Fixture', imdbId: 'tt0000001',
        type: Type, ratings: [], imdbVotes: null, imdbRating: null, metascore: null, totalSeasons: null });
});

test('formats available and unavailable numeric metadata without NaN or partial parses', () => {
    expect(formatResponse({ ...valid, imdbVotes: '1,234', imdbRating: '7.5', Metascore: '80', totalSeasons: '2' }))
        .toMatchObject({ imdbVotes: 1234, imdbRating: 7.5, metascore: 80, totalSeasons: 2 });
    expect(formatResponse({ ...valid, imdbVotes: 'N/A', imdbRating: 'Infinity', Metascore: '80garbage', totalSeasons: '' }))
        .toMatchObject({ imdbVotes: null, imdbRating: null, metascore: null, totalSeasons: null });
});

test.each([undefined, null, {}, [null], [{ Title: 'Fixture' }], Array(101).fill(valid)])(
    'rejects malformed or unbounded search results %#', Search => {
        expect(classifyOmdbResponse({ Response: 'True', Search }, 200, 'search').kind).toBe('invalid_response');
    });

test('accepts valid search rows and empty successful search', () => {
    for (const Search of [[], [valid]]) {
        expect(classifyOmdbResponse({ Response: 'True', Search }, 200, 'search').kind).toBe('success');
    }
});

test.each(['Error getting data', 'OMDb not found: service offline', {}, null])(
    'does not infer a historical miss from an operational failure %#', value => {
        expect(isOmdbNotFoundMessage(value)).toBe(false);
    });
