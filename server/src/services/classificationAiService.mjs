import { ServiceUnavailableError } from '../utils/appError.mjs';
import * as db from '../config/database.mjs';
import { ollamaService } from './ollama.mjs';
import { classificationResponseSchema } from './aiResponseSchema.mjs';
import { aiRouterService as aiRouter } from './aiRouter.mjs';
import { providerLock } from './providerLock.mjs';
import { aiPromptBuilder } from './aiPromptBuilder.mjs';
import { aiResponseParser } from './aiResponseParser.mjs';
import { buildAiResponseDiagnosticArtifact } from './aiResponseDiagnosticsService.mjs';
import { tavilyService } from './tavily.mjs';
import { libraryProfileService } from './libraryProfileService.mjs';
import { enrichWithWebSearch } from './classificationMetadataService.mjs';
import {
  buildParseDiagnostics,
  isAiTransientAvailabilityError,
  sleep,
} from './classificationUtilsService.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  normalizeAiResponseLine as _normalizeAiResponseLine,
  buildAiRepairPrompt as _buildAiRepairPrompt,
  attemptAiResponseRepair as _attemptAiResponseRepair
} from './classificationAiRepair.mjs';
import {
  getParseFailureReason as _getParseFailureReason,
  isRepairEligibleParseResult as _isRepairEligibleParseResult,
  getValidationError as _getValidationError
} from './classificationAiParseHelpers.mjs';

const logger = createLogger('classificationAiService');

export function normalizeAiResponseLine(value) {
  return _normalizeAiResponseLine(value);
}

export function buildAiRepairPrompt({ response, libraries, signalContext, mode, validationErrors }) {
  return _buildAiRepairPrompt({ response, libraries, signalContext, mode, validationErrors });
}

export async function attemptAiResponseRepair({
  response,
  libraries,
  signalContext,
  mode,
  model,
  temperature,
  validationErrors
}) {
  return _attemptAiResponseRepair({
    response,
    libraries,
    signalContext,
    mode,
    model,
    temperature,
    validationErrors,
    generateFn: (...args) => ollamaService.generate(...args)
  });
}

