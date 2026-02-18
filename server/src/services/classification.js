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

const path = require('path');
const { randomUUID } = require('crypto');
const db = require('../config/database');
const tmdbService = require('./tmdb');
const ollamaService = require('./ollama');
const radarrService = require('./radarr');
const sonarrService = require('./sonarr');
const discordBot = require('./discordBot');
const tavilyService = require('./tavily');
const mediaSyncService = require('./mediaSync');
const contentTypeAnalyzer = require('./contentTypeAnalyzer');
const clarificationService = require('./clarificationService');
const classificationPhaseService = require('./classificationPhaseService');
const { SignalCollector, SIGNAL_TYPES } = require('./signalCollector');
const confidenceCalculator = require('./confidenceCalculator');
const ragRetriever = require('./ragRetriever');
const embeddingService = require('./embeddingService');
const contextManager = require('./contextManager');
const patternReinforcementService = require('./patternReinforcementService');
const policyEngine = require('./policyEngine');
const policyQuestionBuilder = require('./policyQuestionBuilder');
const providerLock = require('./providerLock');
const idleDetector = require('../utils/idleDetector');
const libraryProfileService = require('./libraryProfileService');
const aiPromptBuilder = require('./aiPromptBuilder');
const aiResponseParser = require('./aiResponseParser');
const { createLogger } = require('../utils/logger');
const ragLogger = require('../utils/ragLogger');
const { mapSecondPassError } = require('../utils/ragErrorHandler');
const ragLoopMetricsCollector = require('./ragLoopMetricsCollector');
const ragLoopResilienceManager = require('./ragLoopResilienceManager');
const { validateAndNormalizeRagLoopConfig } = require('../utils/ragLoopConfig');
const OperationController = require('../utils/operationController');
const {
  RAG_LOOP_FALLBACK_ACTIONS,
  RAG_LOOP_REASON_CODES,
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
  isRetryableDbConflictError,
  isAiRerunEligible,
  isLearningEligible,
  isMetadataEnrichmentEligible,
  resolvePolicyContextOrFallback,
  resolveConflictDecision,
  selectRetryStrategy,
  shouldTriggerSecondPass,
  summarizePassDiagnostics
} = require('../utils/ragLoopHelpers');

const logger = createLogger('classification');
const ROOT_PACKAGE_PATH = path.resolve(__dirname, '../../../package.json');
let APP_VERSION = 'unknown';
try {
  APP_VERSION = require(ROOT_PACKAGE_PATH).version || 'unknown';
} catch {
  APP_VERSION = 'unknown';
}

