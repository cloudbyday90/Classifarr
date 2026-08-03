/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { normalizeAiProviderOutput } from '../../services/aiProviderOutputNormalization.mjs';

describe('aiProviderOutputNormalization', () => {
  test('removes thinking traces and normalizes local or cloud text to the parser contract', () => {
    expect(normalizeAiProviderOutput('<think>internal chain</think>\n```text\nCONFIDENT|1|85%|fit\n```'))
      .toEqual({
        normalizedOutput: 'CONFIDENT|1|85|fit',
        thinkingTraceDetected: true,
      });
  });

  test('keeps structured JSON intact for schema validation', () => {
    const output = normalizeAiProviderOutput('{"decision":"CONFIDENT","library_number":1}');

    expect(output.normalizedOutput).toBe('{"decision":"CONFIDENT","library_number":1}');
    expect(output.thinkingTraceDetected).toBe(false);
  });
});
