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

/**
 * classificationAiService
 *
 * Owns the AI interaction layer for media classification:
 *   - normalizeAiResponseLine   — normalise a raw LLM response to a single clean line
 *   - buildAiRepairPrompt       — construct the repair prompt sent to the LLM
 *   - attemptAiResponseRepair   — run one repair pass via Ollama
 *   - aiClassify                — full AI classification flow (prompt → generate → parse → optional repair)
 */

const db = require('../config/database');
const ollamaService = require('./ollama');
const aiRouter = require('./aiRouter');
const providerLock = require('./providerLock');
const aiPromptBuilder = require('./aiPromptBuilder');
const aiResponseParser = require('./aiResponseParser');
const tavilyService = require('./tavily');
const libraryProfileService = require('./libraryProfileService');
const classificationMetadataService = require('./classificationMetadataService');
const classificationUtilsService = require('./classificationUtilsService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('classificationAiService');

// ---------------------------------------------------------------------------
// normalizeAiResponseLine
// ---------------------------------------------------------------------------

/**
 * Normalises a raw LLM response string to a single non-empty line.
 * Returns '' when the value is falsy or not a string.
 *
 * @param {*} value
 * @returns {string}
 */
function normalizeAiResponseLine(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines[0] || value.trim();
}

// ---------------------------------------------------------------------------
// buildAiRepairPrompt
// ---------------------------------------------------------------------------

/**
 * Builds the repair prompt sent to the LLM when the initial response could not
 * be parsed.
 *
 * @param {object} params
 * @param {string} params.response       Raw LLM response to repair
 * @param {Array}  params.libraries      Library objects (id, name, media_type)
 * @param {object|null} params.signalContext
 * @param {'classify'|'verify'} params.mode
 * @returns {string}
 */
function buildAiRepairPrompt({ response, libraries, signalContext, mode }) {
  const allowedFormats = mode === 'verify'
    ? [
        'CONFIRM|<library_number>|<brief_verification_reason>',
        'CLARIFY|<problem_summary>|<why_uncertain>|<question>|<library_number_1>|<library_number_2>|<library_number_3_optional>'
      ]
    : [
        'CONFIDENT|<library_number>|<confidence_0_to_100>|<brief_reason>',
        'CLARIFY|<problem_summary>|<why_uncertain>|<question>|<library_number_1>|<library_number_2>|<library_number_3_optional>'
      ];

  const librariesList = libraries
    .map((lib, index) => `${index + 1}. ${lib.name} (${lib.media_type || 'unknown'})`)
    .join('\n');

  const verifyContext = mode === 'verify' && signalContext
    ? `Pre-calculated confidence: ${signalContext.confidence}%\nSuggested library: ${signalContext.suggestedLibrary?.name || 'unknown'}`
    : '';

  return `You are an output normalizer for a media classification assistant.
Rewrite the RAW RESPONSE into EXACTLY one valid line using ONLY one allowed format below.
Do not add markdown, explanations, or extra lines.

Allowed formats:
${allowedFormats.join('\n')}

${verifyContext}
Available libraries:
${librariesList}

RAW RESPONSE:
${response}
`;
}

// ---------------------------------------------------------------------------
// attemptAiResponseRepair
// ---------------------------------------------------------------------------

/**
 * Runs a single repair attempt via Ollama and returns the normalised result.
 *
 * @param {object} params
 * @param {string} params.response
 * @param {Array}  params.libraries
 * @param {object|null} params.signalContext
 * @param {'classify'|'verify'} params.mode
 * @param {string|null} params.model
 * @param {number|null} params.temperature
 * @returns {Promise<string>}
 */
async function attemptAiResponseRepair({
  response,
  libraries,
  signalContext,
  mode,
  model,
  temperature
}) {
  const repairPrompt = buildAiRepairPrompt({
    response,
    libraries,
    signalContext,
    mode
  });

  const repairTemperature = Number.isFinite(Number(temperature))
    ? Math.min(0.2, Math.max(0, Number(temperature)))
    : 0.1;

  const repaired = await ollamaService.generate(
    repairPrompt,
    model || 'llama3.2',
    repairTemperature
  );

  return normalizeAiResponseLine(repaired);
}

// ---------------------------------------------------------------------------
// aiClassify
// ---------------------------------------------------------------------------

/**
 * Full AI classification flow:
 *   1. Build prompt (with optional web-search enrichment and library profile)
 *   2. Generate AI response via Ollama (streaming) or cloud provider
 *   3. Parse response; if fallback, optionally attempt a repair pass
 *   4. Return the best parse result with attached parse_diagnostics
 *
 * @param {object}      metadata       Enriched media metadata
 * @param {Array}       libraries      Available libraries
 * @param {object|null} signalContext  Pre-calculated signal context (triggers verify mode)
 * @param {object}      options        { mode, policySignals, ragContext }
 * @returns {Promise<object>}          AI parse result
 */
async function aiClassify(metadata, libraries, signalContext = null, options = {}) {
  // Try to get web search results if Tavily is enabled
  const webSearchResults = await classificationMetadataService.enrichWithWebSearch(metadata);

  // Helper function to find a sensible default library
  const _getDefaultLibrary = (libraries, mediaType) => {
    const generalNames = mediaType === 'movie'
      ? ['movies', 'films', 'general movies']
      : ['tv shows', 'tv series', 'series', 'television'];

    const generalLib = libraries.find(l =>
      generalNames.some(name => l.name.toLowerCase().includes(name))
    );

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
- If signals clearly point to one library with no real conflict, use ${mode === 'verify' ? 'CONFIRM' : 'CONFIDENT'} format, not CLARIFY
- In ${mode === 'verify' ? 'verify' : 'classify'} mode, NEVER use ${mode === 'verify' ? 'CONFIDENT' : 'CONFIRM'} format
- Only use CLARIFY when there are genuinely conflicting signals pointing to different libraries

Think step by step, then respond with ONLY one of the formats above.`;

  // Get AI config from ai_provider_config
  const configResult = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');
  const providerRow = configResult.rows[0] || null;
  const config = providerRow
    ? { model: providerRow.ollama_model || 'llama3.2', temperature: providerRow.temperature || 0.30 }
    : { model: 'llama3.2', temperature: 0.30 };
  const aiResponseRepairEnabled = providerRow?.ai_response_repair_enabled !== false;
  const disallowPartialStreamResponse = providerRow?.classification_disallow_partial_stream_response !== false;
  const provider = await aiRouter.getProvider('classification');

  if (!provider) {
    throw new Error('AI is not available - no provider configured or budget exhausted');
  }

  const generationModel = provider.config?.model || config.model;

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
    ollamaService.setGenerationStatus(true, generationModel, itemTitle);

    try {
      const maxTransientStreamAttempts = 2;
      let streamAttempt = 0;
      let lastStreamError = null;

      while (streamAttempt < maxTransientStreamAttempts) {
        streamAttempt += 1;
        try {
          if (provider.type === 'ollama') {
            // Use streaming to monitor progress for local generation.
            let lastLogTime = Date.now();
            response = await ollamaService.generateWithProgress(
              prompt,
              generationModel,
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
                    model: generationModel
                  });
                  lastLogTime = now;
                }
              },
              null,
              {
                allowPartialOnAbort: !disallowPartialStreamResponse,
                allowPartialOnStall: !disallowPartialStreamResponse,
                requireDoneSignal: disallowPartialStreamResponse
              }
            );
          } else {
            response = await aiRouter.classify(prompt, {
              taskType: 'classification',
              requestType: mode === 'verify' ? 'classification_verify' : 'classification',
              itemTitle
            });
          }
          lastStreamError = null;
          break;
        } catch (streamError) {
          lastStreamError = streamError;
          const isTransientStreamError = classificationUtilsService.isAiTransientAvailabilityError(streamError);
          if (!isTransientStreamError || streamAttempt >= maxTransientStreamAttempts) {
            throw streamError;
          }

          logger.warn('Transient AI stream failure - retrying classification generation', {
            title: metadata?.title,
            model: generationModel,
            attempt: streamAttempt,
            maxAttempts: maxTransientStreamAttempts,
            code: streamError.code,
            error: streamError.message
          });

          await classificationUtilsService.sleep(Math.min(1000, 500 * streamAttempt));
        }
      }

      if (!response && lastStreamError) {
        throw lastStreamError;
      }
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

  const suppressParseWarnings = aiResponseRepairEnabled;
  const firstParseResult = aiResponseParser.parse(response, parseContext, {
    mode,
    logInvalid: !suppressParseWarnings,
    logMalformed: !suppressParseWarnings
  });

  if (firstParseResult.format !== 'fallback') {
    firstParseResult.parse_diagnostics = classificationUtilsService.buildParseDiagnostics({
      mode,
      attemptCount: 1
    });
    return firstParseResult;
  }

  const firstFailureReason = firstParseResult.parse_failure_reason || 'no_format_matched';
  let finalParseResult = firstParseResult;

  if (aiResponseRepairEnabled) {
    try {
      const repairedResponse = await attemptAiResponseRepair({
        response,
        libraries,
        signalContext,
        mode,
        model: config.model,
        temperature: config.temperature
      });

      if (repairedResponse) {
        const repairedParse = aiResponseParser.parse(repairedResponse, parseContext, {
          mode,
          logInvalid: false,
          logMalformed: false
        });

        if (repairedParse.format !== 'fallback') {
          repairedParse.parse_diagnostics = classificationUtilsService.buildParseDiagnostics({
            mode,
            attemptCount: 2,
            failureReason: firstFailureReason,
            repaired: true,
            repairAttempted: true,
            repairSucceeded: true
          });
          return repairedParse;
        }

        finalParseResult = repairedParse;
      }
    } catch (repairError) {
      logger.warn('AI response repair attempt failed', {
        title: metadata?.title,
        mode,
        error: repairError.message
      });
    }
  }

  finalParseResult.parse_diagnostics = classificationUtilsService.buildParseDiagnostics({
    mode,
    attemptCount: aiResponseRepairEnabled ? 2 : 1,
    failureReason: finalParseResult.parse_failure_reason || firstFailureReason,
    repaired: false,
    repairAttempted: aiResponseRepairEnabled,
    repairSucceeded: false
  });

  logger.warn('AI response malformed after parse/repair attempts', {
    title: metadata?.title,
    mode,
    parseFailureReason: finalParseResult.parse_diagnostics.failure_reason,
    response: String(response || '').substring(0, 200)
  });

  return finalParseResult;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  normalizeAiResponseLine,
  buildAiRepairPrompt,
  attemptAiResponseRepair,
  aiClassify,
};
