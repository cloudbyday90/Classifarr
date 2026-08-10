import { ServiceUnavailableError } from '../utils/appError.mjs';
import * as db from '../config/database.mjs';
import { ollamaService } from './ollama.mjs';
import {
  candidateBoundVerificationResponseSchema,
  classificationResponseSchema,
} from './aiResponseSchema.mjs';
import { aiRouterService as aiRouter } from './aiRouter.mjs';
import { providerLock } from './providerLock.mjs';
import { aiPromptBuilder } from './aiPromptBuilder.mjs';
import { aiResponseParser } from './aiResponseParser.mjs';
import { buildAiResponseDiagnosticArtifact } from './aiResponseDiagnosticsService.mjs';
import { isReasoningModel } from './aiResponseNormalizer.mjs';
import {
  AI_PROVIDER_AUTHORITY_MODE_IDS,
  buildAiProviderAuthorityProfile,
} from './aiProviderAuthority.mjs';
import {
  buildCandidateBoundVerificationContract,
  resolveCandidateBoundVerificationAdmission,
} from './classificationCandidateBoundVerificationContract.mjs';
import {
  createCandidateBoundVerificationAdmissionResult,
} from './aiResponseParserResults.mjs';
import {
  attachAiProviderAuthorityToClassificationResult,
} from './classificationAiAuthorityAttachment.mjs';
import {
  normalizeAiProviderOutput,
  sanitizeAiProviderOutputForDiagnostics,
} from './aiProviderOutputNormalization.mjs';
import { aiProviderCapabilityMetricsService } from './aiProviderCapabilityMetricsService.mjs';
import { libraryProfileService } from './libraryProfileService.mjs';
import { enrichWithWebSearch } from './classificationMetadataService.mjs';
import { formatNormalizedWebSearchForAI } from './webSearchResultNormalizer.mjs';
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
import {
  buildClassificationAiRepairProvenance,
  resolveClassificationAiRepairAuthority,
} from './classificationAiRepairAuthority.mjs';

const logger = createLogger('classificationAiService');

// Reasoning ("thinking") models emit internal chain-of-thought before/while
// answering, so they need larger stall budgets than the ollama generation
// defaults: more time to first token (while thinking) and a higher absolute
// cap (they generate far more tokens). These override the defaults in
// ollamaGeneration.mjs only for reasoning models.
const REASONING_INITIAL_TIMEOUT_MS = 240000; // first-token budget (default 120s)
const REASONING_HEARTBEAT_TIMEOUT_MS = 90000; // between-token gap (default 60s)
const REASONING_HARD_TIMEOUT_MS = 600000; // absolute cap (default 300s)

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
  validationErrors,
  normalize = true,
}) {
  return _attemptAiResponseRepair({
    response,
    libraries,
    signalContext,
    mode,
    model,
    temperature,
    validationErrors,
    generateFn: (...args) => ollamaService.generate(...args),
    normalize,
  });
}

function resolveProviderAuthority(provider, model, requestedMode) {
  return provider?.authority || buildAiProviderAuthorityProfile({
    providerId: provider?.type,
    model,
    requestedMode,
  });
}

async function attachAiProviderAuthority({
  result,
  authority,
  diagnostics = null,
  generationError = null,
  thinkingTraceDetected = false,
  recordCapabilityMetric = true,
}) {
  const authorityBoundResult = attachAiProviderAuthorityToClassificationResult({
    result,
    authority,
  });

  if (recordCapabilityMetric) {
    await recordAiProviderCapabilityObservation({
      authority,
      parseResult: authorityBoundResult,
      diagnostics,
      generationError,
      thinkingTraceDetected,
    });
  }

  return authorityBoundResult;
}

async function recordAiProviderCapabilityObservation({
  authority,
  parseResult = null,
  diagnostics = null,
  generationError = null,
  thinkingTraceDetected = false,
}) {
  await aiProviderCapabilityMetricsService.record({
    authority,
    parseResult,
    diagnostics,
    generationError,
    thinkingTraceDetected,
  });
}

