/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export function normalizeSetupMediaPath(rawPath) {
  return typeof rawPath === 'string' ? rawPath.trim() : '';
}