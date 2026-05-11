/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function normalizeClassificationServiceConfig(config = {}) {
  const {
    infrastructure = {},
    workflowServices = {},
    domainServices = {},
    utilities = {},
    runtimeServices = {},
  } = config;

  return {
    db: config.db ?? infrastructure.db,
    tmdbService: config.tmdbService ?? infrastructure.tmdbService,
    discordBot: config.discordBot ?? infrastructure.discordBot,
    contentTypeAnalyzer: config.contentTypeAnalyzer ?? infrastructure.contentTypeAnalyzer,
    clarificationService: config.clarificationService ?? infrastructure.clarificationService,
    classificationPhaseService: config.classificationPhaseService ?? workflowServices.classificationPhaseService,
    classificationRetryService: config.classificationRetryService ?? workflowServices.classificationRetryService,
    classificationEvidenceReinforcementService: config.classificationEvidenceReinforcementService ?? workflowServices.classificationEvidenceReinforcementService,
    classificationEvidenceService: config.classificationEvidenceService ?? workflowServices.classificationEvidenceService,
    classificationMetadataService: config.classificationMetadataService ?? domainServices.classificationMetadataService,
    classificationUtilsService: config.classificationUtilsService ?? domainServices.classificationUtilsService,
    classificationRoutingService: config.classificationRoutingService ?? domainServices.classificationRoutingService,
    libraryRulesService: config.libraryRulesService ?? domainServices.libraryRulesService,
    libraryLabelsService: config.libraryLabelsService ?? domainServices.libraryLabelsService,
    classificationLearnedCorrectionsService: config.classificationLearnedCorrectionsService ?? domainServices.classificationLearnedCorrectionsService,
    classificationAiService: config.classificationAiService ?? domainServices.classificationAiService,
    classificationPersistenceService: config.classificationPersistenceService ?? domainServices.classificationPersistenceService,
    classificationRagLoopService: config.classificationRagLoopService ?? domainServices.classificationRagLoopService,
    classificationAuthoritativeSignalService: config.classificationAuthoritativeSignalService ?? domainServices.classificationAuthoritativeSignalService,
    createLogger: config.createLogger ?? utilities.createLogger,
    normalizePolicyDecisionThresholds: config.normalizePolicyDecisionThresholds ?? utilities.normalizePolicyDecisionThresholds,
    idleDetector: config.idleDetector ?? runtimeServices.idleDetector,
    classificationPolicyPathService: config.classificationPolicyPathService ?? runtimeServices.classificationPolicyPathService,
    classificationLegacySignalPathService: config.classificationLegacySignalPathService ?? runtimeServices.classificationLegacySignalPathService,
  };
}

export class ClassificationService {
  constructor({
    db,
    tmdbService,
    discordBot,
    contentTypeAnalyzer,
    clarificationService,
    classificationPhaseService,
    classificationRetryService,
    classificationEvidenceReinforcementService,
    classificationEvidenceService,
    classificationMetadataService,
    classificationUtilsService,
    classificationRoutingService,
    libraryRulesService,
    libraryLabelsService,
    classificationLearnedCorrectionsService,
    classificationAiService,
    classificationPersistenceService,
    classificationRagLoopService,
    classificationAuthoritativeSignalService,
    createLogger,
    normalizePolicyDecisionThresholds,
    idleDetector,
    classificationPolicyPathService,
    classificationLegacySignalPathService,
  }) {
    this.db = db;
    this.tmdbService = tmdbService;
    this.discordBot = discordBot;
    this.contentTypeAnalyzer = contentTypeAnalyzer;
    this.clarificationService = clarificationService;
    this.classificationPhaseService = classificationPhaseService;
    this.classificationRetryService = classificationRetryService;
    this.classificationEvidenceReinforcementService = classificationEvidenceReinforcementService;
    this.classificationEvidenceService = classificationEvidenceService;
    this.classificationMetadataService = classificationMetadataService;
    this.classificationUtilsService = classificationUtilsService;
    this.classificationRoutingService = classificationRoutingService;
    this.libraryRulesService = libraryRulesService;
    this.libraryLabelsService = libraryLabelsService;
    this.classificationLearnedCorrectionsService = classificationLearnedCorrectionsService;
    this.classificationAiService = classificationAiService;
    this.classificationPersistenceService = classificationPersistenceService;
    this.classificationRagLoopService = classificationRagLoopService;
    this.classificationAuthoritativeSignalService = classificationAuthoritativeSignalService;
    this.normalizePolicyDecisionThresholds = normalizePolicyDecisionThresholds;
    this.logger = createLogger('classification');

    this.idleDetector = idleDetector;
    this.classificationPolicyPathService = classificationPolicyPathService;
    this.classificationLegacySignalPathService = classificationLegacySignalPathService;
  }

