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
import { classificationPhaseService } from './classificationPhaseService.mjs';
import ragRetriever from './ragRetriever.mjs';
import policyScoringContextBuilder from './policyScoringContextBuilder.mjs';
import { aiClassify } from './classificationAiService.mjs';
import classificationRagLoopService from './classificationRagLoopService.mjs';
import { resolveClassificationPathAiFailure } from './classificationPathServiceShared.mjs';
import {
	buildPendingRetryResult,
	isAiTransientAvailabilityError,
} from './classificationUtilsService.mjs';
import { ensureDecisionQuestion } from './classificationRoutingService.mjs';
import { createLogger } from '../utils/logger.mjs';

const defaultLogger = createLogger('classificationPolicyPathService');

export class ClassificationPolicyPathService {
	constructor(deps = {}) {
		this.policyEngine = deps.policyEngine || policyEngine;
		this.classificationPhaseService = deps.classificationPhaseService || classificationPhaseService;
		this.ragRetriever = deps.ragRetriever || ragRetriever;
		this.policyScoringContextBuilder = deps.policyScoringContextBuilder || policyScoringContextBuilder;
		this.classificationAiService = deps.classificationAiService || { aiClassify };
		this.classificationRagLoopService = deps.classificationRagLoopService || classificationRagLoopService;
		this.resolveClassificationPathAiFailure = deps.resolveClassificationPathAiFailure || resolveClassificationPathAiFailure;
		this.classificationUtilsService = deps.classificationUtilsService || {
			buildPendingRetryResult,
			isAiTransientAvailabilityError,
		};
		this.ensureDecisionQuestion = deps.ensureDecisionQuestion || ensureDecisionQuestion;
		this.logger = deps.logger || defaultLogger;
	}

	async aiClassify(metadata, libraries, signalContext = null, options = {}) {
		return this.classificationAiService.aiClassify(metadata, libraries, signalContext, options);
	}

	async execute({ metadata, libraries, taskId, relatedEvidence }) {
		let policyResult = null;
		let policySignalContext = null;

		try {
			if (taskId && !metadata.source_library_id) {
				await this.classificationPhaseService.updatePhase(taskId, 'policy_eval');
			}

			this.logger.info('Evaluating with PolicyEngine', { title: metadata.title });
			policyResult = await this.policyEngine.evaluateItem(metadata, { relatedEvidence });

			if (policyResult?.action === 'auto_classify' && policyResult.library) {
				this.logger.info('PolicyEngine auto-classified (AI skipped)', {
					title: metadata.title,
					library: policyResult.library.library_name,
					confidence: policyResult.confidence,
				});

				const matchedLibrary = libraries.find((library) => library.id === policyResult.library.library_id);
				if (!matchedLibrary) {
					this.logger.error('PolicyEngine returned unknown library', {
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
				policySignalContext = this.policyScoringContextBuilder.buildSignalContext(
					policyResult,
					libraries,
					policyResult.ranked,
					relatedEvidence,
				);
			}
		} catch (policyError) {
			this.logger.warn('PolicyEngine evaluation failed, falling back to legacy signals', {
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
			await this.classificationPhaseService.updatePhase(taskId, 'rag_analysis');
		}

		if (ragMatches.length > 0) {
			ragContext = {
				similarItems: ragMatches.slice(0, 3),
				suggestion: this.ragRetriever.getSuggestedLibrary(ragMatches),
			};
		}

		if (taskId && !metadata.source_library_id) {
			await this.classificationPhaseService.updatePhase(taskId, 'ai_analysis', {
				skippedPhases: ['signal_combine'],
				skippedPhaseMetadata: { signal_combine: { reason: 'policy_signal_path' } },
			});
		}

		try {
			const aiMatch = await this.aiClassify(
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
				await this.classificationPhaseService.updatePhase(taskId, 'decision', {
					confidence: aiResult.confidence,
				});
			}

			const finalResult = await this.classificationRagLoopService.evaluateRagLoopSecondPass({
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
				result: await this.ensureDecisionQuestion({
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

			return {
				handled: true,
				result: await this.resolveClassificationPathAiFailure({
					logger: this.logger,
					error,
					metadata,
					ensureDecisionQuestion: this.ensureDecisionQuestion,
					isAiTransientAvailabilityError: this.classificationUtilsService.isAiTransientAvailabilityError,
					policyResult: policyResult || null,
					ragContext,
					confidence: fallbackConfidence,
					suggestedLibrary,
					libraries,
					signalContext: policySignalContext,
					transientError: error,
					previousRetryCount: metadata.retry_count,
					maxRetries: metadata.max_retries,
					buildPendingRetryResult: this.classificationUtilsService.buildPendingRetryResult,
					signalCalculationReason: 'Calculated from policy signals (AI unavailable)',
					signalCalculationResultFields: {
						policyResult,
					},
				}),
			};
		}
	}
}

export const classificationPolicyPathService = new ClassificationPolicyPathService();
export const execute = classificationPolicyPathService.execute.bind(classificationPolicyPathService);
