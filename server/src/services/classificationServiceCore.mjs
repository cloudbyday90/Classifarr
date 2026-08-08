/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { NotFoundError, ValidationError } from '../utils/appError.mjs';
import {
  buildClassificationDestinationSummary,
  buildClassificationRoutingSummary,
} from './classificationResultOutcomeSummary.mjs';
import {
  isAiAuthorityRoutingBlocked,
  isCurrentDeterministicPolicyAuto,
} from './classificationRoutingServiceShared.mjs';
import {
  validatePolicyRuntimeQuestionReduction,
} from './policyRuntimeQuestionReduction.mjs';
import {
  buildPolicyRuntimeQueueQuestionReductionAudit,
} from './policyRuntimeQueueQuestionReduction.mjs';

function buildQueueTaskContext(task = {}) {
  const source = task && typeof task === 'object' && !Array.isArray(task) ? task : {};

  return {
    id: source.id,
    task_type: source.task_type ?? source.taskType,
    attempts: source.attempts,
  };
}

export function normalizeClassificationServiceConfig(config = {}) {
  const {
    infrastructure = {},
    workflowServices = {},
    domainServices = {},
    utilities = {},
    runtimeServices = {},
    ...flatConfig
  } = config;

  return {
    ...flatConfig,
    ...infrastructure,
    ...workflowServices,
    ...domainServices,
    ...utilities,
    ...runtimeServices,
  };
}

export class ClassificationService {
  constructor({
    db,
    tmdbService,
    discordBot,
    contentTypeAnalyzer,
    clarificationService,
    classificationProgressStageService,
    classificationRetryService,
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
    policyNativeClassificationQuestionHandoffService,
    policyRuntimeQuestionPersistenceAdmissionService,
  }) {
    this.db = db;
    this.tmdbService = tmdbService;
    this.discordBot = discordBot;
    this.contentTypeAnalyzer = contentTypeAnalyzer;
    this.clarificationService = clarificationService;
    this.classificationProgressStageService = classificationProgressStageService;
    this.classificationRetryService = classificationRetryService;
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
    this.policyNativeClassificationQuestionHandoffService = policyNativeClassificationQuestionHandoffService;
    this.policyRuntimeQuestionPersistenceAdmissionService =
      policyRuntimeQuestionPersistenceAdmissionService;
  }

  async _withCatch(label, fn) {
    try {
      return await fn();
    } catch (error) {
      this.logger.error(label, { error: error.message });
      throw error;
    }
  }

  resolvePolicyAutoThreshold(result = {}) {
    const ranked = result?.policyResult?.ranked || [];
    if (!Array.isArray(ranked) || ranked.length === 0 || !result.library?.id) {
      return null;
    }

    const row = ranked.find((entry) => entry && entry.library_id === result.library.id);
    if (!row) {
      return null;
    }

    return this.normalizePolicyDecisionThresholds(row).autoClassifyThreshold;
  }

  buildAutoRouteDecision({ result = {}, requireAllConfirmations = false, policyAutoThreshold = null } = {}) {
    if (!result.library) {
      return { shouldRoute: false, reason: 'no_library' };
    }

    if (result.needs_retry || result.needs_clarification) {
      return { shouldRoute: false, reason: 'not_final' };
    }

    if (requireAllConfirmations) {
      return { shouldRoute: false, reason: 'confirmation_required' };
    }

    if (isAiAuthorityRoutingBlocked(result)) {
      return { shouldRoute: false, reason: 'ai_authority_advisory' };
    }

    if (isCurrentDeterministicPolicyAuto(result)) {
      return { shouldRoute: true, reason: 'policy_auto' };
    }

    if (result.method === 'policy_auto') {
      return { shouldRoute: false, reason: 'invalid_policy_auto_provenance' };
    }

    if (typeof policyAutoThreshold === 'number' && result.confidence >= policyAutoThreshold) {
      return { shouldRoute: true, reason: 'policy_threshold_met' };
    }

    return { shouldRoute: false, reason: 'threshold_not_met' };
  }

