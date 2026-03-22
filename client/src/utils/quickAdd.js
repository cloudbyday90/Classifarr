/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function normalizeTmdbResult(raw) {
  if (!raw || typeof raw !== 'object') return null

  const mediaType = raw.media_type || raw.mediaType
  if (mediaType !== 'movie' && mediaType !== 'tv') return null

  const title = raw.title || raw.name
  if (!title || !raw.id) return null

  const yearSource = raw.year || raw.release_date || raw.first_air_date || null
  const year = yearSource ? String(yearSource).slice(0, 4) : null

  return {
    id: raw.id,
    media_type: mediaType,
    title,
    year,
  }
}

export function normalizeTmdbResults(rows, limit = 8) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 8
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeTmdbResult)
    .filter(Boolean)
    .slice(0, safeLimit)
}

export function validateQuickAddQuery(query) {
  const trimmed = String(query || '').trim()
  return {
    query: trimmed,
    error: trimmed.length < 2 ? 'Enter at least 2 characters to search TMDB.' : '',
  }
}
