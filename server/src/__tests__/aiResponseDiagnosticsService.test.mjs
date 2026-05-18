import { describe, expect, test } from '@jest/globals';

import {
  AI_RESPONSE_PREVIEW_MAX_LENGTH,
  buildAiResponseDiagnosticArtifact,
  normalizeAiResponseDiagnosticText,
} from '../services/aiResponseDiagnosticsService.mjs';

describe('aiResponseDiagnosticsService', () => {
  test('normalizes control characters and repeated whitespace', () => {
    expect(normalizeAiResponseDiagnosticText('  CONFIDENT|1|\n85|\tmatch\u0000  ')).toBe('CONFIDENT|1| 85| match');
  });

  test('returns null artifact for non-string or empty content', () => {
    expect(buildAiResponseDiagnosticArtifact(null)).toBeNull();
    expect(buildAiResponseDiagnosticArtifact('   \n\t  ')).toBeNull();
  });

  test('builds a stable fingerprint from normalized text', () => {
    const left = buildAiResponseDiagnosticArtifact('CONFIDENT|1|85|match');
    const right = buildAiResponseDiagnosticArtifact('  CONFIDENT|1|85|match  ');

    expect(left.fingerprint).toBe(right.fingerprint);
    expect(left.preview).toBe('CONFIDENT|1|85|match');
    expect(left.truncated).toBe(false);
  });

  test('truncates previews to the default max length', () => {
    const long = 'A'.repeat(AI_RESPONSE_PREVIEW_MAX_LENGTH + 10);
    const artifact = buildAiResponseDiagnosticArtifact(long);

    expect(artifact.preview).toHaveLength(AI_RESPONSE_PREVIEW_MAX_LENGTH);
    expect(artifact.truncated).toBe(true);
  });

  test('accepts a custom max preview length', () => {
    const artifact = buildAiResponseDiagnosticArtifact('abcdef', { maxLength: 3 });

    expect(artifact.preview).toBe('abc');
    expect(artifact.truncated).toBe(true);
  });
});