  async routeClassificationResult(classificationId, metadata, result, requireAllConfirmations) {
    const policyAutoThreshold = this.resolvePolicyAutoThreshold(result);
    const decision = this.buildAutoRouteDecision({
      result,
      requireAllConfirmations,
      policyAutoThreshold,
    });

    metadata.classification_details = metadata.classification_details || {};

    if (!decision.shouldRoute) {
      this.logger.debug('Auto-route skipped for classification result', {
        title: metadata?.title || null,
        libraryId: result?.library?.id || result?.library?.library_id || null,
        libraryName: result?.library?.name || result?.library?.library_name || null,
        method: result?.method || null,
        confidence: result?.confidence ?? null,
        policyAutoThreshold,
        reason: decision.reason,
      });
      metadata.classification_details.routing = decision.reason;
      if (classificationId) {
        await this.db.query(
          'UPDATE classification_history SET metadata = $1::jsonb WHERE id = $2',
          [JSON.stringify(metadata), classificationId]
        );
      }
      return { ...decision, policyAutoThreshold };
    }

    const routeResult = await this.routeToArr(metadata, result.library);
    this.logger.debug('Auto-route evaluated for classification result', {
      title: metadata?.title || null,
      libraryId: result.library.id || result.library.library_id || null,
      libraryName: result.library.name || result.library.library_name || null,
      method: result.method || null,
      confidence: result.confidence ?? null,
      policyAutoThreshold,
      reason: decision.reason,
      attempted: routeResult?.attempted ?? null,
      routed: routeResult?.routed ?? null,
      routingReason: routeResult?.reason || null,
      routingError: routeResult?.error || null,
    });

    if (routeResult?.routed === true) {
      metadata.classification_details.routing = 'routed';
      if (classificationId) {
        await this.db.query(
          'UPDATE classification_history SET status = $1, metadata = $2::jsonb WHERE id = $3',
          ['routed', JSON.stringify(metadata), classificationId]
        );
      }
    } else {
      metadata.classification_details.routing = routeResult?.reason || 'unexpected_error';
      if (routeResult?.error) {
        metadata.classification_details.routing_error = routeResult.error;
      }
      if (classificationId) {
        await this.db.query(
          'UPDATE classification_history SET metadata = $1::jsonb WHERE id = $2',
          [JSON.stringify(metadata), classificationId]
        );
      }
    }

    return {
      ...decision,
      policyAutoThreshold,
      routeResult: routeResult || null,
    };
  }

  async buildRuntimeQuestionHandoff(result, queueTask = null) {
    if (typeof this.policyNativeClassificationQuestionHandoffService?.build !== 'function') {
      return null;
    }

    try {
      const handoffInput = {
        classificationResult: result,
      };
      if (queueTask !== null) handoffInput.queueTask = queueTask;

      const handoff = await this.policyNativeClassificationQuestionHandoffService.build(handoffInput);
      const plan = handoff?.plan;
      const validation = plan
        ? validatePolicyRuntimeQuestionReduction(plan)
        : null;

      if (plan && validation?.ok !== true) {
        this.logger.warn('Native classification question handoff returned an invalid plan', {
          libraryId: result?.library?.id ?? result?.library?.library_id ?? null,
          issueCount: validation?.issueCount ?? null,
        });
        return null;
      }

      return validation?.ok === true ? handoff : null;
    } catch (error) {
      this.logger.warn('Native classification question handoff failed', {
        error: error.message,
        libraryId: result?.library?.id ?? result?.library?.library_id ?? null,
      });
      return null;
    }
  }

  async buildRuntimeQuestionReductionPlan(result, queueTask = null) {
    const handoff = await this.buildRuntimeQuestionHandoff(result, queueTask);
    return handoff?.plan || null;
  }

