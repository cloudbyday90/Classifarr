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

import { policyEngine } from './policyEngine.mjs';
import { classificationProgressStageService } from './classificationProgressStageService.mjs';
import { ragRetriever } from './ragRetriever.mjs';
import * as policyScoringContextBuilder from './policyScoringContextBuilder.mjs';
import { classificationAiService } from './classificationAiService.mjs';
import { classificationRagLoopService } from './classificationRagLoopService.mjs';
import {
	resolveClassificationPathAiFailure,
	resolveClassificationPathAiSuccess,
} from './classificationPathServiceShared.mjs';
import { classificationUtilsService } from './classificationUtilsService.mjs';
import { classificationRoutingService } from './classificationRoutingService.mjs';
import {
	buildDeterministicOutcomeAiAbstentionResult,
	resolveDeterministicOutcomeAiMode,
} from './classificationDeterministicAiMode.mjs';
import {
	buildPolicyCandidateAdjudicationContract,
} from './policyCandidateAdjudicationContract.mjs';
import {
	policyCandidateAdjudicationEvidenceService,
} from './policyCandidateAdjudicationEvidence.mjs';
import {
	finalizePolicyCandidateAdjudication,
} from './policyCandidateAdjudicationResult.mjs';
import { createLogger } from '../utils/logger.mjs';

const defaultLogger = createLogger('classificationPolicyPathService');

export class ClassificationPolicyPathService {
	constructor(deps = {}) {
		this.policyEngine = deps.policyEngine || policyEngine;
		this.classificationProgressStageService = deps.classificationProgressStageService || classificationProgressStageService;
		this.ragRetriever = deps.ragRetriever || ragRetriever;
		this.policyScoringContextBuilder = deps.policyScoringContextBuilder || policyScoringContextBuilder;
		this.classificationAiService = deps.classificationAiService || classificationAiService;
		this.classificationRagLoopService = deps.classificationRagLoopService || classificationRagLoopService;
		this.resolveClassificationPathAiFailure = deps.resolveClassificationPathAiFailure || resolveClassificationPathAiFailure;
		this.classificationUtilsService = deps.classificationUtilsService || classificationUtilsService;
		this.classificationRoutingService = deps.classificationRoutingService || classificationRoutingService;
		this.resolveDeterministicOutcomeAiMode = deps.resolveDeterministicOutcomeAiMode || resolveDeterministicOutcomeAiMode;
		this.buildDeterministicOutcomeAiAbstentionResult = deps.buildDeterministicOutcomeAiAbstentionResult || buildDeterministicOutcomeAiAbstentionResult;
		this.buildPolicyCandidateAdjudicationContract = deps.buildPolicyCandidateAdjudicationContract || buildPolicyCandidateAdjudicationContract;
		this.policyCandidateAdjudicationEvidenceService = deps.policyCandidateAdjudicationEvidenceService || policyCandidateAdjudicationEvidenceService;
		this.finalizePolicyCandidateAdjudication = deps.finalizePolicyCandidateAdjudication || finalizePolicyCandidateAdjudication;
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
				await this.classificationProgressStageService.updateStage(taskId, 'policy_eval');
			}

			this.logger.info('Evaluating with PolicyEngine', { title: metadata.title });
			policyResult = await this.policyEngine.evaluateItem(metadata, { relatedEvidence });

			if (policyResult?.action === 'auto_classify') {
				if (!policyResult.library) {
					this.logger.error('PolicyEngine auto-classification did not include a destination', {
						title: metadata.title,
					});
					const error = new Error('PolicyEngine auto-classification selected no library');
					error.code = 'POLICY_INVALID_DESTINATION';
					throw error;
				}

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
					const error = new Error('PolicyEngine selected unknown library');
					error.code = 'POLICY_INVALID_DESTINATION';
					throw error;
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
						deterministic_ai_mode: this.resolveDeterministicOutcomeAiMode({
							policyResult,
							libraries,
						}),
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
			this.logger.warn('Policy path could not produce a valid deterministic outcome; requiring operator review', {
				error: policyError.message,
				title: metadata.title,
			});

			const invalidPolicyDestination = policyError?.code === 'POLICY_INVALID_DESTINATION';
			const aiModeDecision = this.resolveDeterministicOutcomeAiMode({
				policyResult: invalidPolicyDestination ? policyResult : null,
				libraries,
				policyEvaluationFailed: !invalidPolicyDestination,
			});
			const result = this.buildDeterministicOutcomeAiAbstentionResult({
				policyResult: invalidPolicyDestination ? policyResult : null,
				libraries,
				aiModeDecision,
			});

			if (taskId && !metadata.source_library_id) {
				await this.classificationProgressStageService.updateStage(taskId, 'decision', {
					confidence: result.confidence,
					skippedStages: ['rag_analysis', 'signal_combine', 'ai_analysis'],
					skippedStageMetadata: {
						rag_analysis: { reason: aiModeDecision.reasonCode },
						signal_combine: { reason: aiModeDecision.reasonCode },
						ai_analysis: { reason: aiModeDecision.reasonCode },
					},
				});
			}

			return {
				handled: true,
				result: await this.classificationRoutingService.ensureDecisionQuestion({
					metadata,
					result,
					libraries,
				}),
			};
		}