  async classify(overseerrPayload) {
    const startTime = Date.now();
    try {
      this.idleDetector.recordActivity();

      const { media_type, tmdbId, title, year, existingMetadata, taskId } = this.parseOverseerrPayload(overseerrPayload);

      this.logger.info(`Starting classification for ${media_type}: ${title} (TMDB: ${tmdbId || 'searching...'})`);

      if (taskId && !existingMetadata.source_library_id) {
        await this.classificationPhaseService.updatePhase(taskId, 'metadata_fetch', { title });
      }

      let metadata;

      if (existingMetadata.overview && existingMetadata.genres && existingMetadata.genres.length > 0) {
        this.logger.info(`Using existing metadata for ${title}`);
        metadata = {
          tmdb_id: tmdbId || null,
          tvdb_id: existingMetadata.tvdb_id || null,
          media_type,
          title,
          year,
          overview: existingMetadata.overview,
          genres: existingMetadata.genres,
          keywords: existingMetadata.keywords || [],
          certification: existingMetadata.content_rating,
          original_language: existingMetadata.original_language || 'en',
          itemId: existingMetadata.itemId,
          source_library_id: existingMetadata.source_library_id,
          source_library_name: existingMetadata.source_library_name,
        };
      } else if (tmdbId) {
        metadata = await this.enrichWithTMDB(tmdbId, media_type);
        metadata.itemId = existingMetadata.itemId;
        metadata.tvdb_id = existingMetadata.tvdb_id;
        metadata.source_library_id = existingMetadata.source_library_id;
        metadata.source_library_name = existingMetadata.source_library_name;
      } else if (title && title !== 'Unknown') {
        this.logger.info(`No TMDB ID found, searching TMDB for: ${title} (${year || 'any year'})`);

        const searchResults = await this.tmdbService.search(title, media_type);

        if (searchResults && searchResults.length > 0) {
          let bestMatch = searchResults[0];
          if (year) {
            const yearMatch = searchResults.find((result) => result.year === String(year));
            if (yearMatch) {
              bestMatch = yearMatch;
            }
          }

          this.logger.info(`Found TMDB match: ${bestMatch.title} (${bestMatch.year}) - ID: ${bestMatch.id}`);

          metadata = await this.enrichWithTMDB(bestMatch.id, media_type);
          metadata.itemId = existingMetadata.itemId;
          metadata.tvdb_id = existingMetadata.tvdb_id;
          metadata.source_library_id = existingMetadata.source_library_id;
          metadata.source_library_name = existingMetadata.source_library_name;
        } else {
          this.logger.warn(`No TMDB match found for: ${title}. Using basic metadata.`);
          metadata = {
            tmdb_id: null,
            tvdb_id: existingMetadata.tvdb_id || null,
            media_type,
            title,
            year,
            overview: existingMetadata.overview || '',
            genres: existingMetadata.genres || [],
            keywords: existingMetadata.keywords || [],
            certification: existingMetadata.content_rating || 'NR',
            original_language: existingMetadata.original_language || 'en',
            itemId: existingMetadata.itemId,
            source_library_id: existingMetadata.source_library_id,
            source_library_name: existingMetadata.source_library_name,
          };
        }
      } else {
        throw new Error('No TMDB ID or title provided for classification');
      }

      if (metadata) {
        metadata.requested_seasons = existingMetadata.requested_seasons;
        metadata.include_specials = existingMetadata.include_specials;
        metadata.retry_count = existingMetadata.retry_count;
        metadata.max_retries = existingMetadata.max_retries;
        metadata.retry_lineage = existingMetadata.retry_lineage || null;
      }

      const result = await this.runDecisionTree(metadata, media_type, taskId);

      const classificationId = await this.logClassification(metadata, result, startTime);
      await this.rebindRetryLineage(classificationId, metadata);
      await this.persistRagLoopStageEvents({ classificationId, metadata, result });

      if (result.signalContext && result.signalContext.patternSignals) {
        const patternSignals = result.signalContext.patternSignals;
        if (patternSignals.length > 0 && result.library) {
          setImmediate(async () => {
            try {
              await this.classificationEvidenceReinforcementService.reinforceOnAccept(
                classificationId,
                patternSignals,
                result.library.id,
                { metadata, mediaType: metadata.media_type },
              );
            } catch (error) {
              this.logger.debug('Pattern reinforcement error', { error: error.message });
            }
          });
        }
      }

      const requireAllConfirmations = await this.clarificationService.isRequireAllConfirmationsEnabled();

      let policyAutoThreshold = null;
      const ranked = result?.policyResult?.ranked || [];
      if (Array.isArray(ranked) && ranked.length > 0 && result.library?.id) {
        const row = ranked.find((entry) => entry && entry.library_id === result.library.id);
        if (row) {
          policyAutoThreshold = this.normalizePolicyDecisionThresholds(row).autoClassifyThreshold;
        }
      }

      const shouldAutoRoute =
        !!result.library &&
        !!result.library.arr_type &&
        !requireAllConfirmations &&
        (
          result.method === 'policy_auto' ||
          (typeof policyAutoThreshold === 'number' && result.confidence >= policyAutoThreshold)
        );

      if (shouldAutoRoute) {
        await this.routeToArr(metadata, result.library);
      }

      if (this.discordBot.isInitialized) {
        try {
          if (taskId && !metadata.source_library_id) {
            await this.classificationPhaseService.updatePhase(taskId, 'notification');
          }

          this.logger.info('[Discord] Notification attempt', {
            classification_id: classificationId,
            title: metadata.title,
            confidence: result.confidence,
            needs_clarification: result.needs_clarification,
            status: result.needs_clarification ? 'awaiting_decision' : 'completed',
            has_libraries: !!result.libraries,
          });

          await this.discordBot.sendConfidenceBasedNotification(metadata, {
            ...result,
            classification_id: classificationId,
            library_name: result.library?.name,
          });
        } catch (discordError) {
          this.logger.error('[Discord] Notification failed', {
            error: discordError.message,
            stack: discordError.stack,
            classification_id: classificationId,
            title: metadata.title,
            confidence: result.confidence,
          });
        }
      }

      this.logger.info('Classification completed', {
        title: metadata.title,
        tmdbId: metadata.tmdb_id,
        mediaType: media_type,
        library: result.library?.name,
        confidence: result.confidence,
        method: result.method,
        hasSourceLibrary: !!metadata.source_library_id,
        contentType: metadata.contentAnalysis?.bestMatch?.type || null,
      });

      if (taskId && !metadata.source_library_id) {
        await this.classificationPhaseService.completeTracking(taskId, {
          library: result.library?.name,
          confidence: result.confidence,
          method: result.method,
        });
      }

      return {
        success: true,
        classification_id: classificationId,
        library: result.library?.name,
        confidence: result.confidence,
        method: result.method,
        reason: result.reason,
        retry_reason_code: result.retry_reason_code || null,
        bestMatch: metadata.contentAnalysis?.bestMatch,
      };
    } catch (error) {
      this.logger.error('Classification error', { error: error.message });
      throw error;
    }
  }

