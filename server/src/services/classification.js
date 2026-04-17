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
const classificationRetryService = require('./classificationRetryService');
const classificationOutcomeService = require('./classificationOutcomeService');
const aiRouter = require('./aiRouter');
const { SignalCollector, SIGNAL_TYPES } = require('./signalCollector');
const confidenceCalculator = require('./confidenceCalculator');
const ragRetriever = require('./ragRetriever');
const embeddingService = require('./embeddingService');
const classificationEvidenceReinforcementService = require('./classificationEvidenceReinforcementService');
const policyEngine = require('./policyEngine');
const policyQuestionBuilder = require('./policyQuestionBuilder');
const classificationEvidenceService = require('./classificationEvidenceService');
const providerLock = require('./providerLock');
const idleDetector = require('../utils/idleDetector');
const libraryProfileService = require('./libraryProfileService');
const aiPromptBuilder = require('./aiPromptBuilder');
const aiResponseParser = require('./aiResponseParser');
const { createLogger } = require('../utils/logger');
const ragLogger = require('../utils/ragLogger');
const { mapSecondPassError } = require('../utils/ragErrorHandler');
const { normalizeMetadataList, normalizeMetadataListLower } = require('../utils/metadataNormalization');
const {
  extractQuestionContext,
  getPolicyQuestionContextVersion,
  stampPolicyQuestionContext,
} = require('../utils/policyQuestionContext');
const ragLoopMetricsCollector = require('./ragLoopMetricsCollector');
const ragLoopResilienceManager = require('./ragLoopResilienceManager');
const classificationMetadataService = require('./classificationMetadataService');
const classificationUtilsService = require('./classificationUtilsService');
const classificationRoutingService = require('./classificationRoutingService');
const classificationAiService = require('./classificationAiService');
const classificationPersistenceService = require('./classificationPersistenceService');
const classificationRagLoopService = require('./classificationRagLoopService');
const { validateAndNormalizeRagLoopConfig } = require('../utils/ragLoopConfig');
const { OperationController } = require('../utils/operationController');
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

