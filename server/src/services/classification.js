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

const db = require('../config/database');
const tmdbService = require('./tmdb');
const discordBot = require('./discordBot');
const mediaSyncService = require('./mediaSync');
const contentTypeAnalyzer = require('./contentTypeAnalyzer');
const clarificationService = require('./clarificationService');
const classificationPhaseService = require('./classificationPhaseService');
const classificationRetryService = require('./classificationRetryService');
const classificationEvidenceReinforcementService = require('./classificationEvidenceReinforcementService');
const classificationEvidenceService = require('./classificationEvidenceService');
const idleDetector = require('../utils/idleDetector');
const { createLogger } = require('../utils/logger');
const classificationMetadataService = require('./classificationMetadataService');
const classificationUtilsService = require('./classificationUtilsService');
const classificationRoutingService = require('./classificationRoutingService');
const libraryRulesService = require('./libraryRulesService');
const libraryLabelsService = require('./libraryLabelsService');
const classificationLearnedCorrectionsService = require('./classificationLearnedCorrectionsService');
const classificationAiService = require('./classificationAiService');
const classificationPersistenceService = require('./classificationPersistenceService');
const classificationRagLoopService = require('./classificationRagLoopService');
const classificationPolicyPathService = require('./classificationPolicyPathService');
const classificationLegacySignalPathService = require('./classificationLegacySignalPathService');
const { normalizePolicyDecisionThresholds } = require('../utils/policyThresholds');

const logger = createLogger('classification');