  parseOverseerrPayload(payload) {
    return this.classificationMetadataService.parseOverseerrPayload(payload);
  }

  async enrichWithTMDB(tmdbId, mediaType) {
    return this.classificationMetadataService.enrichWithTMDB(tmdbId, mediaType);
  }

  async getTavilyConfig() {
    return this.classificationMetadataService.getTavilyConfig();
  }

  async isRealtimeEmbeddingEnabled() {
    return this.classificationPersistenceService.isRealtimeEmbeddingEnabled();
  }

  async getRagLoopConfig() {
    return this.classificationRagLoopService.getRagLoopConfig();
  }

  getCurrentAppVersion() {
    return this.classificationRagLoopService.getCurrentAppVersion();
  }

  getCurrentImageTag() {
    return this.classificationRagLoopService.getCurrentImageTag();
  }

  async getRecentFallbackDiagnostics(limit = 20) {
    return this.classificationRagLoopService.getRecentFallbackDiagnostics(limit);
  }

  buildAutoFallbackIncidentPayload(params) {
    return this.classificationRagLoopService.buildAutoFallbackIncidentPayload(params);
  }

  async persistAutoFallbackBreachCount(params) {
    return this.classificationRagLoopService.persistAutoFallbackBreachCount(params);
  }

  async maybeApplyRolloutAutomation(params) {
    return this.classificationRagLoopService.maybeApplyRolloutAutomation(params);
  }

