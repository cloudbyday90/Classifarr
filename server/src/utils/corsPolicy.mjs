/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function evaluateCorsOrigin(origin, allowedOrigins = []) {
  if (!origin) {
    return { value: true, reject: false };
  }

  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) {
    return { value: false, reject: false };
  }

  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    return { value: origin, reject: false };
  }

  return { value: false, reject: true };
}

