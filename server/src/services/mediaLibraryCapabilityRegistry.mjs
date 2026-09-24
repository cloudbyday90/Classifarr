/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const CAPABILITIES = Object.freeze({
  movie: Object.freeze({ mediaType: 'movie', admission: 'routing_inventory', itemKind: 'movie' }),
  tv: Object.freeze({ mediaType: 'tv', admission: 'routing_inventory', itemKind: 'series' }),
  music: Object.freeze({ mediaType: 'music', admission: 'source_discovery_only', itemKind: 'artist' }),
});

export function mediaLibraryCapability(mediaType) {
  return Object.hasOwn(CAPABILITIES, mediaType) ? CAPABILITIES[mediaType] : null;
}

export function isReadOnlyDiscoveryLibrary(library) {
  return mediaLibraryCapability(library?.media_type)?.admission === 'source_discovery_only';
}

export function isRoutingInventoryLibrary(library) {
  return mediaLibraryCapability(library?.media_type)?.admission === 'routing_inventory';
}
