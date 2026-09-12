/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { buildClassificationBasePrompt } from '../../services/classificationBasePrompt.mjs';

test.each([
  ['classify', 'AI', 'Your role is to classify media items into the appropriate library.', ''],
  ['adjudicate', 'ADJUDICATOR', 'Your role is to compare only the server-selected, policy-eligible destinations. You cannot route media or expand that set.', ''],
  ['verify', 'VERIFIER', 'Your role is to VERIFY a pre-calculated classification decision.',
    'CRITICAL RULES:\n1. You CANNOT override the calculated confidence score.\n2. You can only CONFIRM the server-selected candidate or ABSTAIN.\n3. You MUST NOT select, name, rank, compare, or request another destination.\n4. Return only the required JSON object; do not include analysis or a preamble.\n'],
])('preserves exact production %s prompt text and context', async (mode, role, description, rules) => {
  const context = { metadata: { title: 'Private' } }, promptBuilder = { buildPrompt: jest.fn(async () => 'sections') };
  expect(await buildClassificationBasePrompt(context, { mode, promptBuilder }))
    .toBe(`You are a media classification ${role} for a home media server. ${description}\n\n${rules}\n\nsections`);
  expect(promptBuilder.buildPrompt).toHaveBeenCalledWith(context, { mode });
});
