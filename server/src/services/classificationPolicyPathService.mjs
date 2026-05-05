/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import policyEngine from './policyEngine.mjs';
import classificationPhaseService from './classificationPhaseService.mjs';
import ragRetriever from './ragRetriever.mjs';
import policyScoringContextBuilder from './policyScoringContextBuilder.mjs';
import { aiClassify } from './classificationAiService.mjs';
import classificationRagLoopService from './classificationRagLoopService.mjs';
import { buildAiUnavailableResult } from './classificationPathServiceShared.mjs';
import {
	buildPendingRetryResult,
	isAiTransientAvailabilityError,
} from './classificationUtilsService.mjs';
import { ensureDecisionQuestion } from './classificationRoutingService.mjs';
import loggerModule from '../utils/logger.mjs';

const { createLogger } = loggerModule;
const logger = createLogger('classificationPolicyPathService');

export async function execute({ metadata, libraries, taskId, relatedEvidence }) {
	let policyResult = null;
	let policySignalContext = null;

	try {
		if (taskId && !metadata.source_library_id) {
			await classificationPhaseService.updatePhase(taskId, 'policy_eval');
		}

		logger.info('Evaluating with PolicyEngine', { title: metadata.title });
		policyResult = await policyEngine.evaluateItem(metadata, { relatedEvidence });

		if (policyResult?.action === 'auto_classify' && policyResult.library) {
			logger.info('PolicyEngine auto-classified (AI skipped)', {
				title: metadata.title,
				library: policyResult.library.library_name,
				confidence: policyResult.confidence,
			});

			const matchedLibrary = libraries.find((library) => library.id === policyResult.library.library_id);
			if (!matchedLibrary) {
				logger.error('PolicyEngine returned unknown library', {
					policyLibraryId: policyResult.library.library_id,
				});
				throw new Error('PolicyEngine selected unknown library');
			}

			return {
				handled: true,
				result: {
					library: matchedLibrary,
					confidence: policyResult.confidence,
					method: 'policy_auto',
					reason: `Policy: ${policyResult.library.policy_name}`,
					libraries,
					policyResult,
				},
			};
		}

		if (policyResult?.ranked && policyResult.ranked.length > 0) {
			metadata.policyResult = policyResult;
			policySignalContext = policyScoringContextBuilder.buildSignalContext(
				policyResult,
				libraries,
				policyResult.ranked,
				relatedEvidence,
			);
		}
	} catch (policyError) {
		logger.warn('PolicyEngine evaluation failed, falling back to legacy signals', {
			error: policyError.message,
			title: metadata.title,
		});
		return { handled: false, policyResult: null };
	}

	if (!policySignalContext) {
		return { handled: false, policyResult };
	}

	let ragContext = null;
	const ragCache = policyResult?.ragCache || null;
	const ragMatches = ragCache?.matches || [];

	if (ragCache && taskId && !metadata.source_library_id) {
		await classificationPhaseService.updatePhase(taskId, 'rag_analysis');
	}

	if (ragMatches.length > 0) {
		ragContext = {
			similarItems: ragMatches.slice(0, 3),
			suggestion: ragRetriever.getSuggestedLibrary(ragMatches),
		};
	}

	if (taskId && !metadata.source_library_id) {
		await classificationPhaseService.updatePhase(taskId, 'ai_analysis', {
			skippedPhases: ['signal_combine'],
			skippedPhaseMetadata: { signal_combine: { reason: 'policy_signal_path' } },
		});
	}

	try {
		const aiMatch = await aiClassify(
			metadata,
			libraries,
			policySignalContext,
			{ mode: 'classify', ragContext },
		);
		const aiResult = {
			...aiMatch,
			method: aiMatch.verified_by_ai ? 'ai_verified' : 'ai_analysis',
			libraries,
			signalContext: policySignalContext,
			policyResult,
			ragContext,
		};

		if (taskId && !metadata.source_library_id) {
			await classificationPhaseService.updatePhase(taskId, 'decision', {
				confidence: aiResult.confidence,
			});
		}

		const finalResult = await classificationRagLoopService.evaluateRagLoopSecondPass({
			metadata,
			libraries,
			baselineResult: aiResult,
			policyResult,
			signalContext: policySignalContext,
			ragContext,
		});
		const effectiveRagContext = finalResult.ragContext || ragContext;

		return {
			handled: true,
			result: await ensureDecisionQuestion({
				metadata,
				result: finalResult,
				policyResult: policyResult || null,
				libraries,
				ragContext: effectiveRagContext,
			}),
		};
	} catch (error) {
		const fallbackConfidence = policySignalContext.confidence || 0;
		const suggestedLibrary = policySignalContext.suggestedLibrary;
		const isTransientAiAvailability = isAiTransientAvailabilityError(error);

		if (isTransientAiAvailability) {
			logger.warn('AI classification temporarily unavailable', {
				error: error.message,
				code: error.code,
			});
		} else {
			logger.error('AI classification failed', { error: error.message });
		}

		if (isTransientAiAvailability || fallbackConfidence < 50) {
			logger.info('AI unavailable/busy - queuing for retry', {
				confidence: fallbackConfidence,
				tmdbId: metadata.tmdb_id,
				title: metadata.title,
				transient_ai_availability: isTransientAiAvailability,
			});
			return {
				handled: true,
				result: buildAiUnavailableResult({
					isTransientAiAvailability,
					confidence: fallbackConfidence,
					suggestedLibrary,
					libraries,
					signalContext: policySignalContext,
					transientError: error,
					previousRetryCount: metadata.retry_count,
					maxRetries: metadata.max_retries,
					buildPendingRetryResult,
					signalCalculationReason: 'Calculated from policy signals (AI unavailable)',
					signalCalculationResultFields: {
						policyResult,
					},
				}),
			};
		}

		if (suggestedLibrary && fallbackConfidence >= 50) {
			return {
				handled: true,
				result: await ensureDecisionQuestion({
					metadata,
					result: buildAiUnavailableResult({
						isTransientAiAvailability,
						confidence: fallbackConfidence,
						suggestedLibrary,
						libraries,
						signalContext: policySignalContext,
						transientError: error,
						previousRetryCount: metadata.retry_count,
						maxRetries: metadata.max_retries,
						buildPendingRetryResult,
						signalCalculationReason: 'Calculated from policy signals (AI unavailable)',
						signalCalculationResultFields: {
							policyResult,
						},
					}),
					policyResult: policyResult || null,
					libraries,
					ragContext,
				}),
			};
		}

		return {
			handled: true,
			result: await ensureDecisionQuestion({
				metadata,
				result: buildAiUnavailableResult({
					isTransientAiAvailability,
					confidence: fallbackConfidence,
					suggestedLibrary,
					libraries,
					signalContext: policySignalContext,
					transientError: error,
					previousRetryCount: metadata.retry_count,
					maxRetries: metadata.max_retries,
					buildPendingRetryResult,
					signalCalculationReason: 'Calculated from policy signals (AI unavailable)',
					signalCalculationResultFields: {
						policyResult,
					},
				}),
				policyResult: policyResult || null,
				libraries,
				ragContext,
			}),
		};
	}
}
