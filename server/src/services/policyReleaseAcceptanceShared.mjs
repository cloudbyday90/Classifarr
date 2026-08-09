/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(item => stableValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      const normalized = stableValue(value[key]);

      if (normalized !== undefined) {
        result[key] = normalized;
      }

      return result;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizeString(value, maximumLength = 255) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function isIsoTimestamp(value) {
  return typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

export {
  asObject,
  isIsoTimestamp,
  normalizeString,
  sha256,
  stableStringify,
};
