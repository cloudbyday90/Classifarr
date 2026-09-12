/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Shared production/replay prompt assembly; callers own provider-safe context. */
export async function buildClassificationBasePrompt(context, { mode, promptBuilder }) {
  const role = mode === 'verify' ? 'VERIFIER' : (mode === 'adjudicate' ? 'ADJUDICATOR' : 'AI');
  const description = mode === 'verify'
    ? 'Your role is to VERIFY a pre-calculated classification decision.'
    : mode === 'adjudicate'
      ? 'Your role is to compare only the server-selected, policy-eligible destinations. You cannot route media or expand that set.'
      : 'Your role is to classify media items into the appropriate library.';
  const introduction = `You are a media classification ${role} for a home media server. ${description}

${mode === 'verify' ? `CRITICAL RULES:
1. You CANNOT override the calculated confidence score.
2. You can only CONFIRM the server-selected candidate or ABSTAIN.
3. You MUST NOT select, name, rank, compare, or request another destination.
4. Return only the required JSON object; do not include analysis or a preamble.
` : ''}`;
  return introduction + '\n\n' + await promptBuilder.buildPrompt(context, { mode });
}
