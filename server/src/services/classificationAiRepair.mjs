/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { normalizeResponseForParsing } from './aiResponseNormalizer.mjs';

/**
 * Normalizes and sanitizes an AI response line.
 * Delegates to the robust aiResponseNormalizer pipeline.
 * 
 * @param {string} value Raw response text
 * @returns {string} Sanitized response
 */
export function normalizeAiResponseLine(value) {
  return normalizeResponseForParsing(value);
}

/**
 * Builds the prompt for repairing malformed AI responses with strict instructions.
 */
export function buildAiRepairPrompt({ response, libraries, signalContext, mode, validationErrors }) {
  const allowedFormats = mode === 'verify'
    ? [
        'CONFIRM|<library_number>|<brief_verification_reason>',
        'CLARIFY|<problem_summary>|<why_uncertain>|<question>|<library_number_1>|<library_number_2>|<library_number_3_optional>'
      ]
    : [
        'CONFIDENT|<library_number>|<confidence_integer>|<brief_reason>',
        'CLARIFY|<problem_summary>|<why_uncertain>|<question>|<library_number_1>|<library_number_2>|<library_number_3_optional>'
      ];

  const librariesList = libraries
    .map((lib, index) => `${index + 1}. ${lib.name} (${lib.media_type || 'unknown'})`)
    .join('\n');

  const verifyContext = mode === 'verify' && signalContext
    ? `Pre-calculated confidence: ${signalContext.confidence}%\nSuggested library: ${signalContext.suggestedLibrary?.name || 'unknown'}`
    : '';

  const validationFeedback = validationErrors
    ? `\nYour previous JSON output was invalid. Please review these specific validation errors and correct them in your output:\n${validationErrors}\n`
    : '';

  return `You are an output normalizer for a media classification assistant.
Rewrite the RAW RESPONSE into EXACTLY one valid line using ONLY one allowed format below.
Do not add markdown, explanations, or extra lines.
${validationFeedback}
Allowed formats:
${allowedFormats.join('\n')}

Rules:
1. Respond with EXACTLY one line of pipe-delimited values. No conversational preamble, explanation, or outro.
2. Do NOT wrap your response in markdown code blocks or backticks. Do NOT use markdown bold styling (e.g. **CONFIDENT**). Output pure, raw text only.
3. <library_number> (and any library options for CLARIFY) MUST be a pure integer number from the AVAILABLE LIBRARIES list below (e.g. 4, NOT "4." or "4)"). Use the index number, not the library name.
4. <confidence_integer> MUST be a whole number between 0 and 100 with NO percent sign, NO decimals, and NO other symbols (e.g. 95, NOT "95%" or "~95").
5. The explanation text MUST NOT contain any pipe ("|") characters.

Few-Shot Examples:
❌ BAD: CONFIDENT|4|95%|The media represents a reality TV show.
❌ BAD: **CONFIDENT**|4|95|The media represents a reality TV show.
✅ GOOD: CONFIDENT|4|95|The media represents a reality TV show.

${verifyContext}
Available libraries:
${librariesList}

RAW RESPONSE:
${response}
`;
}

/**
 * Attempts to repair a malformed AI response using a second lower-temperature call.
 */
export async function attemptAiResponseRepair({
  response,
  libraries,
  signalContext,
  mode,
  model,
  temperature,
  validationErrors,
  generateFn
}) {
  const repairPrompt = buildAiRepairPrompt({
    response,
    libraries,
    signalContext,
    mode,
    validationErrors
  });

  const repairTemperature = Number.isFinite(Number(temperature))
    ? Math.min(0.2, Math.max(0, Number(temperature)))
    : 0.1;

  const repaired = await generateFn(
    repairPrompt,
    model || 'llama3.2',
    repairTemperature
  );

  return normalizeAiResponseLine(repaired);
}
