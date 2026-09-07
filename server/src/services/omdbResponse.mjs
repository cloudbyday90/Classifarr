/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function optionalNumber(value, { grouped = false } = {}) {
    if (typeof value !== 'string' || !value.trim() || value === 'N/A') return null;
    const normalized = grouped ? value.replace(/,/g, '') : value;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
}

export function formatResponse(data) {
	return {
		title: data.Title,
		year: data.Year,
		rated: data.Rated,
		released: data.Released,
		runtime: data.Runtime,
		genre: data.Genre,
		director: data.Director,
		writer: data.Writer,
		actors: data.Actors,
		plot: data.Plot,
		language: data.Language,
		country: data.Country,
		awards: data.Awards,
		poster: data.Poster !== 'N/A' ? data.Poster ?? null : null,
		ratings: data.Ratings?.map(r => ({
			source: r.Source,
			value: r.Value
		})) || [],
		metascore: optionalNumber(data.Metascore),
		imdbRating: optionalNumber(data.imdbRating),
		imdbVotes: optionalNumber(data.imdbVotes, { grouped: true }),
		imdbId: data.imdbID,
		type: data.Type,
		boxOffice: data.BoxOffice !== 'N/A' ? data.BoxOffice ?? null : null,
		production: data.Production !== 'N/A' ? data.Production ?? null : null,
		totalSeasons: optionalNumber(data.totalSeasons)
	};
}

export function extractClassificationData(omdbData) {
	if (!omdbData) return null;

	const genres = omdbData.genre?.split(', ') || [];

	return {
		contentRating: omdbData.rated,
		genres,
		isAnimation: genres.includes('Animation'),
		isDocumentary: genres.includes('Documentary'),
		isComedy: genres.includes('Comedy'),
		isHorror: genres.includes('Horror'),
		isFamily: genres.includes('Family'),
		isKids: ['G', 'TV-G', 'TV-Y', 'TV-Y7'].includes(omdbData.rated),
		isAdult: ['R', 'NC-17', 'TV-MA'].includes(omdbData.rated),
		imdbRating: omdbData.imdbRating,
		awards: omdbData.awards,
		type: omdbData.type
	};
}
