/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// These deliberately artificial inventories exercise both media types and
// same-type alternatives. Probes are never inserted into the inventory.
export const CANARY_ITEMS_PER_LIBRARY = 6;

export const CANARY_LIBRARIES = Object.freeze([
    { key: 'movie', mediaType: 'movie', active: true, genre: 'Adventure' },
    { key: 'movieAlternative', mediaType: 'movie', active: true, genre: 'Documentary' },
    { key: 'tv', mediaType: 'tv', active: false, genre: 'Drama' },
    { key: 'tvAlternative', mediaType: 'tv', active: true, genre: 'Comedy' },
]);

export const CANARY_HELD_OUT_PROBES = Object.freeze([
    { mediaType: 'movie', expectedKey: 'movie', genres: ['Adventure'] },
    { mediaType: 'movie', expectedKey: 'movie', genres: ['Adventure', 'Fantasy'] },
    { mediaType: 'movie', expectedKey: 'movieAlternative', genres: ['Documentary'] },
    { mediaType: 'movie', expectedKey: 'movieAlternative', genres: ['Documentary', 'History'] },
    { mediaType: 'tv', expectedKey: 'tv', genres: ['Drama'] },
    { mediaType: 'tv', expectedKey: 'tv', genres: ['Drama', 'Mystery'] },
    { mediaType: 'tv', expectedKey: 'tvAlternative', genres: ['Comedy'] },
    { mediaType: 'tv', expectedKey: 'tvAlternative', genres: ['Comedy', 'Family'] },
]);

export const CANARY_AMBIGUOUS_PROBES = Object.freeze([
    { mediaType: 'movie', genres: [] },
    { mediaType: 'tv', genres: [] },
]);
