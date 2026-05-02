/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import ragLoopPayloadValidation from './ragLoopPayloadValidation.shared.js';

export const RAG_LOOP_CONFIG_KEY_PREFIXES = ragLoopPayloadValidation.RAG_LOOP_CONFIG_KEY_PREFIXES;
export const RAG_LOOP_DISALLOWED_OVERRIDE_KEYS = ragLoopPayloadValidation.RAG_LOOP_DISALLOWED_OVERRIDE_KEYS;
export const validateRagLoopConfigPayloadKeys = ragLoopPayloadValidation.validateRagLoopConfigPayloadKeys;

export default ragLoopPayloadValidation;
