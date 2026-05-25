/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const VALID_PRIORITIES = ['rules_first', 'patterns_first'];

export { parseIntParam } from './evidenceRouteHelpers.mjs';

export function parseFloatParam(value, defaultValue, min = null, max = null) {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) return defaultValue;
    if (min !== null && parsed < min) return defaultValue;
    if (max !== null && parsed > max) return defaultValue;
    return parsed;
}
