/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const shared = require('./ragLoop/shared');
const db = require('./ragLoop/db');
const metadata = require('./ragLoop/metadata');
const decision = require('./ragLoop/decision');
const trace = require('./ragLoop/trace');

module.exports = {
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
