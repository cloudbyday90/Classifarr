/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import ragLoopConfig from './ragLoopConfig.shared.js';

export const DEFAULT_IDENTIFIER_CAPS = ragLoopConfig.DEFAULT_IDENTIFIER_CAPS;
export const RAG_LOOP_CONFIG_MANIFEST = ragLoopConfig.RAG_LOOP_CONFIG_MANIFEST;
export const RAG_LOOP_V1_KEYS = ragLoopConfig.RAG_LOOP_V1_KEYS;
export const getRagLoopDefaultConfig = ragLoopConfig.getRagLoopDefaultConfig;
export const resolveRagLoopEffectiveConfig = ragLoopConfig.resolveRagLoopEffectiveConfig;
export const validateAndNormalizeRagLoopConfig = ragLoopConfig.validateAndNormalizeRagLoopConfig;
export default ragLoopConfig;
