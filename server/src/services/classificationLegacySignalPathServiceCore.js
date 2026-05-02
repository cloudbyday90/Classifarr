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

const signalCollectorModule = require('./signalCollector');
const ragRetriever = require('./ragRetriever');
const confidenceCalculator = require('./confidenceCalculator');
const classificationPhaseService = require('./classificationPhaseService');
const classificationEvidenceService = require('./classificationEvidenceService');
const classificationAiService = require('./classificationAiService');
const classificationRagLoopService = require('./classificationRagLoopService');
const classificationUtilsService = require('./classificationUtilsService');
const classificationRoutingService = require('./classificationRoutingService');
const classificationLearnedCorrectionsService = require('./classificationLearnedCorrectionsService');
const libraryRulesService = require('./libraryRulesService');
const libraryLabelsService = require('./libraryLabelsService');
const contentTypeAnalyzer = require('./contentTypeAnalyzer');
const mediaSyncService = require('./mediaSync');
const { createLogger } = require('../utils/logger');

const { SignalCollector, SIGNAL_TYPES } = signalCollectorModule;
const logger = createLogger('classificationLegacySignalPathService');

async function defaultLoadMediaSyncService() {
  return mediaSyncService;
}

async function execute({
  metadata,
  libraries,
  taskId,
  relatedEvidence,
  policyResult = null,
  loadMediaSyncService = defaultLoadMediaSyncService,
}) {
  const signalCollector = new SignalCollector();

  const detectors = {
    checkLearnedCorrections: classificationLearnedCorrectionsService.checkLearnedCorrections.bind(
      classificationLearnedCorrectionsService,
    ),
    checkLibraryRules: libraryRulesService.checkLibraryRules.bind(libraryRulesService),
    findExistingMedia: async (...args) => {
      const loadedMediaSyncService = await loadMediaSyncService();
      return loadedMediaSyncService.findExistingMedia(...args);
    },
    analyzeContent: contentTypeAnalyzer.analyze.bind(contentTypeAnalyzer),
    checkExactMatch: (tmdbId, mediaType) =>
      classificationEvidenceService.findExactMatch({ tmdbId, mediaType })
        .then((match) => (match ? { library_id: match.libraryId, confidence: match.confidence } : null)),
    matchRules: libraryLabelsService.matchRules.bind(libraryLabelsService),
  };

  await signalCollector.collectAll(metadata, libraries, detectors);

  let ragContext = null;
  try {
    if (taskId && !metadata.source_library_id) {
      await classificationPhaseService.updatePhase(taskId, 'rag_analysis');
    }

    const similarItems = await ragRetriever.semanticSearch(metadata, 5);
    if (similarItems && similarItems.length > 0) {
      const suggestedLibrary = ragRetriever.getSuggestedLibrary(similarItems);
      const dynamicWeight = ragRetriever.calculateDynamicWeight(similarItems);
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
            suggestion: ragRetriever.getSuggestedLibrary(similarItems),
          };
        }
      }
    }
  } catch (ragError) {
    logger.debug('RAG search failed, continuing without', { error: ragError.message });
  }

  if (taskId && !metadata.source_library_id) {
    await classificationPhaseService.updatePhase(taskId, 'signal_combine');
  }

  await confidenceCalculator.loadWeights();
  const confidenceResult = confidenceCalculator.calculate(signalCollector.getSignals());

  if (taskId && !metadata.source_library_id) {
    await classificationPhaseService.updatePhase(taskId, 'ai_analysis');
  }

  const aiContext = confidenceCalculator.toAIContext(confidenceResult);
  const signalContext = {
    ...confidenceResult,
    aiContext,
    ragContext,
    signals: signalCollector.getSignals(),
    patternSignals: signalCollector.getPatternSignals(),
    relatedEvidenceSummary: classificationEvidenceService.buildRelatedEvidenceSummary(relatedEvidence, libraries),
  };

  try {
    const aiMatch = await classificationAiService.aiClassify(metadata, libraries, signalContext);
    const aiResult = {
      ...aiMatch,
      method: aiMatch.verified_by_ai ? 'ai_verified' : 'ai_analysis',
      libraries,
      signalContext,
      policyResult: policyResult || null,
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
      policyResult: policyResult || null,
      signalContext,
      ragContext,
    });
    const effectiveRagContext = finalResult.ragContext || ragContext;

    return classificationRoutingService.ensureDecisionQuestion({
      metadata,
      result: finalResult,
      policyResult: metadata.policyResult || null,
      libraries,
      ragContext: effectiveRagContext,
    });
  } catch (error) {
    const isTransientAiAvailability = classificationUtilsService.isAiTransientAvailabilityError(error);

    if (isTransientAiAvailability) {
      logger.warn('AI classification temporarily unavailable', {
        error: error.message,
        code: error.code,
      });
    } else {
      logger.error('AI classification failed', { error: error.message });
    }

    if (isTransientAiAvailability || confidenceResult.confidence < 50) {
      logger.info('AI unavailable/busy - queuing for retry', {
        confidence: confidenceResult.confidence,
        tmdbId: metadata.tmdb_id,
        title: metadata.title,
        transient_ai_availability: isTransientAiAvailability,
      });
      return classificationUtilsService.buildPendingRetryResult({
        confidence: confidenceResult.confidence,
        libraries,
        signalContext,
        transientError: error,
        previousRetryCount: metadata.retry_count,
        maxRetries: metadata.max_retries,
      });
    }

    if (confidenceResult.suggestedLibrary && confidenceResult.confidence >= 50) {
      return classificationRoutingService.ensureDecisionQuestion({
        metadata,
        result: {
          library: confidenceResult.suggestedLibrary,
          confidence: confidenceResult.confidence,
          method: 'signal_calculation',
          reason: 'Calculated from signals (AI unavailable)',
          libraries,
        },
        policyResult: metadata.policyResult || null,
        libraries,
        ragContext,
      });
    }

    const fallbackLibrary = libraries[libraries.length - 1];
    return classificationRoutingService.ensureDecisionQuestion({
      metadata,
      result: {
        library: fallbackLibrary,
        confidence: 50,
        method: 'fallback',
        reason: `Default library - AI unavailable (fell back to ${fallbackLibrary.name})`,
        libraries,
      },
      policyResult: metadata.policyResult || null,
      libraries,
      ragContext,
    });
  }
}

const classificationLegacySignalPathService = { execute };

module.exports = classificationLegacySignalPathService;
module.exports.default = classificationLegacySignalPathService;
