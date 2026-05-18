/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { ollamaService } from './ollama.mjs';
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

const logger = createLogger('classificationAiService');

export function normalizeAiResponseLine(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines[0] || value.trim();
}

export function buildAiRepairPrompt({ response, libraries, signalContext, mode }) {
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

export async function attemptAiResponseRepair({
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

function getParseFailureReason(parseResult) {
  if (!parseResult || typeof parseResult !== 'object') {
    return null;
  }

  if (typeof parseResult.parse_failure_reason === 'string' && parseResult.parse_failure_reason.trim()) {
    return parseResult.parse_failure_reason.trim();
  }

  const meta = parseResult.policy_question?.meta || parseResult.clarification?.meta || null;
  if (meta && typeof meta.violation_reason === 'string' && meta.violation_reason.trim()) {
    return meta.violation_reason.trim();
  }

  return null;
}

function isRepairEligibleParseResult(parseResult, mode) {
  if (!parseResult || typeof parseResult !== 'object') {
    return false;
  }

  if (parseResult.format === 'fallback') {
    return true;
  }

  if (mode !== 'classify' || parseResult.format !== 'contract_violation') {
    return false;
  }

  return [
    'narrative_no_format_match',
    'no_format_matched',
    'single_valid_option',
    'no_valid_options',
  ].includes(getParseFailureReason(parseResult));
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
    throw new Error('AI is not available - no provider configured or budget exhausted');
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
  const firstFailureReason = getParseFailureReason(firstParseResult);
  const responseArtifact = firstFailureReason
    ? buildAiResponseDiagnosticArtifact(response)
    : null;
  const shouldAttemptRepair = aiResponseRepairEnabled && isRepairEligibleParseResult(firstParseResult, mode);

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
      const repairedResponse = await attemptAiResponseRepair({
        response,
        libraries,
        signalContext,
        mode,
        model: config.model,
        temperature: config.temperature
      });

      if (repairedResponse) {
        repairResponseArtifact = buildAiResponseDiagnosticArtifact(repairedResponse);
        const repairedParse = aiResponseParser.parse(repairedResponse, parseContext, {
          mode,
          logInvalid: false,
          logMalformed: false
        });
        const repairedStillNeedsRepair = isRepairEligibleParseResult(repairedParse, mode);

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
    failureReason: getParseFailureReason(finalParseResult) || firstFailureReason,
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
