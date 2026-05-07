/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

export function extract(metadata) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {
            director_name: null,
            primary_studio_name: null,
            genre_names: [],
            cast_ids: [],
            cast_names: []
        };
    }

    const rawDirector = metadata.director_name;
    const director_name = (rawDirector && typeof rawDirector === 'string')
        ? rawDirector.toLowerCase().trim().slice(0, 255) || null
        : null;

    const firstCompany = Array.isArray(metadata.production_companies)
        ? metadata.production_companies[0]
        : null;
    const rawStudio = firstCompany?.name;
    const primary_studio_name = (rawStudio && typeof rawStudio === 'string')
        ? rawStudio.toLowerCase().trim().slice(0, 255) || null
        : null;

    const genre_names = normalizeMetadataList(metadata.genres).slice(0, 10);

    const cast_ids = Array.isArray(metadata.cast)
        ? metadata.cast
            .slice(0, 5)
            .map(c => (c && typeof c.id === 'number' ? c.id : null))
            .filter(id => id != null)
        : [];

    const cast_names = Array.isArray(metadata.cast)
        ? metadata.cast
            .slice(0, 5)
            .map(c => (c && typeof c.name === 'string' ? c.name : null))
            .filter(Boolean)
        : [];

    return { director_name, primary_studio_name, genre_names, cast_ids, cast_names };
}

export function createRagGraphExtractor() {
    return { extract };
}

const ragGraphExtractor = createRagGraphExtractor();

export default ragGraphExtractor;
