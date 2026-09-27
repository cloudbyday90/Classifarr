/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Synthetic contract fixtures, not captures from a live server or version certification.
export const legacyEmbyCatalog = [
  { ItemId: 'film', Name: 'Music documentaries', CollectionType: 'movies', Locations: ['/private/media'] },
  { ItemId: 'series', Name: 'Any destination', CollectionType: 'tvshows' },
  { ItemId: 'audio', Name: 'Movies', CollectionType: 'music' },
];
export const jellyfinCatalog = structuredClone(legacyEmbyCatalog);
export const embyQueryPages = [
  { TotalRecordCount: 3, Items: [{ ...legacyEmbyCatalog[0], Id: 'film' }], NextPage: 'https://untrusted.invalid/?token=never-follow' },
  { TotalRecordCount: 3, Items: [
    { Id: 'series', Name: 'Any destination', CollectionType: 'tvshows' }, legacyEmbyCatalog[2],
  ] },
];
export const plexCatalog = { MediaContainer: { size: 3, Directory: [
  { key: 'film', title: 'Music documentaries', type: 'movie' },
  { key: 'series', title: 'Any destination', type: 'show' },
  { key: 'audio', title: 'Movies', type: 'artist' },
] } };
export const expectedCatalog = [
  { external_id: 'film', name: 'Music documentaries', media_type: 'movie' },
  { external_id: 'series', name: 'Any destination', media_type: 'tv' },
  { external_id: 'audio', name: 'Movies', media_type: null },
];
