import {
  MAX_CUSTOM_EXPLANATION_LENGTH,
  MAX_CUSTOM_VALUE_LENGTH,
  POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES,
  PolicyIntentSignalCustomEntryValidationError,
  buildPolicyIntentSignalCustomEntryCandidate,
  getPolicyIntentSignalCustomEntryInputContract,
  isPolicyIntentSignalCustomEntryInputContract,
} from '../../services/policyIntentSignalCustomEntry.mjs';

describe('policyIntentSignalCustomEntry', () => {
  test('canonicalizes a bounded custom candidate without accepting authority or evidence fields', () => {
    const candidate = buildPolicyIntentSignalCustomEntryCandidate({
      signalType: ' STUDIOS ',
      value: ' Studio\u00A0Ghibli ',
      explanation: ' This library is intended for films from this studio. ',
    });

    expect(candidate).toEqual({
      sourceId: 'operator_added_custom',
      signalType: 'studios',
      value: 'Studio Ghibli',
      label: 'Studio Ghibli',
      questionId: 'what_belongs_here',
      operator: 'require_any',
      explanation: 'This library is intended for films from this studio.',
      requiresExplicitAcceptance: true,
      canAutoDeclare: false,
    });
  });

  test.each([
    [{ signalType: 'ratings', value: 'PG', explanation: 'A rating is not a supported custom destination signal.' }, POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_SIGNAL_TYPE],
    [{ signalType: 'genres', value: 'Drama', explanation: 'A valid explanation.', autoDeclare: true }, POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_REQUEST],
    [{ signalType: 'genres', value: `A${'x'.repeat(MAX_CUSTOM_VALUE_LENGTH)}`, explanation: 'A valid explanation.' }, POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_VALUE],
    [{ signalType: 'genres', value: 'Drama\u0000', explanation: 'A valid explanation.' }, POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_VALUE],
    [{ signalType: 'genres', value: 'Drama', explanation: `A${'x'.repeat(MAX_CUSTOM_EXPLANATION_LENGTH)}` }, POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_EXPLANATION],
    [{ signalType: 'genres', value: 'Drama', explanation: '   ' }, POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_EXPLANATION],
  ])('rejects malformed custom input %#', (request, expectedCode) => {
    expect(() => buildPolicyIntentSignalCustomEntryCandidate(request)).toThrow(
      PolicyIntentSignalCustomEntryValidationError,
    );

    try {
      buildPolicyIntentSignalCustomEntryCandidate(request);
    } catch (error) {
      expect(error.code).toBe(expectedCode);
    }
  });

  test('publishes a fixed server-owned input contract', () => {
    const inputContract = getPolicyIntentSignalCustomEntryInputContract();

    expect(inputContract).toEqual({
      version: 'policy.intent_signal_custom_entry.v1',
      enabled: true,
      signalTypes: [
        { id: 'genres', label: 'Genre' },
        { id: 'keywords', label: 'Keyword' },
        { id: 'studios', label: 'Studio' },
      ],
      valueMaximumLength: MAX_CUSTOM_VALUE_LENGTH,
      explanationMaximumLength: MAX_CUSTOM_EXPLANATION_LENGTH,
      requiresExplanation: true,
    });
    expect(isPolicyIntentSignalCustomEntryInputContract(inputContract)).toBe(true);
    expect(isPolicyIntentSignalCustomEntryInputContract({ ...inputContract, enabled: false })).toBe(false);
  });
});