async function aiClassifyImpl(metadata, libraries, signalContext = null, options = {}) {
  const webSearchResults = await enrichWithWebSearch(metadata);

  const _getDefaultLibrary = (libraries, mediaType) => {
    const generalNames = mediaType === 'movie'
      ? ['movies', 'films', 'general movies']
      : ['tv shows', 'tv series', 'series', 'television'];

    const generalLib = libraries.find(l =>
      generalNames.some(name => l.name.toLowerCase().includes(name))
    );

    return generalLib || libraries[libraries.length - 1];
  };

  const promptContext = {
    metadata: metadata,
    libraries: libraries,
    signalContext: signalContext,
    policySignals: options.policySignals || signalContext,
    ragContext: options.ragContext || null,
  };

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

  const mode = options.mode || (signalContext ? 'verify' : 'classify');

  let prompt = `You are a media classification ${mode === 'verify' ? 'VERIFIER' : 'AI'} for a home media server. ${mode === 'verify' ? 'Your role is to VERIFY a pre-calculated classification decision.' : 'Your role is to classify media items into the appropriate library.'}

${mode === 'verify' ? `CRITICAL RULES:
1. You CANNOT override the calculated confidence score.
2. Your job is to VERIFY the suggested library makes sense, OR request clarification if there are conflicts.
3. If the calculated confidence is high and signals align, CONFIRM the decision.
4. If signals conflict or you see a potential error, REQUEST CLARIFICATION.
` : ''}`;

  const signalSections = await aiPromptBuilder.buildPrompt(promptContext, { mode });
  prompt += '\n\n' + signalSections;

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

  const configResult = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');
  const providerRow = configResult.rows[0] || null;
  const config = providerRow
    ? { model: providerRow.ollama_model || 'llama3.2', temperature: providerRow.temperature || 0.30 }
    : { model: 'llama3.2', temperature: 0.30 };
  const aiResponseRepairEnabled = providerRow?.ai_response_repair_enabled !== false;
  const disallowPartialStreamResponse = providerRow?.classification_disallow_partial_stream_response !== false;
  const provider = await aiRouter.getProvider('classification');

  if (!provider) {
    throw new ServiceUnavailableError('AI is not available - no provider configured or budget exhausted');
  }

  const generationModel = provider.config?.model || config.model;

  await providerLock.acquireLock('classification', 'high');

  const heartbeatIntervalMs = providerLock.config.heartbeatInterval;
  let heartbeatTimer = null;
  let response;

  try {
    heartbeatTimer = setInterval(() => {
      providerLock.heartbeat('classification');
    }, heartbeatIntervalMs);

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
            let lastLogTime = Date.now();
            response = await ollamaService.generateWithProgress(
              prompt,
              generationModel,
              parseFloat(config.temperature),
              (tokenCount, isComplete) => {
                ollamaService.updateTokenCount(tokenCount);

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
                requireDoneSignal: disallowPartialStreamResponse,
                format: /think|qwq|deepseek-r|reasoning/i.test(generationModel) ? undefined : classificationResponseSchema
              }
            );
          } else {
            response = await aiRouter.classify(prompt, {
              taskType: 'classification',
              requestType: mode === 'verify' ? 'classification_verify' : 'classification',
              itemTitle,
              format: /think|qwq|deepseek-r|reasoning/i.test(generationModel) ? undefined : classificationResponseSchema
            });
          }
          lastStreamError = null;
          break;
        } catch (streamError) {
          lastStreamError = streamError;
          const isTransientStreamError = isAiTransientAvailabilityError(streamError);
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

          await sleep(Math.min(1000, 500 * streamAttempt));
        }
      }

      if (!response && lastStreamError) {
        throw lastStreamError;
      }
    } finally {
      ollamaService.setGenerationStatus(false);
    }
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    providerLock.releaseLock('classification');
  }

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
  const firstFailureReason = _getParseFailureReason(firstParseResult);
  const responseArtifact = firstFailureReason
    ? buildAiResponseDiagnosticArtifact(response)
    : null;
  const shouldAttemptRepair = aiResponseRepairEnabled && _isRepairEligibleParseResult(firstParseResult, mode);

  if (firstParseResult.format !== 'fallback' && !shouldAttemptRepair) {
    firstParseResult.parse_diagnostics = buildParseDiagnostics({
      mode,
      attemptCount: 1,
      failureReason: firstFailureReason,
      responseArtifact,
    });
    return firstParseResult;
  }

  let finalParseResult = firstParseResult;
  let repairResponseArtifact = null;

  if (shouldAttemptRepair) {
    try {
      const validationErrors = _getValidationError(firstParseResult);
      const repairedResponse = await attemptAiResponseRepair({
        response,
        libraries,
        signalContext,
        mode,
        model: config.model,
        temperature: config.temperature,
        validationErrors
      });

      if (repairedResponse) {
        repairResponseArtifact = buildAiResponseDiagnosticArtifact(repairedResponse);
        const repairedParse = aiResponseParser.parse(repairedResponse, parseContext, {
          mode,
          logInvalid: false,
          logMalformed: false
        });
        const repairedStillNeedsRepair = _isRepairEligibleParseResult(repairedParse, mode);

        if (repairedParse.format !== 'fallback' && !repairedStillNeedsRepair) {
          repairedParse.parse_diagnostics = buildParseDiagnostics({
            mode,
            attemptCount: 2,
            failureReason: firstFailureReason,
            repaired: true,
            repairAttempted: true,
            repairSucceeded: true,
            responseArtifact,
            repairResponseArtifact,
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

  finalParseResult.parse_diagnostics = buildParseDiagnostics({
    mode,
    attemptCount: shouldAttemptRepair ? 2 : 1,
    failureReason: _getParseFailureReason(finalParseResult) || firstFailureReason,
    repaired: false,
    repairAttempted: shouldAttemptRepair,
    repairSucceeded: false,
    responseArtifact,
    repairResponseArtifact,
  });

  logger.warn('AI response malformed after parse/repair attempts', {
    title: metadata?.title,
    mode,
    parseFailureReason: finalParseResult.parse_diagnostics.failure_reason,
    response: String(response || '').substring(0, 200)
  });

  return finalParseResult;
}

export async function aiClassify(...args) {
  return aiClassifyImpl(...args);
}

export const classificationAiService = {
  normalizeAiResponseLine,
  buildAiRepairPrompt,
  attemptAiResponseRepair,
  aiClassify: aiClassifyImpl,
};
