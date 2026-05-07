/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
export function coerceMetadataArray(values) {
  if (Array.isArray(values)) {
    return values;
  }

  if (typeof values === 'string') {
    try {
      const parsed = JSON.parse(values);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
}

export function normalizeMetadataList(values) {
  return coerceMetadataArray(values)
    .map(value => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
      }

      if (value && typeof value === 'object' && typeof value.name === 'string') {
        const trimmed = value.name.trim();
        return trimmed ? trimmed : null;
      }

      if (value && typeof value === 'object' && typeof value.tag === 'string') {
        const trimmed = value.tag.trim();
        return trimmed ? trimmed : null;
      }

      if (value && typeof value === 'object' && typeof value.title === 'string') {
        const trimmed = value.title.trim();
        return trimmed ? trimmed : null;
      }

      return null;
    })
    .filter(Boolean);
}

export function normalizeMetadataListLower(values) {
  return normalizeMetadataList(values).map(value => value.toLowerCase());
}