  admitRuntimeQuestionPersistence(result, handoff) {
    if (typeof this.policyRuntimeQuestionPersistenceAdmissionService?.admit !== 'function') {
      return null;
    }

    try {
      const admission = this.policyRuntimeQuestionPersistenceAdmissionService.admit({
        classificationResult: result,
        handoff,
      });

      if (admission?.audit?.ok !== true) {
        this.logger.warn('Native runtime question persistence admission returned an invalid result', {
          statusId: admission?.statusId || null,
        });
        return null;
      }

      if (admission.ok === true && admission.classificationPatch) {
        Object.assign(result, admission.classificationPatch);
      }

      return admission;
    } catch (error) {
      this.logger.warn('Native runtime question persistence admission failed', {
        error: error.message,
        libraryId: result?.library?.id ?? result?.library?.library_id ?? null,
      });
      return null;
    }
  }

  async classifyQueueTask(task, payload = {}) {
    return this.classify(payload, {
      queueTask: buildQueueTaskContext(task),
    });
  }

  async classify(overseerrPayload, runtimeContext = {}) {
    const startTime = Date.now();
    return this._withCatch('Classification error', async () => {
      this.idleDetector.recordActivity();

      const { media_type, tmdbId, title, year, existingMetadata, taskId } = this.parseOverseerrPayload(overseerrPayload);
      const queueTask = runtimeContext?.queueTask ?? null;

      this.logger.info(`Starting classification for ${media_type}: ${title} (TMDB: ${tmdbId || 'searching...'})`);

      if (taskId && !existingMetadata.source_library_id) {
        await this.classificationProgressStageService.updateStage(taskId, 'metadata_fetch', { title });
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
        throw new ValidationError('No TMDB ID or title provided for classification');
      }

      if (metadata) {
        metadata.requested_seasons = existingMetadata.requested_seasons;
        metadata.include_specials = existingMetadata.include_specials;
        metadata.retry_count = existingMetadata.retry_count;
        metadata.max_retries = existingMetadata.max_retries;
        metadata.retry_lineage = existingMetadata.retry_lineage || null;
      }

      const result = await this.runDecisionTree(metadata, media_type, taskId);
      const runtimeQuestionHandoff = await this.buildRuntimeQuestionHandoff(result, queueTask);
      const runtimeQuestionReductionPlan = queueTask === null
        ? runtimeQuestionHandoff?.plan || null
        : null;
      const runtimeQueueQuestionReduction = queueTask !== null &&
        buildPolicyRuntimeQueueQuestionReductionAudit(
          runtimeQuestionHandoff?.queueQuestionReduction
        ).ok === true
        ? runtimeQuestionHandoff.queueQuestionReduction
        : null;
      const runtimeQuestionPersistenceAdmission = this.admitRuntimeQuestionPersistence(
        result,
        runtimeQuestionHandoff,
      );

      const classificationId = await this.logClassification(metadata, result, startTime);
      await this.rebindRetryLineage(classificationId, metadata);
      await this.persistRagLoopStageEvents({ classificationId, metadata, result });

      const requireAllConfirmations = await this.clarificationService.isRequireAllConfirmationsEnabled();

      const routingOutcome = await this.routeClassificationResult(
        classificationId,
        metadata,
        result,
        requireAllConfirmations
      );

      if (this.discordBot.isInitialized) {
        try {
          if (taskId && !metadata.source_library_id) {
            await this.classificationProgressStageService.updateStage(taskId, 'notification');
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
        await this.classificationProgressStageService.completeTracking(taskId, {
          library: result.library?.name,
          confidence: result.confidence,
          method: result.method,
        });
      }

      return {
        success: true,
        classification_id: classificationId,
        library: result.library?.name,
        destination: buildClassificationDestinationSummary(result),
        routingOutcome: buildClassificationRoutingSummary({ routingOutcome }),
        runtimeQuestionReductionPlan,
        runtimeQueueQuestionReduction,
        runtimeQuestionPersistence: runtimeQuestionPersistenceAdmission
          ? {
            statusId: runtimeQuestionPersistenceAdmission.statusId,
            reasonId: runtimeQuestionPersistenceAdmission.reasonId,
          }
          : null,
        confidence: result.confidence,
        method: result.method,
        reason: result.reason,
        retry_reason_code: result.retry_reason_code || null,
        bestMatch: metadata.contentAnalysis?.bestMatch,
      };
    });
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
      throw new NotFoundError(`No active libraries found for media type: ${mediaType}`);
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