  resolveRagLoopTimeout(config = {}) {
    return this.classificationUtilsService.resolveRagLoopTimeout(config);
  }

  async withTimeout(operationOrPromise, timeoutMs, timeoutMessage = 'operation_timeout') {
    return this.classificationUtilsService.withTimeout(operationOrPromise, timeoutMs, timeoutMessage);
  }

  async sleep(ms) {
    return this.classificationUtilsService.sleep(ms);
  }

  async withRetryableDbConflict(operation, options = {}) {
    return this.classificationUtilsService.withRetryableDbConflict(operation, options);
  }

  isAiTransientAvailabilityError(error) {
    return this.classificationUtilsService.isAiTransientAvailabilityError(error);
  }

  normalizeAiResponseLine(value) {
    return this.classificationAiService.normalizeAiResponseLine(value);
  }

  buildAiRepairPrompt({ response, libraries, signalContext, mode }) {
    return this.classificationAiService.buildAiRepairPrompt({ response, libraries, signalContext, mode });
  }

  async attemptAiResponseRepair({ response, libraries, signalContext, mode, model, temperature }) {
    return this.classificationAiService.attemptAiResponseRepair({ response, libraries, signalContext, mode, model, temperature });
  }

  buildParseDiagnostics(params) {
    return this.classificationUtilsService.buildParseDiagnostics(params);
  }

  buildPendingRetryResult(params) {
    return this.classificationUtilsService.buildPendingRetryResult(params);
  }

  resolveRetryReason(error) {
    return this.classificationUtilsService.resolveRetryReason(error);
  }

  mergeMetadataForRecheck(originalMetadata, enrichedMetadata) {
    return this.classificationMetadataService.mergeMetadataForRecheck(originalMetadata, enrichedMetadata);
  }

  buildFreshSecondPassBaseResult(baselineResult = {}) {
    return this.classificationRagLoopService.buildFreshSecondPassBaseResult(baselineResult);
  }

  buildPolicyRecheckCandidate(params) {
    return this.classificationRagLoopService.buildPolicyRecheckCandidate(params);
  }

  buildAiRerunCandidate(params) {
    return this.classificationRagLoopService.buildAiRerunCandidate(params);
  }

  async evaluateRagLoopSecondPass(params) {
    return this.classificationRagLoopService.evaluateRagLoopSecondPass(params);
  }

  async enrichWithWebSearch(metadata) {
    return this.classificationMetadataService.enrichWithWebSearch(metadata);
  }

  detectEventTypesFromMetadata(metadata) {
    return this.classificationMetadataService.detectEventTypesFromMetadata(metadata);
  }

  async checkLibraryRules(metadata, libraries) {
    return this.libraryRulesService.checkLibraryRules(metadata, libraries);
  }

  mightBeAnime(metadata) {
    return this.classificationMetadataService.mightBeAnime(metadata);
  }