async function aiClassifyImpl(metadata, libraries, signalContext = null, options = {}) {
  // Every caller must select a deterministic mode. The default remains the
  // generic proposal path for backwards-compatible direct callers; signal
  // context alone must never escalate a request into verification.
  const mode = options.mode || 'classify';
  const verificationContract = mode === 'verify'
    ? buildCandidateBoundVerificationContract({
        libraries,
        signalContext,
        verificationCandidate: options.verificationCandidate,
      })
    : null;

  const configResult = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');
  const providerRow = configResult.rows[0] || null;
  const config = providerRow
    ? { model: providerRow.ollama_model || 'llama3.2', temperature: providerRow.temperature || 0.30 }
    : { model: 'llama3.2', temperature: 0.30 };
  const aiResponseRepairEnabled = providerRow?.ai_response_repair_enabled !== false;
  const disallowPartialStreamResponse = providerRow?.classification_disallow_partial_stream_response !== false;
  const requestedAuthorityMode = mode === 'verify'
    ? AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION
    : AI_PROVIDER_AUTHORITY_MODE_IDS.PROPOSAL;
  const provider = await aiRouter.getProvider('classification', {
    authorityMode: requestedAuthorityMode,
  });

  if (!provider) {
    throw new ServiceUnavailableError('AI is not available - no provider configured or budget exhausted');
  }

  const generationModel = provider.config?.model || config.model;
  const providerAuthority = resolveProviderAuthority(
    provider,
    generationModel,
    requestedAuthorityMode,
  );
  const reasoningModel = isReasoningModel(generationModel);
  const verificationAdmission = mode === 'verify'
    ? resolveCandidateBoundVerificationAdmission({
        contract: verificationContract,
        authority: providerAuthority,
      })
    : null;

  // Admission happens before profile reads, web search, prompt construction,
  // locks, and provider generation. An unsupported provider must never see a
  // verification request that it cannot satisfy contractually.
  if (mode === 'verify' && verificationAdmission?.admitted !== true) {
    return attachAiProviderAuthority({
      result: createCandidateBoundVerificationAdmissionResult({
        libraries,
        signalContext,
        metadata,
      }, verificationAdmission),
      authority: providerAuthority,
      recordCapabilityMetric: false,
    });
  }

  const webSearchResults = mode === 'classify'
    ? await enrichWithWebSearch(metadata)
    : null;
  const promptContext = {
    metadata,
    libraries,
    signalContext,
    policySignals: options.policySignals || signalContext,
    // Similar-item candidate names are not needed for a bound confirmation.
    ragContext: mode === 'verify' ? null : (options.ragContext || null),
    verificationContract,
  };

  if (signalContext?.suggestedLibrary) {
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

  let prompt = `You are a media classification ${mode === 'verify' ? 'VERIFIER' : 'AI'} for a home media server. ${mode === 'verify' ? 'Your role is to VERIFY a pre-calculated classification decision.' : 'Your role is to classify media items into the appropriate library.'}

${mode === 'verify' ? `CRITICAL RULES:
1. You CANNOT override the calculated confidence score.
2. You can only CONFIRM the server-selected candidate or ABSTAIN.
3. You MUST NOT select, name, rank, compare, or request another destination.
4. Return only the required JSON object; do not include analysis or a preamble.
` : ''}`;

  const signalSections = await aiPromptBuilder.buildPrompt(promptContext, { mode });
  prompt += '\n\n' + signalSections;

  if (webSearchResults) {
    prompt += `\n\n--- ADDITIONAL WEB RESEARCH ---`;

    if (webSearchResults.imdb) {
      prompt += `\n${formatNormalizedWebSearchForAI(webSearchResults.imdb)}`;
    }

    if (webSearchResults.advisory) {
      prompt += `\n\nContent Advisory: ${formatNormalizedWebSearchForAI(webSearchResults.advisory)}`;
    }

    if (webSearchResults.anime) {
      prompt += `\n\nAnime Database: ${formatNormalizedWebSearchForAI(webSearchResults.anime)}`;
    }
  }

  if (mode === 'classify') {
    prompt += `\n\nIMPORTANT FOR CLARIFICATION:
- The problem_summary should be SHORT (max 50 chars)
- The why_uncertain should explain WHAT DATA conflicts and WHY you can't decide
- The question should be SPECIFIC and help the user understand what choosing each option means
- Always provide 2-3 clear options (not just yes/no when possible)

CRITICAL - DO NOT HALLUCINATE CONFLICTS:
- Only mention libraries that have ACTUAL signal support (genres, keywords, patterns matching that library)
- Certification (G, PG, TV-PG, R, TV-MA, etc.) is a CONTENT RATING for age-appropriateness, NOT a library indicator - do not use it to suggest which library content belongs to
- DO NOT suggest "Family" library for R-rated Horror/Thriller content with no family-related signals
- If signals clearly point to one library with no real conflict, use CONFIDENT format, not CLARIFY
- In classify mode, NEVER use CONFIRM format
- Only use CLARIFY when there are genuinely conflicting signals pointing to different libraries

Respond with ONLY one of the formats above.`;
  }

  await providerLock.acquireLock('classification', 'high');

  const heartbeatIntervalMs = providerLock.config.heartbeatInterval;
  let heartbeatTimer = null;
  let response;
  let thinkingTraceDetected = false;

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
                format: reasoningModel ? undefined : (mode === 'verify'
                  ? candidateBoundVerificationResponseSchema
                  : classificationResponseSchema),
                ...(reasoningModel
                  ? {
                      initialTimeout: REASONING_INITIAL_TIMEOUT_MS,
                      heartbeatTimeout: REASONING_HEARTBEAT_TIMEOUT_MS,
                      hardTimeout: REASONING_HARD_TIMEOUT_MS,
                    }
                  : {})
              }
            );
          } else {
            response = await aiRouter.classify(prompt, {
              taskType: 'classification',
              provider,
              authorityMode: requestedAuthorityMode,
              requestType: mode === 'verify' ? 'classification_verify' : 'classification',
              itemTitle,
              requireAuthorityMode: mode === 'verify',
              format: reasoningModel ? undefined : (mode === 'verify'
                ? candidateBoundVerificationResponseSchema
                : classificationResponseSchema)
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
    } catch (generationError) {
      await attachAiProviderAuthority({
        authority: providerAuthority,
        generationError,
      });
      throw generationError;
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

  const rawProviderResponse = response;
  const normalizedProviderOutput = normalizeAiProviderOutput(rawProviderResponse);
  response = normalizedProviderOutput.normalizedOutput;
  const sourceThinkingTraceDetected = normalizedProviderOutput.thinkingTraceDetected;
  thinkingTraceDetected = sourceThinkingTraceDetected;
  const safeProviderDiagnosticOutput = sanitizeAiProviderOutputForDiagnostics(rawProviderResponse);

  const parseContext = {
    libraries,
    signalContext,
    metadata,
    verificationContract,
  };

  const suppressParseWarnings = aiResponseRepairEnabled;
  const firstParseResult = aiResponseParser.parse(response, parseContext, {
    mode,
    logInvalid: !suppressParseWarnings,
    logMalformed: !suppressParseWarnings
  });
  const firstFailureReason = _getParseFailureReason(firstParseResult);
  const responseArtifact = firstFailureReason
    ? buildAiResponseDiagnosticArtifact(safeProviderDiagnosticOutput)
    : null;
  // A strict verification response cannot be rewritten by another model. A
  // malformed bound response is an abstention, not a repaired confirmation.
  const shouldAttemptRepair = mode !== 'verify'
    && aiResponseRepairEnabled
    && _isRepairEligibleParseResult(firstParseResult, mode);

  if (firstParseResult.format !== 'fallback' && !shouldAttemptRepair) {
    firstParseResult.parse_diagnostics = buildParseDiagnostics({
      mode,
      attemptCount: 1,
      failureReason: firstFailureReason,
      repairAttempted: false,
      repairSucceeded: false,
      responseArtifact,
    });
    return attachAiProviderAuthority({
      result: firstParseResult,
      authority: providerAuthority,
      diagnostics: firstParseResult.parse_diagnostics,
      thinkingTraceDetected,
    });
  }

  let finalParseResult = firstParseResult;
  let repairResponseArtifact = null;
  let repairAuthority = null;
  let repairProvenance = null;
  let repairParseResult = null;
  let repairGenerationError = null;
  let repairThinkingTraceDetected = false;
  let repairSucceeded = false;

  if (shouldAttemptRepair) {
    const repairModel = config.model || 'llama3.2';
    repairAuthority = resolveClassificationAiRepairAuthority({
      sourceAuthority: providerAuthority,
      repairModel,
    });
    repairProvenance = buildClassificationAiRepairProvenance({
      sourceAuthority: providerAuthority,
      repairAuthority,
    });

    try {
      const validationErrors = _getValidationError(firstParseResult);
      const repairedResponse = await attemptAiResponseRepair({
        response,
        libraries,
        signalContext,
        mode,
        model: repairModel,
        temperature: config.temperature,
        validationErrors,
        normalize: false,
      });

      if (repairedResponse) {
        const normalizedRepairOutput = normalizeAiProviderOutput(repairedResponse);
        const repairedResponseForParsing = normalizedRepairOutput.normalizedOutput;
        repairThinkingTraceDetected = normalizedRepairOutput.thinkingTraceDetected;
        thinkingTraceDetected ||= repairThinkingTraceDetected;
        repairResponseArtifact = buildAiResponseDiagnosticArtifact(repairedResponseForParsing);
        const repairedParse = aiResponseParser.parse(repairedResponseForParsing, parseContext, {
          mode,
          logInvalid: false,
          logMalformed: false
        });
        repairParseResult = repairedParse;
        const repairedStillNeedsRepair = _isRepairEligibleParseResult(repairedParse, mode);

        if (repairedParse.format !== 'fallback' && !repairedStillNeedsRepair) {
          finalParseResult = repairedParse;
          repairSucceeded = true;
        } else {
          finalParseResult = repairedParse;
        }
      }
    } catch (repairError) {
      repairGenerationError = repairError;
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
    repaired: repairSucceeded,
    repairAttempted: shouldAttemptRepair,
    repairSucceeded,
    responseArtifact,
    repairResponseArtifact,
    repairProvenance,
  });

  if (shouldAttemptRepair) {
    const sourceDiagnostics = buildParseDiagnostics({
      mode,
      attemptCount: 1,
      failureReason: firstFailureReason,
      repairAttempted: true,
      repairSucceeded,
      repairProvenance,
    });
    const repairDiagnostics = buildParseDiagnostics({
      mode,
      attemptCount: 1,
      failureReason: repairSucceeded ? null : _getParseFailureReason(repairParseResult),
      repairProvenance,
    });

    await recordAiProviderCapabilityObservation({
      authority: providerAuthority,
      parseResult: firstParseResult,
      diagnostics: sourceDiagnostics,
      thinkingTraceDetected: sourceThinkingTraceDetected,
    });
    await recordAiProviderCapabilityObservation({
      authority: repairAuthority,
      parseResult: repairParseResult,
      diagnostics: repairDiagnostics,
      generationError: repairGenerationError,
      thinkingTraceDetected: repairThinkingTraceDetected,
    });
  }

  if (!repairSucceeded) {
    logger.warn('AI response malformed after parse/repair attempts', {
      title: metadata?.title,
      mode,
      parseFailureReason: finalParseResult.parse_diagnostics.failure_reason,
      response: String(response || '').substring(0, 200)
    });
  }

  return attachAiProviderAuthority({
    result: finalParseResult,
    authority: repairSucceeded ? repairAuthority : providerAuthority,
    diagnostics: finalParseResult.parse_diagnostics,
    thinkingTraceDetected,
    recordCapabilityMetric: !shouldAttemptRepair,
  });
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