class ClassificationService {
  async classify(overseerrPayload) {
    const startTime = Date.now(); // Track processing time
    try {
      // Record classification activity for idle detection
      idleDetector.recordActivity();

      // Parse payload - supports multiple formats (Overseerr, Plex gap analysis, legacy root-field payload)
      const { media_type, tmdbId, title, year, existingMetadata, taskId } = this.parseOverseerrPayload(overseerrPayload);

      logger.info(`Starting classification for ${media_type}: ${title} (TMDB: ${tmdbId || 'searching...'})`);

      // Issue #192: Start phase tracking (skip for source_library items which are instant)
      if (taskId && !existingMetadata.source_library_id) {
        await classificationPhaseService.updatePhase(taskId, 'metadata_fetch', { title });
      }

      let metadata;

      // If we have existing metadata from payload (gap analysis with local data), use it
      if (existingMetadata.overview && existingMetadata.genres && existingMetadata.genres.length > 0) {
        logger.info(`Using existing metadata for ${title}`);
        metadata = {
          tmdb_id: tmdbId || null,
          tvdb_id: existingMetadata.tvdb_id || null,
          media_type: media_type,
          title: title,
          year: year,
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
        // We have TMDB ID - lookup directly
        metadata = await this.enrichWithTMDB(tmdbId, media_type);
        metadata.itemId = existingMetadata.itemId;
        metadata.tvdb_id = existingMetadata.tvdb_id;
        metadata.source_library_id = existingMetadata.source_library_id;
        metadata.source_library_name = existingMetadata.source_library_name;
      } else if (title && title !== 'Unknown') {
        // No TMDB ID - search by title/year
        logger.info(`No TMDB ID found, searching TMDB for: ${title} (${year || 'any year'})`);

        const searchResults = await tmdbService.search(title, media_type);

        if (searchResults && searchResults.length > 0) {
          // Find best match by year if we have one
          let bestMatch = searchResults[0];
          if (year) {
            const yearMatch = searchResults.find(r => r.year === String(year));
            if (yearMatch) {
              bestMatch = yearMatch;
            }
          }

          logger.info(`Found TMDB match: ${bestMatch.title} (${bestMatch.year}) - ID: ${bestMatch.id}`);

          // Now get full details
          metadata = await this.enrichWithTMDB(bestMatch.id, media_type);
          metadata.itemId = existingMetadata.itemId;
          metadata.tvdb_id = existingMetadata.tvdb_id;
          metadata.source_library_id = existingMetadata.source_library_id;
          metadata.source_library_name = existingMetadata.source_library_name;
        } else {
          // No TMDB match found - create basic metadata from what we have
          logger.warn(`No TMDB match found for: ${title}. Using basic metadata.`);
          metadata = {
            tmdb_id: null,
            tvdb_id: existingMetadata.tvdb_id || null,
            media_type: media_type,
            title: title,
            year: year,
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

      // Run decision tree
      const result = await this.runDecisionTree(metadata, media_type, taskId);

      // Log to database
      const classificationId = await this.logClassification(metadata, result, startTime);
      await this.rebindRetryLineage(classificationId, metadata);
      await this.persistRagLoopStageEvents({ classificationId, metadata, result });

      // Reinforce patterns (if any were used in classification)
      if (result.signalContext && result.signalContext.patternSignals) {
        const patternSignals = result.signalContext.patternSignals;
        if (patternSignals.length > 0 && result.library) {
          // Async reinforcement - don't wait
          setImmediate(async () => {
            try {
              await classificationEvidenceReinforcementService.reinforceOnAccept(
                classificationId,
                patternSignals,
                result.library.id,
                { metadata, mediaType: metadata.media_type }
              );
            } catch (error) {
              logger.debug('Pattern reinforcement error', { error: error.message });
            }
          });
        }
      }

      // Check if user requires all confirmations
      const requireAllConfirmations = await clarificationService.isRequireAllConfirmationsEnabled();

      // Route to Radarr/Sonarr only if the policy auto-classify threshold is met (or policy already auto-classified),
      // and the user doesn't require confirmations.
      let policyAutoThreshold = null;
      const ranked = result?.policyResult?.ranked || [];
      if (Array.isArray(ranked) && ranked.length > 0 && result.library?.id) {
        const row = ranked.find((r) => r && r.library_id === result.library.id);
        if (row) {
          policyAutoThreshold = normalizePolicyDecisionThresholds(row).autoClassifyThreshold;
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

      // Send Discord notification with confidence-based routing
      if (discordBot.isInitialized) {
        try {
          // Issue #192: Update phase to notification
          if (taskId && !metadata.source_library_id) {
            await classificationPhaseService.updatePhase(taskId, 'notification');
          }

          // Enhanced logging for debugging notification issues
          logger.info('[Discord] Notification attempt', {
            classification_id: classificationId,
            title: metadata.title,
            confidence: result.confidence,
            needs_clarification: result.needs_clarification,
            status: result.needs_clarification ? 'awaiting_decision' : 'completed',
            has_libraries: !!result.libraries
          });

          await discordBot.sendConfidenceBasedNotification(metadata, {
            ...result,
            classification_id: classificationId,
            library_name: result.library?.name,
          });
        } catch (discordError) {
          // Log Discord notification errors - don't fail classification
          logger.error('[Discord] Notification failed', {
            error: discordError.message,
            stack: discordError.stack,
            classification_id: classificationId,
            title: metadata.title,
            confidence: result.confidence
          });
        }
      }

      // Enhanced AI metrics logging for monitoring and debugging
      logger.info('Classification completed', {
        title: metadata.title,
        tmdbId: metadata.tmdb_id,
        mediaType: media_type,
        library: result.library?.name,
        confidence: result.confidence,
        method: result.method,
        hasSourceLibrary: !!metadata.source_library_id,
        contentType: metadata.contentAnalysis?.bestMatch?.type || null
      });

      // Issue #192: Complete execution tracking
      if (taskId && !metadata.source_library_id) {
        await classificationPhaseService.completeTracking(taskId, {
          library: result.library?.name,
          confidence: result.confidence,
          method: result.method
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
        // Include bestMatch for queue service to use
        bestMatch: metadata.contentAnalysis?.bestMatch
      };
    } catch (error) {
      logger.error('Classification error', { error: error.message });
      throw error;
    }
  }

  parseOverseerrPayload(payload) {
    return classificationMetadataService.parseOverseerrPayload(payload);
  }

  async enrichWithTMDB(tmdbId, mediaType) {
    return classificationMetadataService.enrichWithTMDB(tmdbId, mediaType);
  }

  async getTavilyConfig() {
    return classificationMetadataService.getTavilyConfig();
  }

  async isRealtimeEmbeddingEnabled() {
    return classificationPersistenceService.isRealtimeEmbeddingEnabled();
  }

  async getRagLoopConfig() {
    return classificationRagLoopService.getRagLoopConfig();
  }

  getCurrentAppVersion() {
    return classificationRagLoopService.getCurrentAppVersion();
  }

  getCurrentImageTag() {
    return classificationRagLoopService.getCurrentImageTag();
  }

  async getRecentFallbackDiagnostics(limit = 20) {
    return classificationRagLoopService.getRecentFallbackDiagnostics(limit);
  }

  buildAutoFallbackIncidentPayload(params) {
    return classificationRagLoopService.buildAutoFallbackIncidentPayload(params);
  }

  async persistAutoFallbackBreachCount(params) {
    return classificationRagLoopService.persistAutoFallbackBreachCount(params);
  }

  async maybeApplyRolloutAutomation(params) {
    return classificationRagLoopService.maybeApplyRolloutAutomation(params);
  }

  resolveRagLoopTimeout(config = {}) {
    return classificationUtilsService.resolveRagLoopTimeout(config);
  }

  async withTimeout(operationOrPromise, timeoutMs, timeoutMessage = 'operation_timeout') {
    return classificationUtilsService.withTimeout(operationOrPromise, timeoutMs, timeoutMessage);
  }

  async sleep(ms) {
    return classificationUtilsService.sleep(ms);
  }

  async withRetryableDbConflict(operation, options = {}) {
    return classificationUtilsService.withRetryableDbConflict(operation, options);
  }

  isAiTransientAvailabilityError(error) {
    return classificationUtilsService.isAiTransientAvailabilityError(error);
  }

  normalizeAiResponseLine(value) {
    return classificationAiService.normalizeAiResponseLine(value);
  }

  buildAiRepairPrompt({ response, libraries, signalContext, mode }) {
    return classificationAiService.buildAiRepairPrompt({ response, libraries, signalContext, mode });
  }

  async attemptAiResponseRepair({ response, libraries, signalContext, mode, model, temperature }) {
    return classificationAiService.attemptAiResponseRepair({ response, libraries, signalContext, mode, model, temperature });
  }

  buildParseDiagnostics(params) {
    return classificationUtilsService.buildParseDiagnostics(params);
  }

  buildPendingRetryResult(params) {
    return classificationUtilsService.buildPendingRetryResult(params);
  }

  resolveRetryReason(error) {
    return classificationUtilsService.resolveRetryReason(error);
  }

  mergeMetadataForRecheck(originalMetadata, enrichedMetadata) {
    return classificationMetadataService.mergeMetadataForRecheck(originalMetadata, enrichedMetadata);
  }

  buildFreshSecondPassBaseResult(baselineResult = {}) {
    return classificationRagLoopService.buildFreshSecondPassBaseResult(baselineResult);
  }

  buildPolicyRecheckCandidate(params) {
    return classificationRagLoopService.buildPolicyRecheckCandidate(params);
  }

  buildAiRerunCandidate(params) {
    return classificationRagLoopService.buildAiRerunCandidate(params);
  }

  async evaluateRagLoopSecondPass(params) {
    return classificationRagLoopService.evaluateRagLoopSecondPass(params);
  }

  async enrichWithWebSearch(metadata) {
    return classificationMetadataService.enrichWithWebSearch(metadata);
  }

  detectEventTypesFromMetadata(metadata) {
    return classificationMetadataService.detectEventTypesFromMetadata(metadata);
  }


  /**
   * Check library rules to find matching library
   * Rules are checked in priority order
   * Now uses library_rules_v2 with conditions JSON format
   */
  async checkLibraryRules(metadata, libraries) {
    return libraryRulesService.checkLibraryRules(metadata, libraries);
  }

  mightBeAnime(metadata) {
    return classificationMetadataService.mightBeAnime(metadata);
  }

  async runDecisionTree(metadata, mediaType, taskId = null) {
    // Get all active libraries for this media type
    const librariesResult = await db.query(
      'SELECT * FROM libraries WHERE media_type = $1 AND is_active = true ORDER BY priority DESC',
      [mediaType]
    );

    const libraries = librariesResult.rows;

    if (libraries.length === 0) {
      throw new Error(`No active libraries found for media type: ${mediaType}`);
    }

    // Step -1: If item came from a known Plex library, use that library directly (100% confidence)
    if (metadata.source_library_id) {
      const sourceLibrary = libraries.find(l => l.id === metadata.source_library_id);
      if (sourceLibrary) {
        logger.info('Using source Plex library for classification', {
          title: metadata.title,
          library: sourceLibrary.name
        });
        return {
          library: sourceLibrary,
          confidence: 100,
          method: 'source_library',
          reason: `Already in library: ${sourceLibrary.name} (from Plex)`,
          libraries: libraries,
        };
      }
    }

    // Step -0.75: LEARNED CORRECTIONS (highest priority - user corrections are "truth")
    // This checks if a user previously corrected this exact tmdb_id
    const learnedCorrection = await this.checkLearnedCorrections(metadata.tmdb_id, metadata.media_type);
    if (learnedCorrection) {
      const correctedLibrary = libraries.find(l => l.id === learnedCorrection.corrected_library_id);
      if (correctedLibrary) {
        logger.info('Matched learned correction from user', {
          title: metadata.title,
          library: correctedLibrary.name,
          correctedAt: learnedCorrection.created_at
        });
        return {
          library: correctedLibrary,
          confidence: 100,
          method: 'manual_correction',
          reason: `Previously corrected by user: ${learnedCorrection.corrected_by || 'user'}`,
          libraries: libraries,
        };
      }
    }

    // NOTE: Legacy event detection (Step -0.5) and library rules (Step -0.25) removed in v0.37.8c.
    // These are now handled by the PolicyEngine via content presets and policy evaluation.

    // Step 0: Check if media already exists in media server (100% confidence)
    const existingMedia = await mediaSyncService.findExistingMedia(metadata.tmdb_id, mediaType);
    if (existingMedia) {
      logger.info('Media already exists in library', {
        tmdbId: metadata.tmdb_id,
        library: existingMedia.library_name
      });
      return {
        library: libraries.find(l => l.id === existingMedia.library_id),
        confidence: 100,
        method: 'existing_media',
        reason: `Already exists in ${existingMedia.library_name}`,
        libraries: libraries,
      };
    }

    // Step 0.5: Run content type analysis
    const contentAnalysis = await contentTypeAnalyzer.analyze(metadata);
    if (contentAnalysis.analyzed && contentAnalysis.bestMatch) {
      logger.info('Content type detected', {
        type: contentAnalysis.bestMatch.type,
        confidence: contentAnalysis.bestMatch.confidence
      });
      // Store analysis for later use
      metadata.contentAnalysis = contentAnalysis;
    }

    // Step 1: Check exact match (previously corrected TMDB ID)
    const exactMatch = await this.checkExactMatch(metadata.tmdb_id, mediaType);
    if (exactMatch) {
      return {
        library: libraries.find(l => l.id === exactMatch.library_id),
        confidence: 100,
        method: 'exact_match',
        reason: 'Previously classified and confirmed',
        libraries: libraries,
      };
    }

    // Step 2: Collect related evidence for PolicyEngine scoring (Phase 4 cutover)
    // The learned-pattern early-return shortcut has been removed; evidence now flows
    // through PolicyEngine as a scored channel so every item receives full policy scoring.
    const relatedEvidence = await classificationEvidenceService.collectRelatedEvidence({ metadata });
    if (relatedEvidence.length > 0) {
      const top = [...relatedEvidence].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      logger.info('Related evidence collected for PolicyEngine scoring', {
        title: metadata.title,
        evidenceCount: relatedEvidence.length,
        topLibraryId: top?.libraryId ?? null,
        topConfidence: top?.confidence ?? 0,
        topScope: top?.scope ?? null,
        uniqueScopes: [...new Set(relatedEvidence.map(e => e.scope).filter(Boolean))],
      });
    }

    // NOTE: Legacy rule-based matching (Step 3) removed in v0.37.8c.
    // PolicyEngine now handles all rule-based classification via content presets.

    // Step 3: Policy-guided path (policy evaluation + AI)
    const policyPath = await classificationPolicyPathService.execute({
      metadata, libraries, taskId, relatedEvidence,
    });
    if (policyPath.handled) return policyPath.result;

    // Step 4: Legacy signal path (SignalCollector + RAG + AI)
    return classificationLegacySignalPathService.execute({
      metadata, libraries, taskId, relatedEvidence,
      policyResult: policyPath.policyResult || null,
    });
  }

  async checkExactMatch(tmdbId, mediaType = null) {
    const exactMatch = await classificationEvidenceService.findExactMatch({ tmdbId, mediaType });
    return exactMatch ? { library_id: exactMatch.libraryId, confidence: exactMatch.confidence } : null;
  }

  // checkLearnedPatterns removed (Phase 7): dead method retired alongside LEARNED_PATTERN signal removal.

  /**
   * Check for learned corrections from user feedback
   * This has HIGHEST PRIORITY - user corrections are "truth"
   * Returns the correction if this exact TMDB ID was previously corrected
   */
  async checkLearnedCorrections(tmdbId, mediaType) {
    return classificationLearnedCorrectionsService.checkLearnedCorrections(tmdbId, mediaType);
  }

  async matchRules(metadata, libraries) {
    return libraryLabelsService.matchRules(metadata, libraries);
  }

  metadataMatchesLabel(metadata, label) {
    return libraryLabelsService.metadataMatchesLabel(metadata, label);
  }

  evaluateCustomRule(metadata, ruleJson) {
    return libraryLabelsService.evaluateCustomRule(metadata, ruleJson);
  }

  evaluateSingleCondition(metadata, condition) {
    return libraryLabelsService.evaluateSingleCondition(metadata, condition);
  }

  async aiClassify(metadata, libraries, signalContext = null, options = {}) {
    return classificationAiService.aiClassify(metadata, libraries, signalContext, options);
  }

  async logClassification(metadata, result, startTime = null) {
    return classificationPersistenceService.logClassification(metadata, result, startTime);
  }

  async persistRagLoopStageEvents(params) {
    return classificationPersistenceService.persistRagLoopStageEvents(params);
  }

  async rebindRetryLineage(classificationId, metadata = {}) {
    return classificationPersistenceService.rebindRetryLineage(classificationId, metadata);
  }

  async deriveClassificationPersistenceState(result) {
    return classificationPersistenceService.deriveClassificationPersistenceState(result);
  }

  async routeToArr(metadata, library) {
    return classificationRoutingService.routeToArr(metadata, library);
  }

  normalizeSettings(settings) {
    return classificationRoutingService.normalizeSettings(settings);
  }

  normalizeQualityProfileId(value) {
    return classificationRoutingService.normalizeQualityProfileId(value);
  }

  async ensureDecisionQuestion({ metadata, result, policyResult = null, libraries = [], ragContext = null }) {
    return classificationRoutingService.ensureDecisionQuestion({ metadata, result, policyResult, libraries, ragContext });
  }

  async normalizePolicyQuestion(value) {
    return classificationPersistenceService.normalizePolicyQuestion(value);
  }

  async resolveRoutingConfig(library) {
    return classificationRoutingService.resolveRoutingConfig(library);
  }

  isSettingsEmpty(settings) {
    return classificationRoutingService.isSettingsEmpty(settings);
  }

  async resolveDefaultQualityProfile(arrType, baseUrl, apiKey) {
    return classificationRoutingService.resolveDefaultQualityProfile(arrType, baseUrl, apiKey);
  }

  async resolveDefaultRootFolder(arrType, baseUrl, apiKey) {
    return classificationRoutingService.resolveDefaultRootFolder(arrType, baseUrl, apiKey);
  }

  /**
   * Retry classification for an item that failed due to AI unavailability
   * @param {number} classificationId - ID of the classification_history entry to retry
   */
  async retryClassification(classificationId) {
    try {
      const result = await classificationRetryService.retryClassifications({
        classificationIds: [classificationId],
        actor: 'scheduler',
        purgeLearning: false,
        correlationId: `scheduler-retry-${classificationId}`,
        taskSource: 'retry_queue',
        metadataEnrichmentSource: 'retry_queue_followup',
        route: 'scheduler:retry-queue'
      });

      return result.results?.[0] || null;
    } catch (error) {
      logger.error('Failed to retry classification', {
        classificationId,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  suggestSeriesType(metadata, appliedLabels = []) {
    return classificationRoutingService.suggestSeriesType(metadata, appliedLabels);
  }
}

module.exports = new ClassificationService();