  async runDecisionTree(metadata, mediaType, taskId = null) {
    const librariesResult = await this.db.query(
      'SELECT * FROM libraries WHERE media_type = $1 AND is_active = true ORDER BY priority DESC',
      [mediaType],
    );

    const libraries = librariesResult.rows;

    if (libraries.length === 0) {
      throw new Error(`No active libraries found for media type: ${mediaType}`);
    }

    const authoritativeSignalEvaluation = await this.classificationAuthoritativeSignalService.evaluate({
      metadata,
      mediaType,
      libraries,
    });
    if (authoritativeSignalEvaluation.result) {
      return authoritativeSignalEvaluation.result;
    }

    const relatedEvidence = authoritativeSignalEvaluation.relatedEvidence;
    const policyPath = await this.classificationPolicyPathService.execute({ metadata, libraries, taskId, relatedEvidence });
    if (policyPath.handled) {
      return policyPath.result;
    }

    return this.classificationLegacySignalPathService.execute({
      metadata,
      libraries,
      taskId,
      relatedEvidence,
      policyResult: policyPath.policyResult || null,
    });
  }

  metadataMatchesLabel(metadata, label) {
    return this.libraryLabelsService.metadataMatchesLabel(metadata, label);
  }

  evaluateCustomRule(metadata, ruleJson) {
    return this.libraryLabelsService.evaluateCustomRule(metadata, ruleJson);
  }

  evaluateSingleCondition(metadata, condition) {
    return this.libraryLabelsService.evaluateSingleCondition(metadata, condition);
  }

  async aiClassify(metadata, libraries, signalContext = null, options = {}) {
    return this.classificationAiService.aiClassify(metadata, libraries, signalContext, options);
  }

  async logClassification(metadata, result, startTime = null) {
    return this.classificationPersistenceService.logClassification(metadata, result, startTime);
  }

  async persistRagLoopStageEvents(params) {
    return this.classificationPersistenceService.persistRagLoopStageEvents(params);
  }

  async rebindRetryLineage(classificationId, metadata = {}) {
    return this.classificationPersistenceService.rebindRetryLineage(classificationId, metadata);
  }

  async deriveClassificationPersistenceState(result) {
    return this.classificationPersistenceService.deriveClassificationPersistenceState(result);
  }

  async routeToArr(metadata, library) {
    return this.classificationRoutingService.routeToArr(metadata, library);
  }

  normalizeSettings(settings) {
    return this.classificationRoutingService.normalizeSettings(settings);
  }

  normalizeQualityProfileId(value) {
    return this.classificationRoutingService.normalizeQualityProfileId(value);
  }

  async ensureDecisionQuestion({ metadata, result, policyResult = null, libraries = [], ragContext = null }) {
    return this.classificationRoutingService.ensureDecisionQuestion({ metadata, result, policyResult, libraries, ragContext });
  }

  async normalizePolicyQuestion(value) {
    return this.classificationPersistenceService.normalizePolicyQuestion(value);
  }

  async resolveRoutingConfig(library) {
    return this.classificationRoutingService.resolveRoutingConfig(library);
  }

  isSettingsEmpty(settings) {
    return this.classificationRoutingService.isSettingsEmpty(settings);
  }

  async resolveDefaultQualityProfile(arrType, baseUrl, apiKey) {
    return this.classificationRoutingService.resolveDefaultQualityProfile(arrType, baseUrl, apiKey);
  }

  async resolveDefaultRootFolder(arrType, baseUrl, apiKey) {
    return this.classificationRoutingService.resolveDefaultRootFolder(arrType, baseUrl, apiKey);
  }

  async retryClassification(classificationId) {
    try {
      const result = await this.classificationRetryService.retryClassifications({
        classificationIds: [classificationId],
        actor: 'scheduler',
        purgeLearning: false,
        correlationId: `scheduler-retry-${classificationId}`,
        taskSource: 'retry_queue',
        metadataEnrichmentSource: 'retry_queue_followup',
        route: 'scheduler:retry-queue',
      });

      return result.results?.[0] || null;
    } catch (error) {
      this.logger.error('Failed to retry classification', {
        classificationId,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  suggestSeriesType(metadata, appliedLabels = []) {
    return this.classificationRoutingService.suggestSeriesType(metadata, appliedLabels);
  }
}

export function createClassificationService(config) {
  return new ClassificationService(normalizeClassificationServiceConfig(config));
}
