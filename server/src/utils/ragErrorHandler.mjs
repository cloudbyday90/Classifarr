/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import ragErrorHandler from './ragErrorHandler.shared.js';

const {
    RAGError,
    RAG_ERROR_TYPES,
    RAG_SECOND_PASS_REASON_CODES,
    RAG_SECOND_PASS_STAGES,
    categorizeError,
    isRecoverable,
    mapSecondPassError,
    normalizeReasonCode,
    normalizeSecondPassStage,
    withRAGErrorHandling
} = ragErrorHandler;

export {
    RAGError,
    RAG_ERROR_TYPES,
    RAG_SECOND_PASS_REASON_CODES,
    RAG_SECOND_PASS_STAGES,
    categorizeError,
    isRecoverable,
    mapSecondPassError,
    normalizeReasonCode,
    normalizeSecondPassStage,
    withRAGErrorHandling
};

export default ragErrorHandler;
