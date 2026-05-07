/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as shared from './ragLoop/shared.mjs';
import * as db from './ragLoop/db.mjs';
import * as metadata from './ragLoop/metadata.mjs';
import * as decision from './ragLoop/decision.mjs';
import * as trace from './ragLoop/trace.mjs';

export const ragLoopHelpers = {
  TRACE_VERSION: shared.TRACE_VERSION,
  RAG_LOOP_REASON_CODES: shared.RAG_LOOP_REASON_CODES,
  RAG_LOOP_FALLBACK_ACTIONS: shared.RAG_LOOP_FALLBACK_ACTIONS,
  applyOrShadowDecision: decision.applyOrShadowDecision,
  buildRagLoopTrace: trace.buildRagLoopTrace,
  classifyDbSqlState: db.classifyDbSqlState,
  comparePassResults: decision.comparePassResults,
  detectRagConflict: decision.detectRagConflict,
  evaluatePolicyRecheckGate: decision.evaluatePolicyRecheckGate,
  expandRetrievalMetadata: metadata.expandRetrievalMetadata,
  extractVerifiableEvidence: metadata.extractVerifiableEvidence,
  getRecheckEligibility: metadata.getRecheckEligibility,
  getMetadataCompleteness: metadata.getMetadataCompleteness,
  getMissingHighImpactFields: metadata.getMissingHighImpactFields,
  isAiRerunEligible: decision.isAiRerunEligible,
  isRetryableDbConflictError: db.isRetryableDbConflictError,
  isLearningEligible: decision.isLearningEligible,
  isMetadataEnrichmentEligible: decision.isMetadataEnrichmentEligible,
  resolvePolicyContextOrFallback: metadata.resolvePolicyContextOrFallback,
  resolveConflictDecision: decision.resolveConflictDecision,
  selectRetryStrategy: decision.selectRetryStrategy,
  shouldTriggerSecondPass: decision.shouldTriggerSecondPass,
  summarizePassDiagnostics: decision.summarizePassDiagnostics,
};

export const {
  TRACE_VERSION,
  RAG_LOOP_REASON_CODES,
  RAG_LOOP_FALLBACK_ACTIONS,
  applyOrShadowDecision,
  buildRagLoopTrace,
  classifyDbSqlState,
  comparePassResults,
  detectRagConflict,
  evaluatePolicyRecheckGate,
  expandRetrievalMetadata,
  extractVerifiableEvidence,
  getRecheckEligibility,
  getMetadataCompleteness,
  getMissingHighImpactFields,
  isAiRerunEligible,
  isRetryableDbConflictError,
  isLearningEligible,
  isMetadataEnrichmentEligible,
  resolvePolicyContextOrFallback,
  resolveConflictDecision,
  selectRetryStrategy,
  shouldTriggerSecondPass,
  summarizePassDiagnostics,
} = ragLoopHelpers;