// Constants
// Retry delay between failed classification attempts when AI is unavailable.
// Set to 5 minutes as a conservative backoff to avoid hammering external providers
// (TMDB, LLMs, etc.) while still allowing eventual progress without manual intervention.
// Configurable via this constant - adjust based on your provider rate limits and needs.
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const RAG_LOOP_MIN_TIMEOUT_MS = 1000;
const RAG_LOOP_MAX_TIMEOUT_MS = 15000;
const AI_PARSE_CONTRACT_VERSION = 'phase1_v1';

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
      genre: normalizeMetadataListLower(metadata.genres),
      keyword: normalizeMetadataListLower(metadata.keywords),
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

    // Step 3: Policy Engine evaluation (v0.37.0)
    // Modern policy-based classification with comprehensive signal scoring
    let policyResult = null;
    let policySignalContext = null;

    // Phase 4C: Build a compact summary of related evidence for AI and clarification prompts.
    // The summary is informational-only — policy scores remain authoritative.
    const buildRelatedEvidenceSummary = (evidence, candidates) => {
      if (!Array.isArray(evidence) || evidence.length === 0) return null;
      const sorted = [...evidence].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      const top = sorted[0];
      const topLibraryObj = top?.libraryId
        ? (candidates || []).find(l => l.id === top.libraryId)
        : null;
      const topLibrary = topLibraryObj?.name ?? null;
      const topScopes = sorted.slice(0, 5).map(e => ({
        scope: e.scope,
        label: e.evidenceData?.genre ?? e.evidenceData?.studio ?? e.evidenceData?.franchise ?? e.evidenceKey ?? e.scope,
        confidence: e.confidence ?? 0,
        provenance: e.provenance ?? null,
      }));
      const uniqueLibraryIds = new Set(sorted.map(e => e.libraryId).filter(Boolean));
      const hasConflict = uniqueLibraryIds.size > 1;
      return { topLibrary, confidence: top?.confidence ?? 0, topScopes, hasConflict };
    };

    const buildPolicySignalContext = (result, candidates, rankedList, evidence = []) => {
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
        hasConflict,
        relatedEvidenceSummary: buildRelatedEvidenceSummary(evidence, candidates),
      };
    };

    try {
      if (taskId && !metadata.source_library_id) {
        await classificationPhaseService.updatePhase(taskId, 'policy_eval');
      }

      logger.info('Evaluating with PolicyEngine', { title: metadata.title });
      policyResult = await policyEngine.evaluateItem(metadata, { relatedEvidence });

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
        policySignalContext = buildPolicySignalContext(policyResult, libraries, policyResult.ranked, relatedEvidence);
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
        await classificationPhaseService.updatePhase(taskId, 'ai_analysis', {
          skippedPhases: ['signal_combine'],
          skippedPhaseMetadata: {
            signal_combine: {
              reason: 'policy_signal_path'
            }
          }
        });
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

        return this.ensureDecisionQuestion({
          metadata,
          result: finalResult,
          policyResult: policyResult || null,
          libraries,
          ragContext: effectiveRagContext
        });
      } catch (error) {
        const fallbackConfidence = policySignalContext.confidence || 0;
        const suggestedLibrary = policySignalContext.suggestedLibrary;
        const isTransientAiAvailability = this.isAiTransientAvailabilityError(error);

        if (isTransientAiAvailability) {
          logger.warn('AI classification temporarily unavailable', {
            error: error.message,
            code: error.code
          });
        } else {
          logger.error('AI classification failed', { error: error.message });
        }

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
            signalContext: policySignalContext,
            transientError: error,
            previousRetryCount: metadata.retry_count,
            maxRetries: metadata.max_retries
          });
        }

        if (suggestedLibrary && fallbackConfidence >= 50) {
          return this.ensureDecisionQuestion({
            metadata,
            result: {
            library: suggestedLibrary,
            confidence: fallbackConfidence,
            method: 'signal_calculation',
            reason: 'Calculated from policy signals (AI unavailable)',
            libraries: libraries,
            policyResult
            },
            policyResult: policyResult || null,
            libraries,
            ragContext
          });
        }

        const fallbackLibrary = libraries[libraries.length - 1];
        return this.ensureDecisionQuestion({
          metadata,
          result: {
            library: fallbackLibrary,
            confidence: 50,
            method: 'fallback',
            reason: `Default library - AI unavailable (fell back to ${fallbackLibrary.name})`,
            libraries: libraries,
          },
          policyResult: policyResult || null,
          libraries,
          ragContext
        });
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
      // checkLearnedPatterns removed from detectors (Phase 4B): LEARNED_PATTERN signal
      // injection is retired. Related evidence is now owned by PolicyEngine scoring.
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
      relatedEvidenceSummary: buildRelatedEvidenceSummary(relatedEvidence, libraries),
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

      return this.ensureDecisionQuestion({
        metadata,
        result: finalResult,
        policyResult: metadata.policyResult || null,
        libraries,
        ragContext: effectiveRagContext
      });
    } catch (error) {
      const isTransientAiAvailability = this.isAiTransientAvailabilityError(error);

      if (isTransientAiAvailability) {
        logger.warn('AI classification temporarily unavailable', {
          error: error.message,
          code: error.code
        });
      } else {
        logger.error('AI classification failed', { error: error.message });
      }

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
          signalContext,
          transientError: error,
          previousRetryCount: metadata.retry_count,
          maxRetries: metadata.max_retries
        });
      }

      if (confidenceResult.suggestedLibrary && confidenceResult.confidence >= 50) {
        return this.ensureDecisionQuestion({
          metadata,
          result: {
            library: confidenceResult.suggestedLibrary,
            confidence: confidenceResult.confidence,
            method: 'signal_calculation',
            reason: 'Calculated from signals (AI unavailable)',
            libraries: libraries,
          },
          policyResult: metadata.policyResult || null,
          libraries,
          ragContext
        });
      }

      const fallbackLibrary = libraries[libraries.length - 1];
      return this.ensureDecisionQuestion({
        metadata,
        result: {
          library: fallbackLibrary,
          confidence: 50,
          method: 'fallback',
          reason: `Default library - AI unavailable (fell back to ${fallbackLibrary.name})`,
          libraries: libraries,
        },
        policyResult: metadata.policyResult || null,
        libraries,
        ragContext
      });
    }
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
        const genres = normalizeMetadataListLower(metadata.genres);
        if (genres.length === 0) {
          return false;
        }
        return tmdb_match_values.some(value =>
          genres.some(g => g === value.toLowerCase())
        );

      case 'keywords':
        // Check if any metadata keyword matches any of the label values
        const keywords = normalizeMetadataListLower(metadata.keywords);
        if (keywords.length === 0) {
          return false;
        }
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
    if (!result || result.needs_retry) {
      return result;
    }

    const requiresDecisionQuestion = Boolean(
      result.needs_clarification ||
      result.method === 'fallback' ||
      (result.confidence && result.confidence < 70)
    );

    if (!requiresDecisionQuestion) {
      result.needs_clarification = false;
      result.clarification = null;
      result.policy_question = null;
      result.pending_reason = null;
      return result;
    }

    const existingQuestion = result.policy_question || result.clarification || null;
    if (existingQuestion) {
      result.needs_clarification = true;
      result.clarification = result.clarification || existingQuestion;
      result.policy_question = result.policy_question || existingQuestion;
      result.pending_reason = result.pending_reason || existingQuestion.problem_summary || result.reason || null;
      return result;
    }

    const effectivePolicyResult = result.policyResult || policyResult || null;
    const policyQuestion = await policyQuestionBuilder.build({
      metadata,
      policyResult: effectivePolicyResult,
      libraries,
      suggestedLibrary: result.library || null,
      ragContext,
      aiResult: result,
      relatedEvidenceSummary: result.signalContext?.relatedEvidenceSummary ?? null,
    });

    if (policyQuestion) {
      result.needs_clarification = true;
      result.clarification = policyQuestion;
      result.policy_question = policyQuestion;
      result.pending_reason = policyQuestion.problem_summary;
    }

    return result;
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
