/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { RAG_LOOP_V1_KEYS } from './ragLoopConfig.mjs';

const RAG_LOOP_CONFIG_KEY_PREFIXES = Object.freeze([
    'rag_retrieval_loop_',
    'rag_loop_',
    'rag_conflict_',
    'rag_retry_',
    'policy_recheck_',
    'policy_learning_',
    'rag_alias_',
    'rag_title_'
]);

const RAG_LOOP_DISALLOWED_OVERRIDE_KEYS = Object.freeze([
    'rag_loop_override',
    'policy_rag_loop_override',
    'library_policy_rag_loop_override',
    'library_policies.rag_loop_override'
]);

function isRagLoopConfigScopedKey(key) {
    return RAG_LOOP_CONFIG_KEY_PREFIXES.some(prefix => key.startsWith(prefix));
}

function validateRagLoopConfigPayloadKeys(rawConfig = {}) {
    const keys = Object.keys(rawConfig || {});
    const disallowedKeys = keys.filter(key => RAG_LOOP_DISALLOWED_OVERRIDE_KEYS.includes(key));
    const unknownKeys = keys.filter(
        key => isRagLoopConfigScopedKey(key)
            && !RAG_LOOP_V1_KEYS.includes(key)
            && !RAG_LOOP_DISALLOWED_OVERRIDE_KEYS.includes(key)
    );

    return {
        unknownKeys,
        disallowedKeys,
        valid: unknownKeys.length === 0 && disallowedKeys.length === 0
    };
}

const ragLoopPayloadValidation = {
    RAG_LOOP_CONFIG_KEY_PREFIXES,
    RAG_LOOP_DISALLOWED_OVERRIDE_KEYS,
    validateRagLoopConfigPayloadKeys
};

export { RAG_LOOP_CONFIG_KEY_PREFIXES, RAG_LOOP_DISALLOWED_OVERRIDE_KEYS, validateRagLoopConfigPayloadKeys };
export default ragLoopPayloadValidation;
