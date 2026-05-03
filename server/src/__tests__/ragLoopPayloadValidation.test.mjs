/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
    validateRagLoopConfigPayloadKeys
} from '../utils/ragLoopPayloadValidation.mjs';

describe('ragLoopPayloadValidation', () => {
    test('accepts known RAG loop payload keys and ignores unrelated non-RAG keys', () => {
        const validation = validateRagLoopConfigPayloadKeys({
            rag_loop_rollout_mode: 'shadow',
            policy_recheck_identifier_caps: { keywords: 5 },
            rag_enabled: true
        });

        expect(validation).toEqual({
            valid: true,
            unknownKeys: [],
            disallowedKeys: []
        });
    });

    test('detects unknown RAG loop config keys and disallowed override keys', () => {
        const validation = validateRagLoopConfigPayloadKeys({
            rag_loop_unknown_switch: true,
            rag_loop_override: { enabled: true },
            rag_loop_rollout_mode: 'shadow',
            rag_enabled: true
        });

        expect(validation.valid).toBe(false);
        expect(validation.unknownKeys).toContain('rag_loop_unknown_switch');
        expect(validation.disallowedKeys).toContain('rag_loop_override');
        expect(validation.unknownKeys).not.toContain('rag_enabled');
    });
});
