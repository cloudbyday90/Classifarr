/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function mapOptionsToLibraries(optionTexts, libraries, logger) {
    return optionTexts.map(opt => {
        const optLower = opt.toLowerCase();
        const optClean = optLower
            .replace(/^["'`]+|["'`]+$/g, '')
            .replace(/^(\d+\.|[a-z]\.|[([]\d+[)\]]|[([][a-z][)\]]|[-•*·])\s+/i, '')
            .replace(/\s*(library|content|media)\s*/gi, '')
            .trim();

        let matchedLibrary = libraries.find(lib => {
            const libLower = lib.name.toLowerCase();
            return libLower === optLower || libLower === optClean;
        });

        if (!matchedLibrary) {
            matchedLibrary = libraries.find(lib => {
                const libLower = lib.name.toLowerCase();
                return optClean.includes(libLower) || libLower.includes(optClean);
            });
        }

        if (!matchedLibrary) {
            logger.debug('AI suggested library name that does not match any known library — option dropped', {
                suggested: opt,
                knownLibraries: libraries.map(l => l.name),
            });
            return null;
        }

        return {
            label: opt,
            value: opt.toLowerCase().replace(/\s+/g, '_').substring(0, 30),
            library_id: matchedLibrary.id,
            library_name: matchedLibrary.name,
        };
    }).filter(Boolean)
      .filter((opt, idx, arr) => arr.findIndex(o => o.library_id === opt.library_id) === idx);
}

export function resolveOptionsFromTokens(tokens, libraries, logger) {
    const resolved = tokens.map(token => {
        if (/^\d+$/.test(token)) {
            const idx = parseInt(token, 10) - 1;
            const lib = libraries[idx];
            if (lib) {
                return {
                    label: lib.name,
                    value: lib.name.toLowerCase().replace(/\s+/g, '_').substring(0, 30),
                    library_id: lib.id,
                    library_name: lib.name,
                };
            }
            logger.debug('CLARIFY option index out of range — option dropped', {
                index: parseInt(token, 10),
                libraryCount: libraries.length,
            });
            return null;
        }

        const textMatches = mapOptionsToLibraries([token], libraries, logger);
        return textMatches[0] || null;
    });

    return resolved
        .filter(Boolean)
        .filter((opt, idx, arr) => arr.findIndex(o => o.library_id === opt.library_id) === idx);
}
