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

import { SignalCollector, SIGNAL_TYPES } from './signalCollector.mjs';
import { ragRetriever } from './ragRetriever.mjs';
import { confidenceCalculator } from './confidenceCalculator.mjs';
import { classificationProgressStageService } from './classificationProgressStageService.mjs';
import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import { classificationAiService } from './classificationAiService.mjs';
import { classificationRagLoopService } from './classificationRagLoopService.mjs';
import {
	resolveClassificationPathAiFailure,
	resolveClassificationPathAiSuccess,
} from './classificationPathServiceShared.mjs';
import { classificationUtilsService } from './classificationUtilsService.mjs';
import { classificationRoutingService } from './classificationRoutingService.mjs';
import { classificationLearnedCorrectionsService } from './classificationLearnedCorrectionsService.mjs';
import { libraryRulesService } from './libraryRulesService.mjs';
import { libraryLabelsService } from './libraryLabelsService.mjs';
import { contentTypeAnalyzer } from './contentTypeAnalyzer.mjs';
import { mediaSyncLibraryStateService as mediaSyncLibraryStateServiceModule } from './mediaSyncLibraryStateService.mjs';
import { createLogger } from '../utils/logger.mjs';

const defaultLogger = createLogger('classificationLegacySignalPathService');

export class ClassificationLegacySignalPathService {
	constructor(deps = {}) {
		this.SignalCollectorClass = deps.SignalCollectorClass || SignalCollector;
		this.ragRetriever = deps.ragRetriever || ragRetriever;
		this.confidenceCalculator = deps.confidenceCalculator || confidenceCalculator;
		this.classificationProgressStageService = deps.classificationProgressStageService || classificationProgressStageService;
		this.classificationEvidenceService = deps.classificationEvidenceService || classificationEvidenceService;
		this.classificationAiService = deps.classificationAiService || classificationAiService;
		this.classificationRagLoopService = deps.classificationRagLoopService || classificationRagLoopService;
		this.resolveClassificationPathAiFailure = deps.resolveClassificationPathAiFailure || resolveClassificationPathAiFailure;
		this.classificationUtilsService = deps.classificationUtilsService || classificationUtilsService;
		this.classificationRoutingService = deps.classificationRoutingService || classificationRoutingService;
		this.classificationLearnedCorrectionsService = deps.classificationLearnedCorrectionsService || classificationLearnedCorrectionsService;
		this.libraryRulesService = deps.libraryRulesService || libraryRulesService;
		this.libraryLabelsService = deps.libraryLabelsService || libraryLabelsService;
		this.contentTypeAnalyzer = deps.contentTypeAnalyzer || contentTypeAnalyzer;
		this.mediaSyncLibraryStateService = deps.mediaSyncLibraryStateService || mediaSyncLibraryStateServiceModule;
		this.logger = deps.logger || defaultLogger;
	}

	async aiClassify(metadata, libraries, signalContext = null, options = {}) {
		return this.classificationAiService.aiClassify(metadata, libraries, signalContext, options);
	}

	async execute({
		metadata,
		libraries,
		taskId,
		relatedEvidence,
		policyResult = null,
		mediaSyncLibraryStateService = this.mediaSyncLibraryStateService,
	}) {
		const signalCollector = new this.SignalCollectorClass();

		const detectors = {
			classificationLearnedCorrectionsService: this.classificationLearnedCorrectionsService,
			libraryRulesService: this.libraryRulesService,
			libraryLabelsService: this.libraryLabelsService,
			mediaSyncLibraryStateService,
			contentTypeAnalyzer: this.contentTypeAnalyzer,
			classificationEvidenceService: this.classificationEvidenceService,
		};

		await signalCollector.collectAll(metadata, libraries, detectors);

		let ragContext = null;
		try {
			if (taskId && !metadata.source_library_id) {
				await this.classificationProgressStageService.updateStage(taskId, 'rag_analysis');
			}

			const similarItems = await this.ragRetriever.semanticSearch(metadata, 5);
			if (similarItems && similarItems.length > 0) {
				const suggestedLibrary = this.ragRetriever.getSuggestedLibrary(similarItems);
				const dynamicWeight = this.ragRetriever.calculateDynamicWeight(similarItems);
				if (suggestedLibrary) {
					const ragLibrary = libraries.find((library) => library.id === suggestedLibrary.libraryId);
					if (ragLibrary) {
						if (!signalCollector.hasSignal(SIGNAL_TYPES.SEMANTIC_SIMILARITY)) {
							signalCollector.addSignal(
								SIGNAL_TYPES.SEMANTIC_SIMILARITY,
								{
									similarItems: similarItems.slice(0, 3),
									avgSimilarity: suggestedLibrary.avgSimilarity,
									voteCount: suggestedLibrary.voteCount,
								},
								dynamicWeight,
								ragLibrary,
							);
						}

						ragContext = {
							similarItems: similarItems.slice(0, 3),
							suggestion: this.ragRetriever.getSuggestedLibrary(similarItems),
						};
					}
				}
			}
		} catch (ragError) {
			this.logger.debug('RAG search failed, continuing without', { error: ragError.message });
		}

		if (taskId && !metadata.source_library_id) {
			await this.classificationProgressStageService.updateStage(taskId, 'signal_combine');
		}

		await this.confidenceCalculator.loadWeights();
		const confidenceResult = this.confidenceCalculator.calculate(signalCollector.getSignals());

		if (taskId && !metadata.source_library_id) {
			await this.classificationProgressStageService.updateStage(taskId, 'ai_analysis');
		}

		const aiContext = this.confidenceCalculator.toAIContext(confidenceResult);
		const signalContext = {
			...confidenceResult,
			aiContext,
			ragContext,
			signals: signalCollector.getSignals(),
			patternSignals: signalCollector.getPatternSignals(),
			relatedEvidenceSummary: this.classificationEvidenceService.buildRelatedEvidenceSummary(relatedEvidence, libraries),
		};

		try {
			const aiMatch = await this.aiClassify(metadata, libraries, signalContext);
			return resolveClassificationPathAiSuccess({
				metadata,
				aiMatch,
				libraries,
				signalContext,
				policyResult: policyResult || null,
				decisionPolicyResult: metadata.policyResult || null,
				ragContext,
				taskId,
				classificationProgressStageService: this.classificationProgressStageService,
				classificationRagLoopService: this.classificationRagLoopService,
				ensureDecisionQuestion: this.classificationRoutingService.ensureDecisionQuestion,
			});
		} catch (error) {
			return this.resolveClassificationPathAiFailure({
				logger: this.logger,
				error,
				metadata,
				ensureDecisionQuestion: this.classificationRoutingService.ensureDecisionQuestion,
				isAiTransientAvailabilityError: this.classificationUtilsService.isAiTransientAvailabilityError,
				policyResult: metadata.policyResult || null,
				ragContext,
				confidence: confidenceResult.confidence,
				suggestedLibrary: confidenceResult.suggestedLibrary,
				libraries,
				signalContext,
				transientError: error,
				previousRetryCount: metadata.retry_count,
				maxRetries: metadata.max_retries,
				buildPendingRetryResult: this.classificationUtilsService.buildPendingRetryResult,
				signalCalculationReason: 'Calculated from signals (AI unavailable)',
			});
		}
	}
}

export const classificationLegacySignalPathService = new ClassificationLegacySignalPathService();
/** @internal */
export const execute = classificationLegacySignalPathService.execute.bind(classificationLegacySignalPathService);