async function createAwaitingDecisionNotification(classificationId, title, reason, mediaType) {
  try {
    await db.query(
      `INSERT INTO app_notifications (type, title, message, data, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        'warning',
        `${title} needs attention`,
        reason || 'Manual review required',
        JSON.stringify({
          notificationType: 'awaiting_decision',
          classificationId,
          mediaType,
          targetPath: '/',
          targetAnchor: 'needs-attention',
          dismissible: false
        })
      ]
    );
    logger.debug('Created awaiting_decision notification', { classificationId, title });
  } catch (error) {
    logger.error('Failed to create awaiting_decision notification', {
      classificationId,
      title,
      error: error.message
    });
  }
}

// Constants
// Retry delay between failed classification attempts when AI is unavailable.
// Set to 5 minutes as a conservative backoff to avoid hammering external providers
// (TMDB, LLMs, etc.) while still allowing eventual progress without manual intervention.
// Configurable via this constant - adjust based on your provider rate limits and needs.
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const RAG_LOOP_MIN_TIMEOUT_MS = 1000;
const RAG_LOOP_MAX_TIMEOUT_MS = 15000;

class ClassificationService {
  async classify(overseerrPayload) {
    const startTime = Date.now(); // Track processing time
    try {
      // Record classification activity for idle detection
      idleDetector.recordActivity();

      // Parse payload - supports multiple formats (Overseerr, Plex gap analysis, Rule Builder)
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
      }

      // Run decision tree
      const result = await this.runDecisionTree(metadata, media_type, taskId);

      // Log to database
      const classificationId = await this.logClassification(metadata, result, startTime);
      await this.persistRagLoopStageEvents({ classificationId, metadata, result });

      // Reinforce patterns (if any were used in classification)
      if (result.signalContext && result.signalContext.patternSignals) {
        const patternSignals = result.signalContext.patternSignals;
        if (patternSignals.length > 0 && result.library) {
          // Async reinforcement - don't wait
          setImmediate(async () => {
            try {
              await patternReinforcementService.reinforceOnAccept(
                classificationId,
                patternSignals,
                result.library.id
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
        if (row && typeof row.auto_classify_threshold === 'number') {
          policyAutoThreshold = row.auto_classify_threshold;
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
        // Include bestMatch for queue service to use
        bestMatch: metadata.contentAnalysis?.bestMatch
      };
    } catch (error) {
      logger.error('Classification error', { error: error.message });
      throw error;
    }
  }

  parseOverseerrPayload(payload) {
    // Handle multiple payload formats:
    // 1. Overseerr webhook: has media.tmdbId and media.media_type
    // 2. Plex gap analysis: has title, tmdb_id (maybe), media.media_type
    // 3. Rule builder: has title, tmdb_id (maybe), media_type at root

    // Extract media type - check multiple locations
    let media_type = payload.media?.media_type || payload.media_type || 'movie';
    if (!media_type && payload.subject) {
      media_type = payload.subject.includes('Movie') ? 'movie' : 'tv';
    }

    // Extract TMDB ID - check multiple locations
    const tmdbId = payload.media?.tmdbId || payload.tmdb_id || payload.extra?.[0]?.value;
    const tvdbId = payload.media?.tvdbId || payload.tvdb_id;
    let requestedSeasons = payload.request?.seasons || payload.requested_seasons;
    if (typeof requestedSeasons === 'string') {
      try {
        requestedSeasons = JSON.parse(requestedSeasons);
      } catch (error) {
        requestedSeasons = null;
      }
    }

    // Extract title - check multiple locations  
    const title = payload.title || payload.subject || payload.media?.title || 'Unknown';

    // Extract year for better search matching
    const year = payload.year || payload.media?.year;

    // For gap analysis items, we might have full metadata already
    const existingMetadata = {
      overview: payload.overview,
      genres: payload.genres,
      keywords: payload.keywords,
      content_rating: payload.content_rating,
      original_language: payload.original_language,
      itemId: payload.itemId, // Internal ID for updating media_server_items
      source_library_id: payload.source_library_id, // Source Plex library ID
      source_library_name: payload.source_library_name, // Source Plex library name
      requested_seasons: Array.isArray(requestedSeasons) ? requestedSeasons : null,
      include_specials: payload.include_specials === true,
    };

    // Extract taskId if present (injected by queueService)
    const taskId = payload.taskId;

    existingMetadata.tvdb_id = tvdbId;

    return { media_type, tmdbId, title, year, existingMetadata, taskId };
  }

  async enrichWithTMDB(tmdbId, mediaType) {
    try {
      let details;
      if (mediaType === 'movie') {
        details = await tmdbService.getMovieDetails(tmdbId);
      } else {
        details = await tmdbService.getTVDetails(tmdbId);
      }

      const certification = await tmdbService.getCertification(tmdbId, mediaType);

      return {
        tmdb_id: tmdbId,
        media_type: mediaType,
        title: details.title || details.name,
        original_title: details.original_title || details.original_name,
        year: details.release_date?.substring(0, 4) || details.first_air_date?.substring(0, 4),
        overview: details.overview,
        genres: details.genres?.map(g => g.name) || [],
        keywords: details.keywords?.keywords?.map(k => k.name) || details.keywords?.results?.map(k => k.name) || [],
        certification: certification,
        rating: details.vote_average,
        popularity: details.popularity,
        original_language: details.original_language,
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        belongs_to_collection: details.belongs_to_collection || null,
        production_companies: Array.isArray(details.production_companies) ? details.production_companies : [],
        cast: Array.isArray(details.credits?.cast) ? details.credits.cast.slice(0, 10) : [],
      };
    } catch (error) {
      throw new Error(`Failed to enrich metadata: ${error.message}`);
    }
  }

  async getTavilyConfig() {
    const result = await db.query('SELECT * FROM tavily_config WHERE is_active = true LIMIT 1');
    return result.rows[0] || null;
  }

  async isRealtimeEmbeddingEnabled() {
    try {
      const result = await db.query(
        'SELECT realtime_embedding_enabled FROM ai_provider_config WHERE id = 1'
      );
      return result.rows.length > 0 ? result.rows[0].realtime_embedding_enabled : true;
    } catch (error) {
      // Default to true if column doesn't exist yet (migration not run)
      return true;
    }
  }

  async getRagLoopConfig() {
    try {
      const result = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');
      const row = result.rows[0] || {};
      const normalized = validateAndNormalizeRagLoopConfig(row).normalizedConfig;
      return {
        ...normalized,
        rag_loop_auto_fallback_breach_count: Math.max(0, Number(row.rag_loop_auto_fallback_breach_count || 0)),
        rag_loop_auto_fallback_last_breach_at: row.rag_loop_auto_fallback_last_breach_at || null,
        rag_loop_auto_fallback_last_triggered_at: row.rag_loop_auto_fallback_last_triggered_at || null,
        rag_loop_auto_fallback_cooldown_until: row.rag_loop_auto_fallback_cooldown_until || null,
        rag_loop_auto_fallback_last_incident_id: row.rag_loop_auto_fallback_last_incident_id || null,
        rag_loop_auto_fallback_last_incident_payload: row.rag_loop_auto_fallback_last_incident_payload || null,
        rag_loop_auto_fallback_last_version: row.rag_loop_auto_fallback_last_version || null,
        rag_loop_auto_recover_last_attempt_version: row.rag_loop_auto_recover_last_attempt_version || null,
        rag_loop_auto_recover_last_attempt_at: row.rag_loop_auto_recover_last_attempt_at || null
      };
    } catch (error) {
      logger.warn('Failed to load rag loop config, using defaults', { error: error.message });
      return {
        ...validateAndNormalizeRagLoopConfig({}).normalizedConfig,
        rag_loop_auto_fallback_breach_count: 0,
        rag_loop_auto_fallback_last_breach_at: null,
        rag_loop_auto_fallback_last_triggered_at: null,
        rag_loop_auto_fallback_cooldown_until: null,
        rag_loop_auto_fallback_last_incident_id: null,
        rag_loop_auto_fallback_last_incident_payload: null,
        rag_loop_auto_fallback_last_version: null,
        rag_loop_auto_recover_last_attempt_version: null,
        rag_loop_auto_recover_last_attempt_at: null
      };
    }
  }

  getCurrentAppVersion() {
    return process.env.APP_VERSION || APP_VERSION || 'unknown';
  }

  getCurrentImageTag() {
    return process.env.IMAGE_TAG || process.env.DOCKER_IMAGE_TAG || null;
  }

  async getRecentFallbackDiagnostics(limit = 20) {
    try {
      const boundedLimit = Math.max(1, Math.min(200, Number(limit) || 20));
      const result = await db.query(`
        SELECT reason_code, correlation_id
        FROM error_log
        WHERE module = 'RAG'
        ORDER BY created_at DESC
        LIMIT $1
      `, [boundedLimit]);

      const reasonCounts = {};
      const correlationIds = [];
      for (const row of result.rows || []) {
        if (row.reason_code) {
          reasonCounts[row.reason_code] = (reasonCounts[row.reason_code] || 0) + 1;
        }
        if (row.correlation_id && !correlationIds.includes(row.correlation_id)) {
          correlationIds.push(row.correlation_id);
        }
      }

      const topReasonCodes = Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([reason_code, count]) => ({ reason_code, count }));

      return {
        topReasonCodes,
        recentCorrelationIds: correlationIds.slice(0, 10)
      };
    } catch (error) {
      return {
        topReasonCodes: [],
        recentCorrelationIds: []
      };
    }
  }

  buildAutoFallbackIncidentPayload({
    incidentId,
    triggeredAt,
    evaluation,
    previousMode,
    nextMode,
    currentVersion,
    imageTag,
    diagnostics,
    stateSnapshot
  }) {
    return {
      incident_id: incidentId,
      triggered_at: triggeredAt,
      from_mode: previousMode,
      to_mode: nextMode,
      app_version: currentVersion,
      image_tag: imageTag || null,
      node_version: process.version,
      thresholds: evaluation.thresholds,
      observed_metrics: {
        ...evaluation.observedMetrics,
        consecutive_breach_reason_codes: evaluation.breachReasonCodes
      },
      top_reason_codes: diagnostics.topReasonCodes,
      recent_correlation_ids: diagnostics.recentCorrelationIds,
      fallback_state: {
        auto_fallback_enabled: stateSnapshot.autoFallbackEnabled,
        auto_recover_enabled: stateSnapshot.autoRecoverEnabled,
        cooldown_until: stateSnapshot.cooldownUntil || null
      },
      redaction_version: 1
    };
  }

  async persistAutoFallbackBreachCount({
    nextBreachCount,
    breachDetected
  }) {
    try {
      await db.query(`
        UPDATE ai_provider_config
        SET rag_loop_auto_fallback_breach_count = $1,
            rag_loop_auto_fallback_last_breach_at = CASE WHEN $2::boolean THEN NOW() ELSE rag_loop_auto_fallback_last_breach_at END,
            updated_at = NOW()
        WHERE id = 1
      `, [nextBreachCount, breachDetected === true]);
    } catch (error) {
      logger.warn('Failed to persist rag loop auto fallback breach count', { error: error.message });
    }
  }

  async maybeApplyRolloutAutomation({
    config,
    decision,
    correlationId,
    sampleRecorded = false
  }) {
    const state = {
      breachCount: Number(config.rag_loop_auto_fallback_breach_count || 0),
      cooldownUntil: config.rag_loop_auto_fallback_cooldown_until,
      lastFallbackVersion: config.rag_loop_auto_fallback_last_version,
      lastRecoverAttemptVersion: config.rag_loop_auto_recover_last_attempt_version
    };

    const currentVersion = this.getCurrentAppVersion();
    const autoRecoverEvaluation = ragLoopMetricsCollector.shouldAttemptAutoRecover({
      config,
      state,
      currentVersion,
      rolloutMode: decision.mode
    });

    if (autoRecoverEvaluation.shouldRecover) {
      try {
        await db.query(`
          UPDATE ai_provider_config
          SET rag_loop_rollout_mode = 'apply',
              rag_loop_auto_fallback_breach_count = 0,
              rag_loop_auto_fallback_cooldown_until = NULL,
              rag_loop_auto_recover_last_attempt_version = $1,
              rag_loop_auto_recover_last_attempt_at = NOW(),
              updated_at = NOW()
          WHERE id = 1
        `, [currentVersion]);

        await ragLogger.logStageEvent({
          stage: 'gate',
          outcome: 'applied',
          reason_code: 'rollout_auto_recover_applied',
          recoverable: true,
          rollout_mode: 'shadow',
          metadata: {
            current_version: currentVersion,
            previous_fallback_version: state.lastFallbackVersion || null
          },
          correlation_id: correlationId || null
        });
      } catch (error) {
        logger.warn('Failed to auto-recover rag loop rollout mode', { error: error.message });
      }
      return;
    }

    if (decision.mode !== 'apply') {
      return;
    }
    if (!sampleRecorded) {
      return;
    }

    const evaluation = ragLoopMetricsCollector.evaluateAutoFallback({
      config,
      state
    });

    if (evaluation.shouldPersistBreachCount && !evaluation.shouldFallback) {
      await this.persistAutoFallbackBreachCount({
        nextBreachCount: evaluation.nextBreachCount,
        breachDetected: evaluation.breachDetected
      });
    }

    if (!evaluation.shouldFallback) {
      return;
    }

    const incidentId = randomUUID();
    const triggeredAt = new Date().toISOString();
    const imageTag = this.getCurrentImageTag();
    const diagnostics = await this.getRecentFallbackDiagnostics(50);
    const incidentPayload = this.buildAutoFallbackIncidentPayload({
      incidentId,
      triggeredAt,
      evaluation,
      previousMode: 'apply',
      nextMode: 'shadow',
      currentVersion,
      imageTag,
      diagnostics,
      stateSnapshot: {
        autoFallbackEnabled: config.rag_loop_auto_fallback_enabled !== false,
        autoRecoverEnabled: config.rag_loop_auto_recover_enabled === true,
        cooldownUntil: config.rag_loop_auto_fallback_cooldown_until
      }
    });

    try {
      await db.query(`
        UPDATE ai_provider_config
        SET rag_loop_rollout_mode = 'shadow',
            rag_loop_auto_fallback_breach_count = 0,
            rag_loop_auto_fallback_last_breach_at = NOW(),
            rag_loop_auto_fallback_last_triggered_at = NOW(),
            rag_loop_auto_fallback_cooldown_until = NOW() + make_interval(secs => ($1::numeric / 1000.0)),
            rag_loop_auto_fallback_last_incident_id = $2,
            rag_loop_auto_fallback_last_incident_payload = $3::jsonb,
            rag_loop_auto_fallback_last_version = $4,
            updated_at = NOW()
        WHERE id = 1
      `, [
        evaluation.thresholds.cooldown_ms,
        incidentId,
        JSON.stringify(incidentPayload),
        currentVersion
      ]);

      await ragLogger.logStageEvent({
        stage: 'gate',
        outcome: 'error',
        reason_code: 'rollout_auto_fallback_triggered',
        fallback_action: 'mode_switched_shadow',
        recoverable: false,
        rollout_mode: 'apply',
        correlation_id: correlationId || null,
        metadata: {
          incident_id: incidentId,
          thresholds: evaluation.thresholds,
          observed_metrics: evaluation.observedMetrics,
          breach_reason_codes: evaluation.breachReasonCodes,
          app_version: currentVersion,
          image_tag: imageTag || null
        }
      });
    } catch (error) {
      logger.warn('Failed to apply rag loop auto fallback transition', { error: error.message });
    }
  }

  resolveRagLoopTimeout(config = {}) {
    const metadataTimeout = Number(config.policy_recheck_metadata_timeout_ms);
    const computed = Number.isFinite(metadataTimeout) ? metadataTimeout + 8000 : 10000;
    return Math.max(RAG_LOOP_MIN_TIMEOUT_MS, Math.min(RAG_LOOP_MAX_TIMEOUT_MS, computed));
  }

  async withTimeout(operationOrPromise, timeoutMs, timeoutMessage = 'operation_timeout') {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      if (typeof operationOrPromise === 'function') {
        return operationOrPromise(null);
      }
      return operationOrPromise;
    }

    if (typeof operationOrPromise === 'function') {
      const controller = new OperationController({ timeout: timeoutMs, mode: 'simple' });
      try {
        return await controller.run(async (ctx) => {
          return await operationOrPromise(ctx.signal);
        });
      } catch (error) {
        if (error.name === 'AbortError' || error.code === 'ABORT_ERR' || error.code === 'ERR_CANCELED') {
          const timeoutError = new Error(timeoutMessage);
          timeoutError.name = 'TimeoutError';
          timeoutError.originalError = error;
          throw timeoutError;
        }
        throw error;
      }
    }

    let timeoutHandle = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    try {
      const result = await Promise.race([operationOrPromise, timeoutPromise]);
      return result;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  async sleep(ms) {
    const delayMs = Number(ms);
    if (!Number.isFinite(delayMs) || delayMs <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  async withRetryableDbConflict(operation, options = {}) {
    const maxAttempts = Math.max(1, Number(options.maxAttempts || 1));
    const baseDelayMs = Math.max(1, Number(options.baseDelayMs || 100));
    let attempt = 0;
    let lastError = null;

    while (attempt < maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const dbError = classifyDbSqlState(error);
        const canRetry = isRetryableDbConflictError(error) && attempt < (maxAttempts - 1);

        if (!canRetry) {
          throw error;
        }

        const delayMs = Math.min(1000, baseDelayMs * Math.pow(2, attempt));
        if (typeof options.onRetry === 'function') {
          options.onRetry({
            attempt: attempt + 1,
            maxAttempts,
            delayMs,
            sqlState: dbError.sqlState,
            reasonCode: dbError.reasonCode
          });
        }
        await this.sleep(delayMs);
      }

      attempt += 1;
    }

    throw lastError || new Error('db_retry_attempts_exhausted');
  }

  isAiTransientAvailabilityError(error) {
    const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
    const code = typeof error?.code === 'string' ? error.code.toUpperCase() : '';

    if (['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND'].includes(code)) {
      return true;
    }

    const patterns = [
      'timeout waiting for lock',
      'providerlock',
      'ai is not available',
      'budget exhausted',
      'connection refused',
      'connect econnrefused',
      'service unavailable',
      'temporarily unavailable',
      'is currently loading',
      'try again',
      'model is busy',
      'ollama'
    ];

    return patterns.some(pattern => message.includes(pattern));
  }

  buildPendingRetryResult({
    confidence = 0,
    libraries = [],
    signalContext = null
  }) {
    return {
      library: null,
      confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : 0,
      method: 'queued_for_retry',
      reason: 'AI temporarily unavailable or busy - queued for retry',
      retry_after: new Date(Date.now() + RETRY_DELAY_MS),
      retry_count: 0,
      max_retries: 3,
      libraries,
      signalContext,
      needs_retry: true
    };
  }

  mergeMetadataForRecheck(originalMetadata, enrichedMetadata) {
    if (!enrichedMetadata) {
      return { ...originalMetadata };
    }

    const merged = { ...originalMetadata };
    const copyIfMissing = (key) => {
      const current = merged[key];
      const incoming = enrichedMetadata[key];
      const hasCurrent = Array.isArray(current)
        ? current.length > 0
        : !!current;

      if (!hasCurrent && incoming) {
        merged[key] = incoming;
      }
    };

    copyIfMissing('genres');
    copyIfMissing('keywords');
    copyIfMissing('belongs_to_collection');
    copyIfMissing('production_companies');
    copyIfMissing('cast');
    copyIfMissing('original_title');
    copyIfMissing('overview');

    return merged;
  }

  buildPolicyRecheckCandidate({
    baselineResult,
    libraries,
    policyResult,
    ragContext,
    adoptionReason
  }) {
    const preferredLibraryId =
      policyResult?.library?.library_id ||
      policyResult?.ranked?.[0]?.library_id ||
      baselineResult?.library?.id ||
      null;
    const nextLibrary = libraries.find((library) => library.id === preferredLibraryId) || baselineResult.library || null;
    const nextAction = policyResult?.action || null;
    const shouldClarify = nextAction === 'prompt_confirm' || nextAction === 'prompt_select';

    return {
      ...baselineResult,
      library: nextLibrary,
      confidence: Math.max(
        Number(baselineResult?.confidence || 0),
        Number(policyResult?.confidence || 0)
      ),
      method: nextAction === 'auto_classify' ? 'policy_auto' : 'policy_recheck',
      reason: adoptionReason || `Policy re-check: ${nextAction || 'updated'}`,
      needs_clarification: shouldClarify,
      policyResult: policyResult || baselineResult.policyResult,
      ragContext: ragContext || baselineResult.ragContext
    };
  }

  buildAiRerunCandidate({
    baselineResult,
    aiRerunMatch,
    libraries,
    signalContext,
    policyResult,
    ragContext
  }) {
    return {
      ...baselineResult,
      ...aiRerunMatch,
      method: aiRerunMatch.verified_by_ai ? 'ai_verified' : 'ai_rerun',
      libraries: baselineResult.libraries || libraries,
      signalContext: baselineResult.signalContext || signalContext || null,
      policyResult: policyResult || baselineResult.policyResult || null,
      ragContext: ragContext || baselineResult.ragContext || null
    };
  }

  async evaluateRagLoopSecondPass({
    metadata,
    libraries,
    baselineResult,
    policyResult = null,
    signalContext = null,
    ragContext = null
  }) {
    const config = await this.getRagLoopConfig();
    const rolloutMode = config.rag_loop_rollout_mode || 'shadow';
    const correlationId = randomUUID();
    const traceConfig = {
      maxEvents: config.rag_loop_trace_max_events,
      maxBytes: config.rag_loop_trace_max_bytes
    };
    const policyContext = resolvePolicyContextOrFallback({ policyResult });
    const trigger = shouldTriggerSecondPass({
      config,
      policyResult,
      aiResult: baselineResult,
      signalContext
    });

    if (!config.rag_retrieval_loop_enabled) {
      return baselineResult;
    }

    const loopStart = Date.now();
    const loopTimeoutMs = this.resolveRagLoopTimeout(config);
    const events = [];
    const topN = Math.max(1, Number(config.rag_conflict_top_n || 5));
    const candidateLimit = Math.max(1, Number(config.rag_loop_candidate_limit || 25));
    const expansionOptions = {
      identifierCaps: config.policy_recheck_identifier_caps,
      aliasEnabled: config.rag_alias_expansion_enabled,
      aliasMaxTerms: config.rag_alias_max_terms,
      aliasMinTokenLength: config.rag_alias_min_token_length
    };
    const addEvent = ({
      stage,
      outcome,
      reason,
      reasonCode,
      fallbackAction = null,
      recoverable = true,
      sqlState = null,
      error = null
    }) => {
      const errorDetails = error ? {
        error_message: error.message || String(error),
        error_name: error.name || 'Error',
        error_stack: error.stack || null
      } : {};
      events.push({
        stage,
        outcome,
        reason: reason || reasonCode || (error ? error.message : null) || null,
        reason_code: reasonCode || null,
        fallback_action: fallbackAction,
        recoverable,
        sql_state: sqlState,
        ...errorDetails
      });
    };
    const classifyStageError = (stage, error, fallbackReasonCode) => {
      const mapped = mapSecondPassError({
        stage,
        fallbackReasonCode,
        error
      });
      const message = typeof error?.message === 'string' ? error.message.trim() : '';
      const messageCode = /^[a-z0-9_]+$/i.test(message) ? message : null;
      return {
        reasonCode: mapped.reasonCode || messageCode || fallbackReasonCode,
        sqlState: mapped.sqlState,
        recoverable: mapped.recoverable
      };
    };
    const withRagLoopLogContext = (finalResult, strategy = null) => ({
      ...finalResult,
      ragLoopLogContext: {
        correlationId,
        mode: rolloutMode,
        strategy: strategy || null,
        trigger: trigger.trigger || null,
        events: events.map((event) => ({ ...event }))
      }
    });

    if (!trigger.run) {
      addEvent({
        stage: 'gate',
        outcome: 'skipped',
        reason: trigger.reason,
        reasonCode: trigger.reason === 'feature_disabled'
          ? RAG_LOOP_REASON_CODES.FEATURE_DISABLED
          : (policyContext.hasPolicyContext ? RAG_LOOP_REASON_CODES.GATE_NOT_MET : RAG_LOOP_REASON_CODES.POLICY_CONTEXT_MISSING),
        fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.GATE_SKIPPED
      });

      const trace = buildRagLoopTrace({
        mode: rolloutMode,
        ran: false,
        trigger: trigger.trigger,
        events,
        traceConfig
      });

      const decision = applyOrShadowDecision({
        baselineResult,
        resolvedResult: baselineResult,
        comparison: { adopt: false, reason: trigger.reason },
        rolloutMode,
        trace: config.rag_loop_trace_enabled ? trace : null
      });
      await this.maybeApplyRolloutAutomation({
        config,
        decision,
        correlationId,
        sampleRecorded: false
      });
      return withRagLoopLogContext(decision.finalResult);
    }

    const remainingBudget = () => Math.max(0, loopTimeoutMs - (Date.now() - loopStart));
    let aiCallsUsed = 1;
    let hadError = false;
    const recheckEligibility = getRecheckEligibility(
      {
        trigger: trigger.trigger,
        policyContext,
        policyResult,
        identifierCaps: config.policy_recheck_identifier_caps
      },
      metadata,
      config
    );

    if (trigger.trigger === 'policy_prompt_select' && !recheckEligibility.eligible) {
      addEvent({
        stage: 'gate',
        outcome: 'skipped',
        reason: recheckEligibility.reasonCode,
        reasonCode: recheckEligibility.reasonCode,
        fallbackAction: recheckEligibility.fallbackAction || RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED
      });

      let trace = null;
      if (config.rag_loop_trace_enabled) {
        try {
          trace = buildRagLoopTrace({
            mode: rolloutMode,
            ran: true,
            trigger: trigger.trigger,
            events,
            traceConfig
          });
        } catch (error) {
          logger.warn('Failed to build rag loop trace', {
            correlationId,
            stage: 'trace',
            reason_code: RAG_LOOP_REASON_CODES.DB_UNKNOWN_FAILURE,
            fallback_action: RAG_LOOP_FALLBACK_ACTIONS.TRACE_OMITTED,
            error: error.message
          });
          trace = null;
        }
      }

      const decision = applyOrShadowDecision({
        baselineResult,
        resolvedResult: baselineResult,
        comparison: { adopt: false, reason: recheckEligibility.reasonCode },
        rolloutMode,
        trace
      });

      ragLoopMetricsCollector.recordEvaluation({
        rolloutMode: decision.mode,
        wouldUpgrade: decision.wouldAdopt,
        adopted: decision.adopted,
        hadError,
        latencyDeltaMs: (Date.now() - loopStart) - Number(baselineResult?.signalContext?.processingTimeMs || 0)
      });
      await this.maybeApplyRolloutAutomation({
        config,
        decision,
        correlationId,
        sampleRecorded: true
      });

      return withRagLoopLogContext(decision.finalResult);
    }

    const pass1Candidates = await this.withTimeout(
      (signal) => ragRetriever.semanticSearchCandidates(metadata, candidateLimit, {
        pass: 'pass1',
        throwOnError: true,
        signal
      }),
      Math.max(1, remainingBudget()),
      'rag_pass1_candidate_timeout'
    ).catch((error) => {
      hadError = true;
      const stageError = classifyStageError('gate', error, 'rag_pass1_candidate_failed');
      addEvent({
        stage: 'gate',
        outcome: 'error',
        reason: error.message,
        reasonCode: stageError.reasonCode,
        recoverable: stageError.recoverable,
        sqlState: stageError.sqlState
      });
      return [];
    });

    const pass1Conflict = config.rag_loop_conflict_detection_enabled
      ? detectRagConflict(pass1Candidates, config)
      : { isConflict: false, reason: 'conflict_detection_disabled' };
    const pass1Matches = Array.isArray(ragContext?.similarItems) && ragContext.similarItems.length > 0
      ? ragContext.similarItems
      : pass1Candidates.slice(0, topN);
    const pass1Diagnostics = summarizePassDiagnostics(pass1Matches, pass1Conflict, topN);
    const metadataCompleteness = getMetadataCompleteness(metadata, config);
    const strategySelection = selectRetryStrategy(pass1Diagnostics, metadataCompleteness, config);
    addEvent({
      stage: 'gate',
      outcome: 'run',
      reason: trigger.trigger,
      reasonCode: trigger.trigger || RAG_LOOP_REASON_CODES.GATE_NOT_MET
    });
    addEvent({
      stage: 'gate',
      outcome: 'strategy_selected',
      reason: strategySelection.reason,
      reasonCode: strategySelection.reason
    });

    let workingMetadata = { ...metadata };
    const enrichmentGate = isMetadataEnrichmentEligible({
      trigger: trigger.trigger,
      metadata: workingMetadata,
      metadataCompleteness,
      config,
      attempts: 0
    });

    if (enrichmentGate.eligible && remainingBudget() > 0) {
      const resilienceGate = ragLoopResilienceManager.canRun('tmdb_enrichment', config);
      if (!resilienceGate.allowed) {
        addEvent({
          stage: 'enrichment',
          outcome: 'skipped',
          reason: resilienceGate.reasonCode,
          reasonCode: resilienceGate.reasonCode,
          fallbackAction: resilienceGate.fallbackAction || RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED
        });
      } else {
        try {
          const timeoutMs = Math.min(
            Number(config.policy_recheck_metadata_timeout_ms || 2000),
            Math.max(1, remainingBudget())
          );
          const enrichedMetadata = await this.withTimeout(
            this.enrichWithTMDB(workingMetadata.tmdb_id, workingMetadata.media_type),
            timeoutMs,
            'metadata_enrichment_timeout'
          );
          workingMetadata = this.mergeMetadataForRecheck(workingMetadata, enrichedMetadata);
          ragLoopResilienceManager.recordSuccess('tmdb_enrichment', config);
          addEvent({
            stage: 'enrichment',
            outcome: 'applied',
            reason: 'metadata_updated',
            reasonCode: 'metadata_updated'
          });
        } catch (error) {
          hadError = true;
          ragLoopResilienceManager.recordFailure('tmdb_enrichment', error, config);
      const stageError = classifyStageError('enrichment', error, 'metadata_enrichment_failed');
          addEvent({
            stage: 'enrichment',
            outcome: 'skipped',
            reason: error.message,
            reasonCode: stageError.reasonCode,
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED,
            recoverable: stageError.recoverable,
            sqlState: stageError.sqlState
          });
        }
      }
    } else {
      addEvent({
        stage: 'enrichment',
        outcome: 'skipped',
        reason: enrichmentGate.reason,
        reasonCode: enrichmentGate.reason,
        fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.ENRICHMENT_SKIPPED
      });
    }

    const expandedMetadata = expandRetrievalMetadata(workingMetadata, {
      pass: 'pass2',
      ...expansionOptions
    });

    let pass2Matches = [];
    let pass2Enabled = false;
    if (remainingBudget() > 0) {
      const resilienceGate = ragLoopResilienceManager.canRun('rag_pass2', config);
      if (!resilienceGate.allowed) {
        addEvent({
          stage: 'retrieval_pass2',
          outcome: 'skipped',
          reason: resilienceGate.reasonCode,
          reasonCode: resilienceGate.reasonCode,
          fallbackAction: resilienceGate.fallbackAction || RAG_LOOP_FALLBACK_ACTIONS.PASS2_SKIPPED
        });
      } else {
        pass2Enabled = true;
        try {
          const limit = Math.max(topN, 5);
          if (strategySelection.strategy === 'semantic') {
            pass2Matches = await this.withTimeout(
              (signal) => ragRetriever.semanticSearch(expandedMetadata, limit, {
                pass: 'pass2',
                applyThreshold: false,
                useExpandedQuery: true,
                throwOnError: true,
                expansionOptions,
                signal
              }),
              Math.max(1, remainingBudget()),
              'rag_pass2_semantic_timeout'
            );
          } else {
            pass2Matches = await this.withTimeout(
              (signal) => ragRetriever.hybridSearch(expandedMetadata, limit, {
                pass: 'pass2',
                applyThreshold: false,
                useExpandedQuery: true,
                throwOnError: true,
                expansionOptions,
                signal
              }),
              Math.max(1, remainingBudget()),
              'rag_pass2_hybrid_timeout'
            );
          }
          ragLoopResilienceManager.recordSuccess('rag_pass2', config);
          addEvent({
            stage: 'retrieval_pass2',
            outcome: 'applied',
            reason: strategySelection.strategy,
            reasonCode: strategySelection.strategy
          });
        } catch (error) {
          hadError = true;
          ragLoopResilienceManager.recordFailure('rag_pass2', error, config);
          const stageError = classifyStageError('retrieval_pass2', error, 'rag_pass2_failed');
          addEvent({
            stage: 'retrieval_pass2',
            outcome: 'error',
            reason: error.message,
            reasonCode: stageError.reasonCode,
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.PASS2_SKIPPED,
            recoverable: stageError.recoverable,
            sqlState: stageError.sqlState
          });
          pass2Matches = [];
        }
      }
    } else {
      addEvent({
        stage: 'retrieval_pass2',
        outcome: 'skipped',
        reason: 'loop_budget_exhausted',
        reasonCode: 'loop_budget_exhausted',
        fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.PASS2_SKIPPED
      });
    }

    const pass2Candidates = (pass2Enabled && remainingBudget() > 0)
      ? await ragRetriever.semanticSearchCandidates(expandedMetadata, candidateLimit, {
        pass: 'pass2',
        useExpandedQuery: true,
        throwOnError: true,
        expansionOptions
      }).catch((error) => {
        hadError = true;
        ragLoopResilienceManager.recordFailure('rag_pass2', error, config);
        const stageError = classifyStageError('retrieval_pass2', error, 'rag_pass2_candidates_failed');
        addEvent({
          stage: 'retrieval_pass2',
          outcome: 'error',
          reason: error.message,
          reasonCode: stageError.reasonCode,
          fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.PASS2_SKIPPED,
          recoverable: stageError.recoverable,
          sqlState: stageError.sqlState
        });
        return [];
      })
      : [];
    const pass2Conflict = config.rag_loop_conflict_detection_enabled
      ? detectRagConflict(pass2Candidates, config)
      : { isConflict: false, reason: 'conflict_detection_disabled' };
    
    // Defensive check added
    const pass2Diagnostics = summarizePassDiagnostics(
      pass2Matches && pass2Matches.length > 0 ? pass2Matches : pass2Candidates.slice(0, topN),
      pass2Conflict,
      topN
    );

    const pass2RagContext = pass2Matches && pass2Matches.length > 0
      ? {
        similarItems: pass2Matches.slice(0, 3),
        suggestion: ragRetriever.getSuggestedLibrary(pass2Matches)
      }
      : ragContext;

    let policyAfter = policyResult;
    let policyGate = {
      shouldAdopt: false,
      actionUpgraded: false,
      measurableImprovement: false,
      reason: 'policy_not_run',
      metrics: {}
    };
    let pass2Candidate = null;

    if (trigger.trigger === 'policy_prompt_select' && remainingBudget() > 0) {
      const evidence = extractVerifiableEvidence(expandedMetadata, config.policy_recheck_identifier_caps);
      if (evidence.totalTokens > 0 || (pass2Matches && pass2Matches.length > 0)) {
        try {
          policyAfter = await this.withRetryableDbConflict(
            async () => this.withTimeout(
              policyEngine.evaluateItem(expandedMetadata, {
                ragCache: {
                  matches: pass2Matches ? pass2Matches.slice(0, 5) : [],
                  timestamp: Date.now()
                }
              }),
              Math.max(1, remainingBudget()),
              'policy_recheck_timeout'
            ),
            {
              maxAttempts: 2,
              baseDelayMs: 75,
              onRetry: ({ attempt, maxAttempts, delayMs, reasonCode, sqlState }) => {
                addEvent({
                  stage: 'policy_recheck',
                  outcome: 'retry',
                  reason: `retry_${attempt}_of_${maxAttempts}`,
                  reasonCode,
                  fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
                  recoverable: true,
                  sqlState
                });
              }
            }
          );
          policyGate = evaluatePolicyRecheckGate({
            policyBefore: policyResult,
            policyAfter,
            pass1Diagnostics,
            pass2Diagnostics,
            config
          });

          addEvent({
            stage: 'policy_recheck',
            outcome: policyGate.shouldAdopt ? 'accepted' : 'evaluated',
            reason: policyGate.reason,
            reasonCode: policyGate.reason,
            fallbackAction: policyGate.shouldAdopt
              ? null
              : RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED
          });

          if (policyGate.shouldAdopt) {
            pass2Candidate = this.buildPolicyRecheckCandidate({
              baselineResult,
              libraries,
              policyResult: policyAfter,
              ragContext: pass2RagContext,
              adoptionReason: 'Policy re-check upgraded confidence'
            });
          }
        } catch (error) {
          hadError = true;
          const stageError = classifyStageError('policy_recheck', error, 'policy_recheck_failed');
          addEvent({
            stage: 'policy_recheck',
            outcome: 'error',
            reason: error.message,
            reasonCode: stageError.reasonCode,
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
            recoverable: stageError.recoverable,
            sqlState: stageError.sqlState
          });
        }
      } else {
        addEvent({
          stage: 'policy_recheck',
          outcome: 'skipped',
          reason: RAG_LOOP_REASON_CODES.NO_VERIFIABLE_EVIDENCE,
          reasonCode: RAG_LOOP_REASON_CODES.NO_VERIFIABLE_EVIDENCE,
          fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED
        });
      }
    }

    if (!pass2Candidate) {
      const resilienceGate = ragLoopResilienceManager.canRun('ai_rerun', config);
      if (!resilienceGate.allowed) {
        addEvent({
          stage: 'ai_rerun',
          outcome: 'skipped',
          reason: resilienceGate.reasonCode,
          reasonCode: resilienceGate.reasonCode,
          fallbackAction: resilienceGate.fallbackAction || RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED
        });
      } else {
        const aiRerunGate = isAiRerunEligible({
          trigger: trigger.trigger,
          aiCallsUsed,
          config,
          pass1Diagnostics,
          pass2Diagnostics,
          policyAfter
        });

        if (aiRerunGate.eligible) {
          try {
            aiCallsUsed += 1;
            const aiRerunMatch = await this.aiClassify(expandedMetadata, libraries, signalContext, {
              mode: 'classify',
              ragContext: pass2RagContext
            });
            pass2Candidate = this.buildAiRerunCandidate({
              baselineResult,
              aiRerunMatch,
              libraries,
              signalContext,
              policyResult: policyAfter,
              ragContext: pass2RagContext
            });
            ragLoopResilienceManager.recordSuccess('ai_rerun', config);
            addEvent({
              stage: 'ai_rerun',
              outcome: 'applied',
              reason: 'material_improvement',
              reasonCode: 'material_improvement'
            });
          } catch (error) {
            const isTransientAiAvailability = this.isAiTransientAvailabilityError(error);
            if (!isTransientAiAvailability) {
              hadError = true;
              ragLoopResilienceManager.recordFailure('ai_rerun', error, config);
            }
            const stageError = classifyStageError('ai_rerun', error, 'ai_rerun_failed');
            const errorMessage = error.message || error.name || String(error) || 'unknown_error';
            addEvent({
              stage: 'ai_rerun',
              outcome: isTransientAiAvailability ? 'skipped' : 'error',
              reason: errorMessage,
              reasonCode: isTransientAiAvailability ? 'ai_temporarily_unavailable' : (error.code || stageError.reasonCode),
              fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED,
              recoverable: stageError.recoverable,
              sqlState: stageError.sqlState,
              error
            });
          }
        } else {
          addEvent({
            stage: 'ai_rerun',
            outcome: 'skipped',
            reason: aiRerunGate.reason,
            reasonCode: aiRerunGate.reason,
            fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED
          });
        }
      }
    } else {
      addEvent({
        stage: 'ai_rerun',
        outcome: 'skipped',
        reason: 'policy_candidate_selected',
        reasonCode: 'policy_candidate_selected',
        fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.AI_RERUN_SKIPPED
      });
    }

    // Fix 4: Build a candidate from pass2 RAG data when neither policy recheck
    // nor AI rerun produced one, but pass2 retrieval found better matches
    if (!pass2Candidate && pass2Matches && pass2Matches.length > 0 && pass2RagContext?.suggestion) {
      const ragSuggestion = pass2RagContext.suggestion;
      const ragLibrary = libraries.find(l =>
        l.name === ragSuggestion || l.id === ragSuggestion
      );
      if (ragLibrary) {
        const ragConfidence = Math.max(
          Number(baselineResult?.confidence || 0),
          Math.min(75, Number(pass2Diagnostics.topSimilarity || 0) * 100)
        );
        pass2Candidate = {
          ...baselineResult,
          library: ragLibrary,
          confidence: ragConfidence,
          method: 'rag_improved',
          reason: 'Pass2 RAG retrieval found stronger matches',
          ragContext: pass2RagContext,
          policyResult: policyAfter || policyResult
        };
        addEvent({
          stage: 'rag_candidate',
          outcome: 'applied',
          reason: 'rag_candidate_built',
          reasonCode: 'rag_candidate_built'
        });
      }
    }

    const comparison = comparePassResults({
      baselineResult,
      pass2Result: pass2Candidate,
      policyGate,
      pass1Diagnostics,
      pass2Diagnostics,
      config
    });
    const resolution = resolveConflictDecision({
      baselineResult,
      pass2Result: pass2Candidate,
      comparison,
      policyBefore: policyResult,
      policyAfter,
      pass2Conflict
    });
    const learning = isLearningEligible({
      config,
      rolloutMode,
      secondPassApplied: comparison.adopt,
      userValidated: false,
      machineOnly: true
    });
    let trace = null;
    if (config.rag_loop_trace_enabled) {
      try {
        trace = buildRagLoopTrace({
          mode: rolloutMode,
          ran: true,
          trigger: trigger.trigger,
          strategy: strategySelection.strategy,
          events,
          pass1Diagnostics,
          pass2Diagnostics,
          comparison,
          resolution,
          learning,
          timing: {
            total: Date.now() - loopStart
          },
          traceConfig
        });
      } catch (error) {
        hadError = true;
        addEvent({
          stage: 'trace',
          outcome: 'error',
          reason: error.message,
          reasonCode: 'trace_build_failed',
          fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.TRACE_OMITTED
        });
        logger.warn('Failed to build rag loop trace', {
          correlationId,
          stage: 'trace',
          reason_code: 'trace_build_failed',
          fallback_action: RAG_LOOP_FALLBACK_ACTIONS.TRACE_OMITTED,
          error: error.message
        });
        trace = null;
      }
    }

    const decision = applyOrShadowDecision({
      baselineResult,
      resolvedResult: resolution.resolvedResult,
      comparison,
      rolloutMode,
      trace
    });

    ragLoopMetricsCollector.recordEvaluation({
      rolloutMode: decision.mode,
      wouldUpgrade: decision.wouldAdopt,
      adopted: decision.adopted,
      hadError,
      latencyDeltaMs: (Date.now() - loopStart) - Number(baselineResult?.signalContext?.processingTimeMs || 0)
    });
    await this.maybeApplyRolloutAutomation({
      config,
      decision,
      correlationId,
      sampleRecorded: true
    });

    return withRagLoopLogContext(decision.finalResult, strategySelection.strategy);
  }

  async enrichWithWebSearch(metadata) {
    const tavilyConfig = await this.getTavilyConfig();
    if (!tavilyConfig || !tavilyConfig.is_active || !tavilyConfig.api_key) {
      return null;
    }

    try {
      const searchOptions = {
        apiKey: tavilyConfig.api_key,
        searchDepth: tavilyConfig.search_depth || 'advanced',
        maxResults: tavilyConfig.max_results || 5,
        includeDomains: tavilyConfig.include_domains || ['imdb.com', 'rottentomatoes.com'],
        excludeDomains: tavilyConfig.exclude_domains || []
      };

      // Search IMDB for additional info
      const imdbResults = await tavilyService.searchIMDB(
        metadata.title,
        metadata.year,
        metadata.media_type,
        searchOptions
      );

      // Get content advisory if needed for classification
      const advisoryResults = await tavilyService.getContentAdvisory(
        metadata.title,
        metadata.year,
        searchOptions
      );

      // If anime is suspected, get anime-specific info
      if (this.mightBeAnime(metadata)) {
        const animeResults = await tavilyService.searchAnimeInfo(metadata.title, searchOptions);
        return {
          imdb: imdbResults,
          advisory: advisoryResults,
          anime: animeResults
        };
      }

      return {
        imdb: imdbResults,
        advisory: advisoryResults
      };
    } catch (error) {
      const status = error.status || null;
      const isQuotaError = status === 429 || status === 432;
      if (isQuotaError) {
        logger.warn('Tavily quota/rate-limit reached, skipping web enrichment', { status, error: error.message });
      } else {
        logger.error('Tavily search failed', { error: error.message });
      }
      return null;
    }
  }

  /**
   * Detect all matching event types from metadata (for rule condition evaluation)
   * Returns array of event type strings that match keywords in metadata
   */
  detectEventTypesFromMetadata(metadata) {
    const textToSearch = [
      metadata.title || '',
      metadata.overview || '',
      ...(metadata.keywords || []),
      ...(metadata.genres || [])
    ].join(' ').toLowerCase();

    const eventKeywords = {
      holiday: ['christmas', 'xmas', 'santa', 'halloween', 'thanksgiving', 'easter', 'hanukkah', 'kwanzaa', 'new years eve', 'holiday'],
      sports: ['nfl', 'nba', 'mlb', 'nhl', 'mls', 'fifa', 'super bowl', 'world series', 'olympics', 'championship', 'playoffs'],
      ppv: ['ufc', 'mma', 'boxing', 'wwe', 'wrestling', 'wrestlemania', 'bellator', 'fight night', 'knockout'],
      concert: ['concert', 'live tour', 'music festival', 'live performance', 'symphony', 'orchestra', 'unplugged'],
      standup: ['stand-up', 'standup', 'comedy special', 'comedian', 'comedy tour', 'roast', 'improv'],
      awards: ['oscars', 'academy awards', 'emmys', 'golden globes', 'grammys', 'tony awards', 'bafta', 'red carpet']
    };

    const matchedTypes = [];
    for (const [eventType, keywords] of Object.entries(eventKeywords)) {
      if (keywords.some(kw => textToSearch.includes(kw))) {
        matchedTypes.push(eventType);
      }
    }
    return matchedTypes;
  }


  /**
   * Check library rules to find matching library
   * Rules are checked in priority order
   * Now uses library_rules_v2 with conditions JSON format
   */
  async checkLibraryRules(metadata, libraries) {
    // Get all active rules from the v2 table
    const rulesResult = await db.query(`
      SELECT r.*, l.name as library_name
      FROM library_rules_v2 r
      JOIN libraries l ON r.library_id = l.id
      WHERE r.is_active = true AND l.is_active = true
      ORDER BY l.priority DESC, r.priority ASC
    `);

    if (rulesResult.rows.length === 0) {
      return null;
    }

    // Prepare metadata for matching
    const itemData = {
      rating: (metadata.certification || '').toUpperCase(),
      genre: (metadata.genres || []).map(g => g.toLowerCase()),
      keyword: (metadata.keywords || []).map(k => k.toLowerCase()),
      language: (metadata.original_language || '').toLowerCase(),
      year: metadata.year ? parseInt(metadata.year) : null,
      title: (metadata.title || '').toLowerCase(),
      overview: (metadata.overview || '').toLowerCase(),
      content_type: metadata.contentAnalysis?.bestMatch?.type || null,
      // Detect event types for rule matching
      event_type: this.detectEventTypesFromMetadata(metadata),
    };

    // Check each rule
    for (const rule of rulesResult.rows) {
      // Parse conditions JSON
      let conditions;
      try {
        conditions = typeof rule.conditions === 'string'
          ? JSON.parse(rule.conditions)
          : rule.conditions;
      } catch (e) {
        logger.warn('Failed to parse rule conditions', { ruleId: rule.id, error: e.message });
        continue;
      }

      if (!conditions || !Array.isArray(conditions)) continue;

      // All conditions must match (AND logic)
      const allMatch = conditions.every(condition => {
        const { field, operator, value } = condition;
        const itemValue = itemData[field];
        const ruleValues = value.split(',').map(v => v.trim().toLowerCase());

        if (itemValue === null || itemValue === undefined) return false;

        // Handle array fields (genre, keyword)
        if (Array.isArray(itemValue)) {
          switch (operator) {
            case 'includes':
              return ruleValues.some(v => itemValue.includes(v));
            case 'excludes':
              return !ruleValues.some(v => itemValue.includes(v));
            case 'contains':
              return ruleValues.some(v => itemValue.some(item => item.includes(v)));
            default:
              return false;
          }
        }

        // Handle string fields (rating, language, title, overview, content_type)
        const strValue = String(itemValue).toLowerCase();
        switch (operator) {
          case 'equals':
          case 'is':
            return ruleValues.includes(strValue);
          case 'includes':
            return ruleValues.includes(strValue);
          case 'excludes':
            return !ruleValues.includes(strValue);
          case 'contains':
            return ruleValues.some(v => strValue.includes(v));
          case 'not_contains':
            return !ruleValues.some(v => strValue.includes(v));
          case 'greater_than':
            return parseFloat(itemValue) > parseFloat(ruleValues[0]);
          case 'less_than':
            return parseFloat(itemValue) < parseFloat(ruleValues[0]);
          case 'between':
            // value format: "1990,1999" or value + value2
            const yearVal = parseFloat(itemValue);
            const [minYear, maxYear] = ruleValues[0].includes(',')
              ? ruleValues[0].split(',').map(v => parseFloat(v.trim()))
              : [parseFloat(ruleValues[0]), parseFloat(ruleValues[1] || ruleValues[0])];
            return yearVal >= minYear && yearVal <= maxYear;
          default:
            return false;
        }
      });

      if (allMatch) {
        const library = libraries.find(l => l.id === rule.library_id);
        if (library) {
          const conditionsSummary = conditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(' AND ');
          return {
            library,
            isException: false,
            matchedRule: conditionsSummary,
            reason: rule.description || `Matched rule: ${rule.name}`
          };
        }
      }
    }

    return null;
  }

  mightBeAnime(metadata) {
    // Check if metadata suggests anime
    const keywords = (metadata.keywords || []).map(k => k.toLowerCase());
    const genres = (metadata.genres || []).map(g => g.toLowerCase());

    return (
      keywords.includes('anime') ||
      metadata.original_language === 'ja' ||
      genres.includes('anime') ||
      keywords.some(k => ['shounen', 'shoujo', 'seinen', 'isekai', 'mecha'].includes(k))
    );
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

    // Step 2: Check learned patterns (high confidence)
    const learnedPattern = await this.checkLearnedPatterns(metadata);
    if (learnedPattern && learnedPattern.confidence >= 80) {
      return {
        library: libraries.find(l => l.id === learnedPattern.library_id),
        confidence: learnedPattern.confidence,
        method: 'learned_pattern',
        reason: 'Matched learned pattern from previous corrections',
        libraries: libraries,
      };
    }

    // NOTE: Legacy rule-based matching (Step 3) removed in v0.37.8c.
    // PolicyEngine now handles all rule-based classification via content presets.

    // Step 3: Policy Engine evaluation (v0.37.0)
    // Modern policy-based classification with comprehensive signal scoring
    let policyResult = null;
    let policySignalContext = null;

    const buildPolicySignalContext = (result, candidates, rankedList) => {
      const ranked = Array.isArray(rankedList) ? rankedList : [];
      const top = ranked[0] || null;
      const suggestedLibrary = top ? candidates.find(l => l.id === top.library_id) : null;
      const breakdown = top?.breakdown?.length ? top.breakdown : (top ? [
        { type: 'preset', score: top.scores?.preset || 0, weight: top.weights?.preset || 0 },
        { type: 'profile', score: top.scores?.profile || 0, weight: top.weights?.profile || 0 },
        { type: 'pattern', score: top.scores?.pattern || 0, weight: top.weights?.pattern || 0 },
        { type: 'rag', score: top.scores?.rag || 0, weight: top.weights?.rag || 0 },
        { type: 'history', score: top.scores?.history || 0, weight: top.weights?.history || 0 },
      ] : []);
      const hasConflict = ranked.length > 1 && top?.score != null && ranked[1]?.score != null
        ? Math.abs(top.score - ranked[1].score) <= 10
        : false;

      return {
        confidence: result?.confidence || 0,
        suggestedLibrary,
        breakdown,
        ranked,
        scores: top?.scores || null,
        weights: top?.weights || null,
        hasConflict
      };
    };

    try {
      if (taskId && !metadata.source_library_id) {
        await classificationPhaseService.updatePhase(taskId, 'policy_eval');
      }

      logger.info('Evaluating with PolicyEngine', { title: metadata.title });
      policyResult = await policyEngine.evaluateItem(metadata);

      if (policyResult?.action === 'auto_classify' && policyResult.library) {
        // HIGH CONFIDENCE - Skip AI entirely, trust PolicyEngine
        logger.info('PolicyEngine auto-classified (AI skipped)', {
          title: metadata.title,
          library: policyResult.library.library_name,
          confidence: policyResult.confidence
        });
        const matchedLibrary = libraries.find(l => l.id === policyResult.library.library_id);
        if (!matchedLibrary) {
          logger.error('PolicyEngine returned library that was not found in libraries list', {
            policyLibraryId: policyResult.library.library_id,
          });
          throw new Error('PolicyEngine selected unknown library');
        }
        return {
          library: matchedLibrary,
          confidence: policyResult.confidence,
          method: 'policy_auto',
          reason: `Policy: ${policyResult.library.policy_name}`,
          libraries: libraries,
          policyResult: policyResult, // Include for logging/debugging
        };
      }

      if (policyResult?.ranked && policyResult.ranked.length > 0) {
        metadata.policyResult = policyResult;
        policySignalContext = buildPolicySignalContext(policyResult, libraries, policyResult.ranked);
      }
    } catch (policyError) {
      logger.warn('PolicyEngine evaluation failed, falling back to legacy signals', {
        error: policyError.message,
        title: metadata.title
      });
    }

    // Use PolicyEngine signals for AI analysis when available
    if (policySignalContext) {
      let ragContext = null;
      const ragCache = policyResult?.ragCache || null;
      const ragMatches = ragCache?.matches || [];
      if (ragCache && taskId && !metadata.source_library_id) {
        await classificationPhaseService.updatePhase(taskId, 'rag_analysis');
      }
      if (ragMatches.length > 0) {
        ragContext = {
          similarItems: ragMatches.slice(0, 3),
          suggestion: ragRetriever.getSuggestedLibrary(ragMatches)
        };
      }

      if (taskId && !metadata.source_library_id) {
        await classificationPhaseService.updatePhase(taskId, 'ai_analysis');
      }

      try {
        const aiMatch = await this.aiClassify(metadata, libraries, policySignalContext, {
          mode: 'classify',
          ragContext
        });
        const aiResult = {
          ...aiMatch,
          method: aiMatch.verified_by_ai ? 'ai_verified' : 'ai_analysis',
          libraries: libraries,
          signalContext: policySignalContext,
          policyResult: policyResult,
          ragContext
        };

        if (taskId && !metadata.source_library_id) {
          await classificationPhaseService.updatePhase(taskId, 'decision', {
            confidence: aiResult.confidence
          });
        }

        let finalResult = await this.evaluateRagLoopSecondPass({
          metadata,
          libraries,
          baselineResult: aiResult,
          policyResult,
          signalContext: policySignalContext,
          ragContext
        });
        const effectiveRagContext = finalResult.ragContext || ragContext;

        // Ensure low-confidence results surface policy-driven clarifications
        if (!finalResult.needs_clarification && finalResult.confidence < 70) {
          const policyQuestion = await policyQuestionBuilder.build({
            metadata,
            policyResult: policyResult || null,
            libraries,
            suggestedLibrary: finalResult.library || null,
            ragContext: effectiveRagContext,
            aiResult: finalResult
          });

          if (policyQuestion) {
            finalResult.needs_clarification = true;
            finalResult.clarification = policyQuestion;
            finalResult.policy_question = policyQuestion;
            finalResult.pending_reason = policyQuestion.problem_summary;
          }
        }

        return finalResult;
      } catch (error) {
        logger.error('AI classification failed', { error: error.message });

        const fallbackConfidence = policySignalContext.confidence || 0;
        const suggestedLibrary = policySignalContext.suggestedLibrary;
        const isTransientAiAvailability = this.isAiTransientAvailabilityError(error);

        if (isTransientAiAvailability || fallbackConfidence < 50) {
          logger.info('AI unavailable/busy - queuing for retry', {
            confidence: fallbackConfidence,
            tmdbId: metadata.tmdb_id,
            title: metadata.title,
            transient_ai_availability: isTransientAiAvailability
          });

          return this.buildPendingRetryResult({
            confidence: fallbackConfidence,
            libraries: libraries,
            signalContext: policySignalContext
          });
        }

        if (suggestedLibrary && fallbackConfidence >= 50) {
          return {
            library: suggestedLibrary,
            confidence: fallbackConfidence,
            method: 'signal_calculation',
            reason: 'Calculated from policy signals (AI unavailable)',
            libraries: libraries,
            policyResult
          };
        }

        const fallbackLibrary = libraries[libraries.length - 1];
        return {
          library: fallbackLibrary,
          confidence: 50,
          method: 'fallback',
          reason: `Default library - AI unavailable (fell back to ${fallbackLibrary.name})`,
          libraries: libraries,
        };
      }
    }

    // Step 4: Collect signals and calculate confidence for AI verification (legacy fallback)
    const signalCollector = new SignalCollector();

    const detectors = {
      checkLearnedCorrections: this.checkLearnedCorrections.bind(this),
      checkLibraryRules: this.checkLibraryRules.bind(this),
      findExistingMedia: mediaSyncService.findExistingMedia.bind(mediaSyncService),
      analyzeContent: contentTypeAnalyzer.analyze.bind(contentTypeAnalyzer),
      checkExactMatch: this.checkExactMatch.bind(this),
      checkLearnedPatterns: this.checkLearnedPatterns.bind(this),
      matchRules: this.matchRules.bind(this),
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
          const ragLibrary = libraries.find(l => l.id === suggestedLibrary.libraryId);
          if (ragLibrary) {
            if (!signalCollector.hasSignal(SIGNAL_TYPES.SEMANTIC_SIMILARITY)) {
              signalCollector.addSignal(
                SIGNAL_TYPES.SEMANTIC_SIMILARITY,
                {
                  similarItems: similarItems.slice(0, 3),
                  avgSimilarity: suggestedLibrary.avgSimilarity,
                  voteCount: suggestedLibrary.voteCount
                },
                dynamicWeight,
                ragLibrary
              );
            }
            ragContext = {
              similarItems: similarItems.slice(0, 3),
              suggestion: ragRetriever.getSuggestedLibrary(similarItems)
            };
            logger.info('RAG signal added', {
              title: metadata.title,
              library: ragLibrary.name,
              weight: dynamicWeight,
              matches: similarItems.length
            });
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
    };

    try {
      const aiMatch = await this.aiClassify(metadata, libraries, signalContext);
      const aiResult = {
        ...aiMatch,
        method: aiMatch.verified_by_ai ? 'ai_verified' : 'ai_analysis',
        libraries: libraries,
        signalContext: signalContext,
        policyResult: policyResult || null,
      };

      if (taskId && !metadata.source_library_id) {
        await classificationPhaseService.updatePhase(taskId, 'decision', {
          confidence: aiResult.confidence
        });
      }

      let finalResult = await this.evaluateRagLoopSecondPass({
        metadata,
        libraries,
        baselineResult: aiResult,
        policyResult: policyResult || null,
        signalContext,
        ragContext
      });
      const effectiveRagContext = finalResult.ragContext || ragContext;

      if (!finalResult.needs_clarification && finalResult.confidence < 70) {
        const policyQuestion = await policyQuestionBuilder.build({
          metadata,
          policyResult: metadata.policyResult || null,
          libraries,
          suggestedLibrary: finalResult.library || null,
          ragContext: effectiveRagContext,
          aiResult: finalResult
        });

        if (policyQuestion) {
          finalResult.needs_clarification = true;
          finalResult.clarification = policyQuestion;
          finalResult.policy_question = policyQuestion;
          finalResult.pending_reason = policyQuestion.problem_summary;
        }
      }

      return finalResult;
    } catch (error) {
      logger.error('AI classification failed', { error: error.message });
      const isTransientAiAvailability = this.isAiTransientAvailabilityError(error);

      if (isTransientAiAvailability || confidenceResult.confidence < 50) {
        logger.info('AI unavailable/busy - queuing for retry', {
          confidence: confidenceResult.confidence,
          tmdbId: metadata.tmdb_id,
          title: metadata.title,
          transient_ai_availability: isTransientAiAvailability
        });

        return this.buildPendingRetryResult({
          confidence: confidenceResult.confidence,
          libraries: libraries,
          signalContext
        });
      }

      if (confidenceResult.suggestedLibrary && confidenceResult.confidence >= 50) {
        return {
          library: confidenceResult.suggestedLibrary,
          confidence: confidenceResult.confidence,
          method: 'signal_calculation',
          reason: `Calculated from signals (AI unavailable)`,
          libraries: libraries,
        };
      }

      const fallbackLibrary = libraries[libraries.length - 1];
      return {
        library: fallbackLibrary,
        confidence: 50,
        method: 'fallback',
        reason: `Default library - AI unavailable (fell back to ${fallbackLibrary.name})`,
        libraries: libraries,
      };
    }
  }

  async checkExactMatch(tmdbId, mediaType = null) {
    const params = [tmdbId];
    let where = `tmdb_id = $1 AND pattern_type = 'exact_match'`;

    if (mediaType) {
      params.push(mediaType);
      where += ` AND media_type = $2`;
    }

    const result = await db.query(
      `SELECT library_id FROM learning_patterns 
       WHERE ${where}
       ORDER BY updated_at DESC LIMIT 1`,
      params
    );
    return result.rows[0] || null;
  }

  async checkLearnedPatterns(metadata) {
    // Check for similar patterns based on genres, keywords, etc.
    // This is a simplified version - could be enhanced with more sophisticated ML
    const result = await db.query(
      `SELECT library_id, confidence FROM learning_patterns 
       WHERE pattern_type = 'genre_pattern' AND success_rate >= 70
       ORDER BY confidence DESC, usage_count DESC LIMIT 1`
    );
    return result.rows[0] || null;
  }

  /**
   * Check for learned corrections from user feedback
   * This has HIGHEST PRIORITY - user corrections are "truth"
   * Returns the correction if this exact TMDB ID was previously corrected
   */
  async checkLearnedCorrections(tmdbId, mediaType) {
    if (!tmdbId) return null;

    try {
      const result = await db.query(
        `SELECT corrected_library_id, corrected_by, title, created_at, user_note
         FROM learned_corrections 
         WHERE tmdb_id = $1 AND media_type = $2
         ORDER BY created_at DESC LIMIT 1`,
        [tmdbId, mediaType]
      );

      if (result.rows.length > 0) {
        logger.info('Found learned correction', {
          tmdbId,
          mediaType,
          correctedLibraryId: result.rows[0].corrected_library_id
        });
      }

      return result.rows[0] || null;
    } catch (error) {
      // Table might not exist yet in older installations
      logger.warn('Failed to check learned corrections', { error: error.message });
      return null;
    }
  }

  async matchRules(metadata, libraries) {
    let bestMatch = null;
    let highestScore = 0;

    for (const library of libraries) {
      let score = 0;
      let reasons = [];

      // Get library labels
      const labelsResult = await db.query(
        `SELECT ll.rule_type, lp.category, lp.name, lp.display_name, lp.tmdb_match_field, lp.tmdb_match_values
         FROM library_labels ll
         JOIN label_presets lp ON ll.label_preset_id = lp.id
         WHERE ll.library_id = $1`,
        [library.id]
      );

      const labels = labelsResult.rows;

      // Check EXCLUDE labels first (disqualifying)
      const excludeLabels = labels.filter(l => l.rule_type === 'exclude');
      for (const label of excludeLabels) {
        if (this.metadataMatchesLabel(metadata, label)) {
          score = -1000; // Disqualify
          break;
        }
      }

      if (score < 0) continue; // Skip this library

      // Check INCLUDE labels (scoring)
      const includeLabels = labels.filter(l => l.rule_type === 'include');
      for (const label of includeLabels) {
        if (this.metadataMatchesLabel(metadata, label)) {
          score += 25;
          reasons.push(`Matches ${label.category}: ${label.display_name}`);
        }
      }

      // Check custom rules
      const rulesResult = await db.query(
        'SELECT * FROM library_custom_rules WHERE library_id = $1 AND is_active = true',
        [library.id]
      );

      for (const rule of rulesResult.rows) {
        if (this.evaluateCustomRule(metadata, rule.rule_json)) {
          score += 30;
          reasons.push(`Matches custom rule: ${rule.name}`);
        }
      }

      // Calculate confidence based on score
      const confidence = Math.min(100, score);

      if (confidence > highestScore) {
        highestScore = confidence;
        bestMatch = {
          library: library,
          confidence: confidence,
          reason: reasons.join('; ') || 'Matched library criteria',
        };
      }
    }

    return bestMatch;
  }

  metadataMatchesLabel(metadata, label) {
    const { tmdb_match_field, tmdb_match_values } = label;

    // If no match field/values defined, cannot match
    if (!tmdb_match_field || !tmdb_match_values || tmdb_match_values.length === 0) {
      return false;
    }

    switch (tmdb_match_field) {
      case 'certification':
        // Check if metadata certification matches any of the values
        return tmdb_match_values.some(value =>
          metadata.certification && metadata.certification.toLowerCase() === value.toLowerCase()
        );

      case 'genres':
        // Check if any metadata genre matches any of the label values
        if (!metadata.genres || !Array.isArray(metadata.genres)) {
          return false;
        }
        return tmdb_match_values.some(value =>
          metadata.genres.some(g => g.toLowerCase() === value.toLowerCase())
        );

      case 'keywords':
        // Check if any metadata keyword matches any of the label values
        if (!metadata.keywords || !Array.isArray(metadata.keywords)) {
          return false;
        }
        const keywords = metadata.keywords.map(k => k.toLowerCase());
        return tmdb_match_values.some(value =>
          keywords.includes(value.toLowerCase())
        );

      case 'original_language':
        // Check if metadata original_language matches any of the values
        return tmdb_match_values.some(value =>
          metadata.original_language && metadata.original_language.toLowerCase() === value.toLowerCase()
        );

      default:
        return false;
    }
  }

  evaluateCustomRule(metadata, ruleJson) {
    try {
      // Handle array of conditions (AND logic)
      if (Array.isArray(ruleJson)) {
        return ruleJson.every(condition => this.evaluateSingleCondition(metadata, condition));
      }
      // Handle legacy single object
      return this.evaluateSingleCondition(metadata, ruleJson);
    } catch (error) {
      logger.error('Error evaluating custom rule', { error: error.message });
      return false;
    }
  }

  evaluateSingleCondition(metadata, condition) {
    const { field, operator, value } = condition;

    // Handle nested fields (e.g., metadata.content_analysis.type)
    let fieldValue;
    if (field === 'content_type') {
      fieldValue = metadata.contentAnalysis?.bestMatch?.type;
    } else {
      fieldValue = metadata[field];
    }

    if (!fieldValue) return false;

    switch (operator) {
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(v =>
            v.toLowerCase().includes(value.toLowerCase())
          );
        }
        return String(fieldValue).toLowerCase().includes(value.toLowerCase());
      case 'not_contains':
        if (Array.isArray(fieldValue)) {
          return !fieldValue.some(v =>
            v.toLowerCase().includes(value.toLowerCase())
          );
        }
        return !String(fieldValue).toLowerCase().includes(value.toLowerCase());
      case 'equals':
        return String(fieldValue).toLowerCase() === String(value).toLowerCase();
      case 'not_equals':
        return String(fieldValue).toLowerCase() !== String(value).toLowerCase();
      case 'greater_than':
        return parseFloat(fieldValue) > parseFloat(value);
      case 'less_than':
        return parseFloat(fieldValue) < parseFloat(value);
      case 'between':
        // value format: "1990,1999"
        const yearVal = parseFloat(fieldValue);
        const [minYear, maxYear] = value.split(',').map(v => parseFloat(v.trim()));
        return yearVal >= minYear && yearVal <= maxYear;
      default:
        return false;
    }
  }

  async aiClassify(metadata, libraries, signalContext = null, options = {}) {
    // Try to get web search results if Tavily is enabled
    const webSearchResults = await this.enrichWithWebSearch(metadata);

    // Helper function to find a sensible default library
    const getDefaultLibrary = (libraries, mediaType) => {
      // Look for a general-purpose library matching the media type
      const generalNames = mediaType === 'movie'
        ? ['movies', 'films', 'general movies']
        : ['tv shows', 'tv series', 'series', 'television'];

      const generalLib = libraries.find(l =>
        generalNames.some(name => l.name.toLowerCase().includes(name))
      );

      // Fall back to lowest priority library (most general) instead of highest
      return generalLib || libraries[libraries.length - 1];
    };

    // Build context for AI prompt builder
    const promptContext = {
      metadata: metadata,
      libraries: libraries,
      signalContext: signalContext,
      policySignals: options.policySignals || signalContext,
      ragContext: options.ragContext || null,
    };

    // Add library profile if we have a suggested library
    if (signalContext && signalContext.suggestedLibrary) {
      try {
        const profileStats = await libraryProfileService.getProfileStats(signalContext.suggestedLibrary.id);
        if (profileStats.totalItems > 0) {
          promptContext.libraryProfile = profileStats;
        }
      } catch (error) {
        logger.warn('Failed to load library profile for AI prompt', {
          libraryId: signalContext.suggestedLibrary.id,
          error: error.message
        });
      }
    }

    // Determine mode: verify if we have signalContext, otherwise classify
    const mode = options.mode || (signalContext ? 'verify' : 'classify');

    // Build prompt using modular AI prompt builder
    let prompt = `You are a media classification ${mode === 'verify' ? 'VERIFIER' : 'AI'} for a home media server. ${mode === 'verify' ? 'Your role is to VERIFY a pre-calculated classification decision.' : 'Your role is to classify media items into the appropriate library.'}

${mode === 'verify' ? `CRITICAL RULES:
1. You CANNOT override the calculated confidence score.
2. Your job is to VERIFY the suggested library makes sense, OR request clarification if there are conflicts.
3. If the calculated confidence is high and signals align, CONFIRM the decision.
4. If signals conflict or you see a potential error, REQUEST CLARIFICATION.
` : ''}`;

    // Use aiPromptBuilder to compose signal sections
    const signalSections = await aiPromptBuilder.buildPrompt(promptContext, { mode });
    prompt += '\n\n' + signalSections;

    // Add web search results if available (not yet in aiPromptBuilder)
    if (webSearchResults) {
      prompt += `\n\n--- ADDITIONAL WEB RESEARCH ---`;

      if (webSearchResults.imdb) {
        prompt += `\n${tavilyService.formatForAI(webSearchResults.imdb)}`;
      }

      if (webSearchResults.advisory) {
        prompt += `\n\nContent Advisory: ${tavilyService.formatForAI(webSearchResults.advisory)}`;
      }

      if (webSearchResults.anime) {
        prompt += `\n\nAnime Database: ${tavilyService.formatForAI(webSearchResults.anime)}`;
      }
    }

    // Add critical guidance
    prompt += `\n\nIMPORTANT FOR CLARIFICATION:
- The problem_summary should be SHORT (max 50 chars)
- The why_uncertain should explain WHAT DATA conflicts and WHY you can't decide
- The question should be SPECIFIC and help the user understand what choosing each option means
- Always provide 2-3 clear options (not just yes/no when possible)

CRITICAL - DO NOT HALLUCINATE CONFLICTS:
- Only mention libraries that have ACTUAL signal support (genres, keywords, patterns matching that library)
- Certification (G, PG, TV-PG, R, TV-MA, etc.) is a CONTENT RATING for age-appropriateness, NOT a library indicator - do not use it to suggest which library content belongs to
- DO NOT suggest "Family" library for R-rated Horror/Thriller content with no family-related signals
- If signals clearly point to one library with no real conflict, use CONFIRM format, not CLARIFY
- Only use CLARIFY when there are genuinely conflicting signals pointing to different libraries

Think step by step, then respond with ONLY one of the formats above.`;

    // Get Ollama config from ai_provider_config
    const configResult = await db.query('SELECT ollama_model, temperature FROM ai_provider_config WHERE id = 1');
    const config = configResult.rows[0]
      ? { model: configResult.rows[0].ollama_model || 'llama3.2', temperature: configResult.rows[0].temperature || 0.30 }
      : { model: 'llama3.2', temperature: 0.30 };

    // Acquire lock with high priority (classification always wins)
    await providerLock.acquireLock('classification', 'high');

    // Store config interval to avoid race conditions
    const heartbeatIntervalMs = providerLock.config.heartbeatInterval;
    let heartbeatTimer = null;
    let response;

    try {
      // Start heartbeat interval - in outer try block for guaranteed cleanup
      heartbeatTimer = setInterval(() => {
        providerLock.heartbeat('classification');
      }, heartbeatIntervalMs);

      // Track generation status for UI
      const itemTitle = metadata.title || 'Unknown';
      ollamaService.setGenerationStatus(true, config.model, itemTitle);

      try {
        // Use streaming to monitor progress
        let lastLogTime = Date.now();
        response = await ollamaService.generateWithProgress(
          prompt,
          config.model,
          parseFloat(config.temperature),
          (tokenCount, isComplete) => {
            // Update token count for UI
            ollamaService.updateTokenCount(tokenCount);

            // Log progress every 2 seconds or on completion
            const now = Date.now();
            if (isComplete || now - lastLogTime > 2000) {
              logger.debug('Ollama generation progress', {
                tokens: tokenCount,
                complete: isComplete,
                model: config.model
              });
              lastLogTime = now;
            }
          }
        );
      } finally {
        // Clear generation status (inner finally for UI cleanup)
        ollamaService.setGenerationStatus(false);
      }
    } finally {
      // Clean up heartbeat and release lock (outer finally - always executes)
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      providerLock.releaseLock('classification');
    }

    // Use aiResponseParser to parse AI response in modular, testable way
    const parseContext = {
      libraries: libraries,
      signalContext: signalContext,
      metadata: metadata
    };

    return aiResponseParser.parse(response, parseContext, { mode });
  }

  async logClassification(metadata, result, startTime = null) {
    // Extract collection_id from metadata if available
    const collectionId = metadata.collectionId || null;
    const signalsJson = result.signals ? JSON.stringify(result.signals) :
      result.signalContext?.signals ? JSON.stringify(result.signalContext.signals) : null;

    // For pending items (needs clarification)
    const pendingReason = result.pending_reason || (result.needs_clarification ? result.reason : null);
    const policyQuestion = this.normalizePolicyQuestion(result.policy_question);

    // Handle retry status
    let status;
    if (result.needs_retry) {
      status = 'pending_retry';
    } else {
      // Determine status: awaiting_decision if needs clarification, fallback method, or low confidence
      status = (
        result.needs_clarification ||
        result.method === 'fallback' ||
        (result.confidence && result.confidence < 70)
      ) ? 'awaiting_decision' : 'completed';
    }

    // Only set library when classification is complete
    // When awaiting_decision or pending_retry, library_id and library_name should be NULL to prevent premature assignment
    const isAwaitingDecision = status === 'awaiting_decision' || status === 'pending_retry';
    const libraryId = isAwaitingDecision ? null : (result.library?.id || null);
    const libraryName = isAwaitingDecision ? null : (result.library?.name || null);

    const ragContext = result.ragContext || result.signalContext?.ragContext || null;
    const ragTopMatch = ragContext?.similarItems?.[0] || null;
    const ragDetails = ragTopMatch ? {
      combined_similarity: ragTopMatch.similarity ?? null,
      text_similarity: ragTopMatch.textSimilarity ?? null,
      image_similarity: ragTopMatch.imageSimilarity ?? null,
      text_weight: ragTopMatch.textWeight ?? null,
      image_weight: ragTopMatch.imageWeight ?? null
    } : null;

    // Build classification_details for metadata
    const classificationDetails = {
      policy_name: result.policyResult?.library?.policy_name || null,
      scores: result.policyResult?.scores || { preset: 0, profile: 0, pattern: 0, rag: 0, history: 0 },
      weights: result.policyResult?.weights || { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 },
      rag_details: ragDetails,
      rag_loop_trace: result.ragLoopTrace || null,
      processing_time_ms: startTime ? Date.now() - startTime : null
    };

    // Add classification_details to metadata
    const enrichedMetadata = {
      ...metadata,
      classification_details: classificationDetails
    };

    // Get library profile snapshot for completed classifications
    let profileSnapshot = null;
    if (libraryId && status === 'completed') {
      try {
        const libraryProfileService = require('./libraryProfileService');
        const profileStats = await libraryProfileService.getProfileStats(libraryId);
        profileSnapshot = JSON.stringify(profileStats);
      } catch (error) {
        logger.warn('Failed to get profile snapshot for classification', {
          libraryId,
          error: error.message
        });
      }
    }

    const insertResult = await db.query(
      `INSERT INTO classification_history 
       (tmdb_id, media_type, title, year, library_id, library_name, confidence, method, reason, metadata, status, collection_id, signals_json, pending_reason, policy_question, profile_snapshot, retry_after, retry_count, max_retries)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING id`,
      [
        enrichedMetadata.tmdb_id,
        enrichedMetadata.media_type,
        enrichedMetadata.title,
        enrichedMetadata.year,
        libraryId,
        libraryName,
        result.confidence,
        result.method,
        result.reason,
        JSON.stringify(enrichedMetadata),
        status,
        collectionId,
        signalsJson,
        pendingReason,
        policyQuestion,
        profileSnapshot,
        result.retry_after || null,
        result.retry_count || 0,
        result.max_retries || 3
      ]
    );

    const classificationId = insertResult.rows[0].id;

    // Log policy question for pending items
    if (result.needs_clarification) {
      logger.info('Classification pending - awaiting clarification', {
        id: classificationId,
        title: enrichedMetadata.title,
        reason: pendingReason
      });
    }

    // Create in-app notification for items awaiting decision
    if (status === 'awaiting_decision') {
      await createAwaitingDecisionNotification(
        classificationId,
        enrichedMetadata.title,
        pendingReason || result.reason,
        enrichedMetadata.media_type
      );
    }

    // Log content analysis if available
    if (enrichedMetadata.contentAnalysis && enrichedMetadata.contentAnalysis.bestMatch) {
      await contentTypeAnalyzer.analyze(enrichedMetadata, classificationId);
    }

    // Generate embedding for RAG (real-time mode if enabled)
    if (status === 'completed' && result.library) {
      // Check if real-time embedding is enabled
      const realtimeEnabled = await this.isRealtimeEmbeddingEnabled();

      if (realtimeEnabled) {
        // Generate immediately (critical path)
        try {
          await embeddingService.generateAndStore(classificationId, {
            ...enrichedMetadata,
            library_name: libraryName
          });
        } catch (embedError) {
          logger.error('[Embedding] Real-time generation failed, will retry in backfill', {
            id: classificationId,
            error: embedError.message
          });
        }
      } else {
        // Queue for backfill (async, don't wait)
        setImmediate(async () => {
          try {
            await embeddingService.generateAndStore(classificationId, {
              ...enrichedMetadata,
              library_name: libraryName
            });
          } catch (embedError) {
            logger.debug('Embedding generation deferred', { id: classificationId });
          }
        });
      }
    }

    return classificationId;
  }

  async persistRagLoopStageEvents({ classificationId, metadata = {}, result = {} } = {}) {
    try {
      const logContext = result?.ragLoopLogContext || null;
      const events = Array.isArray(logContext?.events)
        ? logContext.events
        : (Array.isArray(result?.ragLoopTrace?.events) ? result.ragLoopTrace.events : []);

      if (!Array.isArray(events) || events.length === 0) {
        return;
      }

      const rolloutMode = logContext?.mode || result?.ragLoopTrace?.mode || null;
      const strategy = logContext?.strategy || result?.ragLoopTrace?.strategy || null;
      const trigger = logContext?.trigger || result?.ragLoopTrace?.trigger || null;
      const correlationId = logContext?.correlationId || null;

      for (const rawEvent of events) {
        if (!rawEvent || typeof rawEvent !== 'object') {
          continue;
        }

        const sourceStage = typeof rawEvent.stage === 'string' ? rawEvent.stage : null;
        const stage = (sourceStage === 'strategy' || sourceStage === 'retrieval_pass1')
          ? 'gate'
          : sourceStage;
        const mappedError = mapSecondPassError({
          stage,
          reasonCode: rawEvent.reason_code || rawEvent.reason || null,
          fallbackReasonCode: rawEvent.reason || null,
          error: { code: rawEvent.sql_state || rawEvent.sqlState || null }
        });

        await ragLogger.logStageEvent({
          classification_id: classificationId,
          tmdb_id: metadata.tmdb_id || null,
          media_type: metadata.media_type || null,
          stage,
          outcome: rawEvent.outcome || null,
          reason_code: rawEvent.reason_code || rawEvent.reason || mappedError.reasonCode,
          fallback_action: rawEvent.fallback_action || rawEvent.fallbackAction || null,
          recoverable: rawEvent.recoverable === false ? false : mappedError.recoverable,
          sql_state: rawEvent.sql_state || rawEvent.sqlState || mappedError.sqlState || null,
          correlation_id: correlationId,
          rollout_mode: rolloutMode,
          strategy,
          trigger,
          metadata: {
            tmdb_id: metadata.tmdb_id || null,
            media_type: metadata.media_type || null,
            title: metadata.title || null,
            source_stage: sourceStage
          }
        });
      }
    } catch (error) {
      logger.warn('Failed to persist rag loop stage logs', {
        classificationId,
        error: error.message
      });
    }
  }

  async routeToArr(metadata, library) {
    try {
      const resolvedLibrary = await this.resolveRoutingConfig(library);

      if (!resolvedLibrary || !resolvedLibrary.arr_type) {
        logger.warn('No *arr mapping available for routing', {
          title: metadata.title,
          libraryId: library?.id || library?.library_id || null
        });
        return;
      }

      if (!resolvedLibrary.arr_id) {
        logger.warn('Missing *arr config ID; routing skipped', {
          title: metadata.title,
          libraryId: resolvedLibrary.id || resolvedLibrary.library_id || null,
          arr_type: resolvedLibrary.arr_type
        });
        return;
      }

      if (resolvedLibrary.arr_type === 'radarr') {
        const radarrConfig = await db.query(
          'SELECT * FROM radarr_config WHERE id = $1 AND is_active = true',
          [resolvedLibrary.arr_id]
        );

        if (radarrConfig.rows.length > 0) {
          const config = radarrConfig.rows[0];
          const baseUrl = config.url || radarrService.buildUrl(config);

          // Use JSONB settings with fallback to legacy fields
          const rawSettings = this.normalizeSettings(resolvedLibrary.radarr_settings);
          const settings = Object.keys(rawSettings).length > 0
            ? rawSettings
            : {
              root_folder_path: resolvedLibrary.root_folder,
              quality_profile_id: resolvedLibrary.quality_profile_id,
              monitor: true,
              search_on_add: true
            };

          if (!settings.root_folder_path) {
            settings.root_folder_path = await this.resolveDefaultRootFolder('radarr', baseUrl, config.api_key);
          }
          settings.quality_profile_id = this.normalizeQualityProfileId(settings.quality_profile_id);
          if (!settings.quality_profile_id) {
            settings.quality_profile_id = this.normalizeQualityProfileId(config.quality_profile_id);
          }
          if (!settings.quality_profile_id) {
            settings.quality_profile_id = await this.resolveDefaultQualityProfile('radarr', baseUrl, config.api_key);
          }

          if (!settings.root_folder_path || !settings.quality_profile_id) {
            logger.warn('Missing Radarr routing settings; skipping route', {
              title: metadata.title,
              root_folder_path: settings.root_folder_path || null,
              quality_profile_id: settings.quality_profile_id || null
            });
            return;
          }

          const movieData = {
            title: metadata.title,
            tmdbId: metadata.tmdb_id,
            year: parseInt(metadata.year),
            qualityProfileId: settings.quality_profile_id,
            rootFolderPath: settings.root_folder_path,
            monitored: settings.monitor !== false,
            minimumAvailability: settings.minimum_availability || 'released',
            tags: settings.tags || [],
            addOptions: {
              searchForMovie: settings.search_on_add !== false,
            },
          };

          await radarrService.addMovie(baseUrl, config.api_key, movieData);
          logger.info(`Added movie to Radarr: ${metadata.title}`);
        }
      } else if (resolvedLibrary.arr_type === 'sonarr') {
        const sonarrConfig = await db.query(
          'SELECT * FROM sonarr_config WHERE id = $1 AND is_active = true',
          [resolvedLibrary.arr_id]
        );

        if (sonarrConfig.rows.length > 0) {
          const config = sonarrConfig.rows[0];
          const baseUrl = config.url || sonarrService.buildUrl(config);

          // Use JSONB settings with fallback to legacy fields
          const rawSettings = this.normalizeSettings(resolvedLibrary.sonarr_settings);
          const settings = Object.keys(rawSettings).length > 0
            ? rawSettings
            : {
              root_folder_path: resolvedLibrary.root_folder,
              quality_profile_id: resolvedLibrary.quality_profile_id,
              series_type: 'standard',
              season_monitoring: 'all',
              monitor_new_items: 'all',
              season_folder: true,
              search_on_add: true
            };

          if (!settings.root_folder_path) {
            settings.root_folder_path = await this.resolveDefaultRootFolder('sonarr', baseUrl, config.api_key);
          }
          settings.quality_profile_id = this.normalizeQualityProfileId(settings.quality_profile_id);
          if (!settings.quality_profile_id) {
            settings.quality_profile_id = this.normalizeQualityProfileId(config.quality_profile_id);
          }
          if (!settings.quality_profile_id) {
            settings.quality_profile_id = await this.resolveDefaultQualityProfile('sonarr', baseUrl, config.api_key);
          }

          if (!settings.root_folder_path || !settings.quality_profile_id) {
            logger.warn('Missing Sonarr routing settings; skipping route', {
              title: metadata.title,
              root_folder_path: settings.root_folder_path || null,
              quality_profile_id: settings.quality_profile_id || null
            });
            return;
          }

          let tvdbId = metadata.tvdb_id;
          if (!tvdbId && metadata.tmdb_id) {
            const externalIds = await tmdbService.getExternalIds(metadata.tmdb_id, 'tv');
            tvdbId = externalIds?.tvdb_id || externalIds?.tvdbId || null;
          }

          if (!tvdbId) {
            logger.warn('Missing TVDB ID; skipping Sonarr routing', {
              title: metadata.title,
              tmdbId: metadata.tmdb_id
            });
            return;
          }

          const lookupResults = await sonarrService.searchSeries(baseUrl, config.api_key, tvdbId);
          const lookupSeries = lookupResults.find(s => s.tvdbId === parseInt(tvdbId, 10)) || lookupResults[0];
          if (!lookupSeries) {
            logger.warn('Sonarr lookup returned no series', {
              title: metadata.title,
              tvdbId
            });
            return;
          }
          if (!lookupSeries.title || !lookupSeries.title.toString().trim()) {
            logger.warn('Sonarr lookup missing English title; skipping add', {
              title: metadata.title,
              tvdbId
            });
            return;
          }

          const normalizeMonitor = (value) => {
            if (!value) return 'all';
            const key = value.toString();
            const map = {
              all_seasons: 'all',
              all: 'all',
              future: 'future',
              missing: 'missing',
              existing: 'existing',
              recent: 'recent',
              pilot: 'pilot',
              first: 'firstSeason',
              firstSeason: 'firstSeason',
              lastSeason: 'latestSeason',
              latest: 'latestSeason',
              latestSeason: 'latestSeason',
              none: 'none'
            };
            return map[key] || key;
          };

          const requestedSeasons = Array.isArray(metadata.requested_seasons)
            ? metadata.requested_seasons
                .map(season => (typeof season === 'string' ? parseInt(season, 10) : season))
                .filter(season => Number.isInteger(season))
            : [];
          const requestedSeasonSet = new Set(requestedSeasons);
          const includeSpecials = metadata.include_specials === true;
          const monitorValue = normalizeMonitor(settings.season_monitoring);

          const seriesData = {
            ...lookupSeries,
            qualityProfileId: settings.quality_profile_id,
            rootFolderPath: settings.root_folder_path,
            monitored: settings.monitor !== false,
            seriesType: settings.series_type || lookupSeries.seriesType || 'standard',
            seasonFolder: settings.season_folder !== false,
            tags: settings.tags || lookupSeries.tags || [],
            addOptions: {
              searchForMissingEpisodes: settings.search_on_add !== false,
              monitor: monitorValue || 'all',
            },
          };

          if (requestedSeasonSet.size > 0 && !includeSpecials) {
            requestedSeasonSet.delete(0);
          }

          if (Array.isArray(seriesData.seasons) && requestedSeasonSet.size > 0) {
            seriesData.seasons = seriesData.seasons.map(season => {
              const seasonNumber = season?.seasonNumber ?? season?.season_number ?? season?.season ?? season?.number;
              const normalizedNumber = typeof seasonNumber === 'string' ? parseInt(seasonNumber, 10) : seasonNumber;
              let monitored = season?.monitored;

              if (Number.isInteger(normalizedNumber)) {
                monitored = requestedSeasonSet.has(normalizedNumber);
              }

              return {
                ...season,
                monitored
              };
            });
          }

          delete seriesData.id;

          try {
            await sonarrService.addSeries(baseUrl, config.api_key, seriesData);
            logger.info(`Added series to Sonarr: ${metadata.title}`);
          } catch (sonarrError) {
            logger.error('Failed to add series to Sonarr', {
              title: metadata.title,
              tvdbId,
              error: sonarrError.message,
              payload: {
                qualityProfileId: seriesData.qualityProfileId,
                rootFolderPath: seriesData.rootFolderPath,
                monitored: seriesData.monitored,
                seriesType: seriesData.seriesType,
                seasonFolder: seriesData.seasonFolder,
                addOptions: seriesData.addOptions
              }
            });
            throw sonarrError;
          }
        }
      }
    } catch (error) {
      logger.error('Failed to route to arr', { error: error.message });
      // Don't throw - classification was successful even if routing failed
    }
  }

  normalizeSettings(settings) {
    if (!settings) return {};
    if (typeof settings === 'string') {
      try {
        const parsed = JSON.parse(settings);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (error) {
        return {};
      }
    }
    return settings;
  }

  normalizeQualityProfileId(value) {
    if (value === null || value === undefined) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  normalizePolicyQuestion(value) {
    if (!value) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return null;
      }
      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(parsed);
      } catch (error) {
        return null;
      }
    }
    return JSON.stringify(value);
  }

  async resolveRoutingConfig(library) {
    if (!library) return null;

    const libraryId = library.id || library.library_id || null;
    const resolved = {
      ...library,
      id: library.id || library.library_id,
      library_id: library.library_id || library.id
    };

    const needsMapping = !resolved.arr_id || !resolved.arr_type;
    if (!needsMapping || !libraryId) {
      return resolved;
    }

    const mappingResult = await db.query(
      'SELECT * FROM library_arr_mappings WHERE library_id = $1',
      [libraryId]
    );

    if (mappingResult.rows.length === 0) {
      return resolved;
    }

    const mapping = mappingResult.rows[0];

    resolved.arr_type = resolved.arr_type || mapping.arr_type;
    resolved.arr_id = resolved.arr_id || mapping.arr_config_id;
    resolved.root_folder = resolved.root_folder || mapping.arr_root_folder_path;
    resolved.quality_profile_id = resolved.quality_profile_id || mapping.quality_profile_id;

    if (mapping.arr_type === 'radarr' && this.isSettingsEmpty(resolved.radarr_settings)) {
      resolved.radarr_settings = {
        root_folder_path: mapping.arr_root_folder_path,
        quality_profile_id: mapping.quality_profile_id,
        monitor: true,
        search_on_add: true
      };
    }

    if (mapping.arr_type === 'sonarr' && this.isSettingsEmpty(resolved.sonarr_settings)) {
      resolved.sonarr_settings = {
        root_folder_path: mapping.arr_root_folder_path,
        quality_profile_id: mapping.quality_profile_id,
        series_type: 'standard',
        season_monitoring: 'all',
        season_folder: true,
        search_on_add: true
      };
    }

    return resolved;
  }

  isSettingsEmpty(settings) {
    const normalized = this.normalizeSettings(settings);
    return !normalized || Object.keys(normalized).length === 0;
  }

  async resolveDefaultQualityProfile(arrType, baseUrl, apiKey) {
    try {
      const cached = await db.query(
        `SELECT profile_id
         FROM arr_profiles_cache
         WHERE arr_type = $1 AND profile_type = 'quality_profile'
         ORDER BY last_synced DESC, profile_id ASC
         LIMIT 1`,
        [arrType]
      );
      if (cached.rows.length > 0) {
        return cached.rows[0].profile_id;
      }

      const profiles = arrType === 'radarr'
        ? await radarrService.getQualityProfiles(baseUrl, apiKey)
        : await sonarrService.getQualityProfiles(baseUrl, apiKey);
      return profiles?.[0]?.id || null;
    } catch (error) {
      logger.warn('Failed to resolve default quality profile', { arrType, error: error.message });
      return null;
    }
  }

  async resolveDefaultRootFolder(arrType, baseUrl, apiKey) {
    try {
      const cached = await db.query(
        `SELECT profile_path
         FROM arr_profiles_cache
         WHERE arr_type = $1 AND profile_type = 'root_folder'
         ORDER BY last_synced DESC, profile_id ASC
         LIMIT 1`,
        [arrType]
      );
      if (cached.rows.length > 0) {
        return cached.rows[0].profile_path;
      }

      const folders = arrType === 'radarr'
        ? await radarrService.getRootFolders(baseUrl, apiKey)
        : await sonarrService.getRootFolders(baseUrl, apiKey);
      return folders?.[0]?.path || null;
    } catch (error) {
      logger.warn('Failed to resolve default root folder', { arrType, error: error.message });
      return null;
    }
  }

  /**
   * Retry classification for an item that failed due to AI unavailability
   * @param {number} classificationId - ID of the classification_history entry to retry
   */
  async retryClassification(classificationId) {
    try {
      // Get the classification entry
      const result = await db.query(
        `SELECT * FROM classification_history WHERE id = $1`,
        [classificationId]
      );

      if (result.rows.length === 0) {
        logger.warn('Classification not found for retry', { classificationId });
        return;
      }

      const classification = result.rows[0];

      // Check if we've exceeded max retries
      if (classification.retry_count >= classification.max_retries) {
        logger.warn('Max retries exceeded - marking as awaiting_decision', {
          classificationId,
          retry_count: classification.retry_count,
        });

        // Update to awaiting_decision after max retries
        await db.query(
          `UPDATE classification_history 
           SET status = 'awaiting_decision',
               reason = $1,
               method = 'fallback'
           WHERE id = $2`,
          [
            `AI unavailable after ${classification.retry_count} retries - manual review needed`,
            classificationId,
          ]
        );

        // Send notification for manual review if metadata is valid
        let metadata;
        try {
          metadata = JSON.parse(classification.metadata);
        } catch (parseError) {
          logger.error('Failed to parse metadata for notification after max retries', {
            classificationId,
            error: parseError.message,
          });
          // Cannot send notification without valid metadata, but status is already updated
          return;
        }

        try {
          await discordBot.sendConfidenceBasedNotification(
            metadata,
            {
              confidence: classification.confidence || 50,
              reason: `AI unavailable after ${classification.retry_count} retries`,
              needs_clarification: true,
            },
            null
          );
        } catch (notificationError) {
          logger.error('Failed to send notification after max retries', {
            classificationId,
            error: notificationError.message,
          });
        }

        // Create in-app notification for manual review
        await createAwaitingDecisionNotification(
          classificationId,
          classification.title,
          `AI unavailable after ${classification.retry_count} retries - manual review needed`,
          classification.media_type
        );

        return;
      }

      // Attempt re-classification
      logger.info('Retrying classification', {
        classificationId,
        retry_count: classification.retry_count,
        title: classification.title,
      });

      // Parse the original metadata
      let metadata;
      try {
        metadata = JSON.parse(classification.metadata);
      } catch (parseError) {
        logger.error('Failed to parse metadata for retry', {
          classificationId,
          error: parseError.message,
        });
        // Mark as failed if metadata is invalid
        await db.query(
          `UPDATE classification_history 
           SET status = 'failed',
               error_message = $1
           WHERE id = $2`,
          ['Invalid metadata - cannot retry', classificationId]
        );
        return;
      }

      // Re-run classification
      const newResult = await this.classify(metadata);

      // If classification succeeded (not pending_retry), update the entry
      if (!newResult.needs_retry) {
        await db.query(
          `UPDATE classification_history 
           SET status = $1,
               method = $2,
               reason = $3,
               confidence = $4,
               library_id = $5,
               library_name = $6,
               retry_count = $7,
               retry_after = NULL
           WHERE id = $8`,
          [
            newResult.needs_clarification ? 'awaiting_decision' : 'completed',
            newResult.method,
            newResult.reason,
            newResult.confidence,
            newResult.library?.id || null,
            newResult.library?.name || null,
            classification.retry_count + 1,
            classificationId,
          ]
        );

        logger.info('Classification retry succeeded', {
          classificationId,
          method: newResult.method,
          library: newResult.library?.name,
        });
      } else {
        // Still failing - increment retry count and update retry_after
        await db.query(
          `UPDATE classification_history 
           SET retry_count = $1,
               retry_after = $2
           WHERE id = $3`,
          [
            classification.retry_count + 1,
            new Date(Date.now() + RETRY_DELAY_MS),
            classificationId,
          ]
        );

        logger.info('Classification retry still pending', {
          classificationId,
          retry_count: classification.retry_count + 1,
        });
      }
    } catch (error) {
      logger.error('Failed to retry classification', {
        classificationId,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  suggestSeriesType(metadata, appliedLabels = []) {
    // Anime detection
    if (appliedLabels.includes('anime') ||
      (metadata.original_language === 'ja' && appliedLabels.includes('animation'))) {
      return 'anime';
    }

    // Daily show detection
    const dailyLabels = ['late_night', 'talk', 'news', 'game_show', 'soap_opera'];
    if (dailyLabels.some(label => appliedLabels.includes(label))) {
      return 'daily';
    }

    return 'standard';
  }
}

module.exports = new ClassificationService();
