/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const LIBRARY_PROFILE_REVISION_SUPERSEDED = 'LIBRARY_PROFILE_REVISION_SUPERSEDED';

export function createLibraryProfileRevisionSupersededError() {
    const error = new Error('Library inventory changed before profile publication');
    error.code = LIBRARY_PROFILE_REVISION_SUPERSEDED;
    return error;
}

export function isLibraryProfileRevisionSuperseded(error) {
    return error?.code === LIBRARY_PROFILE_REVISION_SUPERSEDED;
}
