/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function isBlank(value) {
  return typeof value !== 'string' || value.trim().length === 0;
}

export function sanitizeRuntimeSignature(value) {
  return String(value || 'generic')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .slice(0, 160);
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
