/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import evidenceCompatibilityMapper from './evidenceCompatibilityMapper.shared.js';

export const LEGACY_METHOD = evidenceCompatibilityMapper.LEGACY_METHOD;
export const METHOD_LABELS = evidenceCompatibilityMapper.METHOD_LABELS;
export const toMethod = evidenceCompatibilityMapper.toMethod;
export const toLabel = evidenceCompatibilityMapper.toLabel;
export const toMethodLabel = evidenceCompatibilityMapper.toMethodLabel;
export const isAuthoritative = evidenceCompatibilityMapper.isAuthoritative;
export const buildCompatibilityPayload = evidenceCompatibilityMapper.buildCompatibilityPayload;
export default evidenceCompatibilityMapper;