		if (!policySignalContext) {
			return { handled: false, policyResult };
		}

		let ragContext = null;
		const ragCache = policyResult?.ragCache || null;
		const ragMatches = ragCache?.matches || [];

		if (ragCache && taskId && !metadata.source_library_id) {
			await this.classificationProgressStageService.updateStage(taskId, 'rag_analysis');
		}

		if (ragMatches.length > 0) {
			ragContext = {
				similarItems: ragMatches.slice(0, 3),
				suggestion: this.ragRetriever.getSuggestedLibrary(ragMatches),
			};
		}

		const candidateAdjudication = this.buildPolicyCandidateAdjudicationContract({
			policyResult,
			libraries,
			mediaType: metadata.media_type,
		});
		const candidateAdjudicationEvidence = candidateAdjudication.valid
			? await this.policyCandidateAdjudicationEvidenceService.build({
				contract: candidateAdjudication,
				ragContext,
			})
			: null;

		const aiModeDecision = this.resolveDeterministicOutcomeAiMode({
			policyResult,
			libraries,
			candidateAdjudication,
		});

		if (!aiModeDecision.shouldInvoke) {
			const result = this.buildDeterministicOutcomeAiAbstentionResult({
				policyResult,
				libraries,
				signalContext: policySignalContext,
				aiModeDecision,
			});

			this.logger.info('AI classification abstained for deterministic policy outcome', {
				title: metadata.title,
				policyAction: aiModeDecision.policyAction,
				reasonCode: aiModeDecision.reasonCode,
			});

			if (taskId && !metadata.source_library_id) {
				await this.classificationProgressStageService.updateStage(taskId, 'decision', {
					confidence: result.confidence,
					skippedStages: ['signal_combine', 'ai_analysis'],
					skippedStageMetadata: {
						signal_combine: { reason: 'policy_signal_path' },
						ai_analysis: { reason: aiModeDecision.reasonCode },
					},
				});
			}

			return {
				handled: true,
				result: await this.classificationRoutingService.ensureDecisionQuestion({
					metadata,
					result,
					policyResult,
					libraries,
					ragContext,
				}),
			};
		}

		if (taskId && !metadata.source_library_id) {
			await this.classificationProgressStageService.updateStage(taskId, 'ai_analysis', {
				skippedStages: ['signal_combine'],
				skippedStageMetadata: { signal_combine: { reason: 'policy_signal_path' } },
			});
		}

		try {
			const aiLibraries = aiModeDecision.mode === 'adjudicate'
				? candidateAdjudication.candidates.map((candidate) => candidate.library)
				: libraries;
			const aiOptions = {
				mode: aiModeDecision.mode,
				ragContext,
				verificationCandidate: policyResult.library || policyResult.ranked?.[0] || null,
				...(aiModeDecision.mode === 'adjudicate'
					? { candidateAdjudicationEvidence }
					: {}),
			};
			const providerMatch = await this.aiClassify(
				metadata,
				aiLibraries,
				policySignalContext,
				aiOptions,
			);
			const aiMatch = {
				...providerMatch,
				deterministic_ai_mode: aiModeDecision,
			};

			if (aiModeDecision.mode === 'adjudicate') {
				const result = {
					...this.finalizePolicyCandidateAdjudication({
						contract: candidateAdjudication,
						aiMatch: providerMatch,
						policyResult,
						libraries,
					}),
					libraries,
					signalContext: policySignalContext,
					policyResult,
					ragContext,
					deterministic_ai_mode: aiModeDecision,
				};

				if (taskId && !metadata.source_library_id) {
					await this.classificationProgressStageService.updateStage(taskId, 'decision', {
						confidence: result.confidence,
						skippedStages: ['signal_combine'],
						skippedStageMetadata: { signal_combine: { reason: 'policy_signal_path' } },
					});
				}

				return {
					handled: true,
					result: await this.classificationRoutingService.ensureDecisionQuestion({
						metadata,
						result,
						policyResult,
						libraries,
						ragContext,
					}),
				};
			}

			return {
				handled: true,
				result: await resolveClassificationPathAiSuccess({
					metadata,
					aiMatch,
					libraries,
					signalContext: policySignalContext,
					policyResult: policyResult || null,
					decisionPolicyResult: policyResult || null,
					ragContext,
					taskId,
					classificationProgressStageService: this.classificationProgressStageService,
					classificationRagLoopService: this.classificationRagLoopService,
					ensureDecisionQuestion: this.classificationRoutingService.ensureDecisionQuestion,
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
					ensureDecisionQuestion: this.classificationRoutingService.ensureDecisionQuestion,
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
/** @internal */
export const execute = classificationPolicyPathService.execute.bind(classificationPolicyPathService);
