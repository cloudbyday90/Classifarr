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
  temperature,
  generateFn
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

  const repaired = await generateFn(
    repairPrompt,
    model || 'llama3.2',
    repairTemperature
  );

  return normalizeAiResponseLine(repaired);
}
