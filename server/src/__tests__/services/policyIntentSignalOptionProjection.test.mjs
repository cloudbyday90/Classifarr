import {
  POLICY_INTENT_SIGNAL_OPTION_PROJECTION_VERSION,
  buildPolicyIntentSignalOptionProjection,
  buildPolicyIntentSignalOptionProjectionAudit,
} from '../../services/policyIntentSignalOptionProjection.mjs';

function observedProjection() {
  return {
    observations: [{
      key: 'genre:animation',
      kind: 'genre',
      value: 'Animation',
      label: 'Animation',
      count: 48,
      confidence: 0.84,
      explanation: 'Animation appears in 48 items in the current library.',
    }],
    selectableSuggestions: [{
      candidateId: 'genre:animation:purpose',
      value: 'Animation',
      label: 'Animation',
      signalType: 'genres',
      operator: 'require_any',
      explanation: 'Animation appears in 48 items in the current library.',
      evidence: { count: 48, confidence: 0.84 },
    }],
  };
}

describe('policyIntentSignalOptionProjection', () => {
  test('composes source-labelled evidence, selectable options, and disabled states in one bounded contract', () => {
    const projection = buildPolicyIntentSignalOptionProjection({
      observedProjection: observedProjection(),
      starterTemplateSuggestions: [
        {
          templateId: 'holiday',
          templateName: 'Holiday',
          signalType: 'keywords',
          value: 'Christmas',
          explanation: 'Suggested by the optional Holiday starter template.',
        },
        {
          templateId: 'animation',
          templateName: 'Animation',
          signalType: 'genres',
          value: 'Animation',
          explanation: 'Suggested by the optional Animation starter template.',
        },
      ],
      commonOptions: [{ signalType: 'genres', value: 'Mystery' }],
      customValueCandidates: [{
        signalType: 'studios',
        value: 'Studio Ghibli',
        explanation: 'The operator provided a studio-specific destination identity.',
      }],
      declaredSignals: [{ signalType: 'genres', value: 'Animation' }],
      conflictingSignals: [{
        signalType: 'genres',
        value: 'Horror',
        disabledReason: 'This destination avoids Horror.',
      }],
    });

    expect(projection).toEqual(expect.objectContaining({
      version: POLICY_INTENT_SIGNAL_OPTION_PROJECTION_VERSION,
      rawPayloadExposed: false,
      authority: {
        displayProjection: true,
        policyPersistence: false,
        routingExecution: false,
        canAutoDeclareIntent: false,
      },
      customEntryInput: expect.objectContaining({
        enabled: true,
        signalTypes: expect.arrayContaining([
          { id: 'genres', label: 'Genre' },
          { id: 'keywords', label: 'Keyword' },
          { id: 'studios', label: 'Studio' },
        ]),
      }),
      observedEvidence: [expect.objectContaining({
        sourceId: 'observed_in_library',
        readOnlyEvidence: true,
        requiresExplicitAcceptance: true,
      })],
      options: expect.arrayContaining([
        expect.objectContaining({
          value: 'Animation',
          sourceId: 'already_declared',
          selectable: false,
          disabledReason: 'This value is already declared for this destination.',
        }),
        expect.objectContaining({
          value: 'Horror',
          sourceId: 'unavailable_conflicting_intent',
          selectable: false,
          disabledReason: 'This destination avoids Horror.',
        }),
        expect.objectContaining({
          value: 'Christmas',
          sourceId: 'suggested_from_starter_template',
          selectable: true,
          canAutoDeclare: false,
        }),
        expect.objectContaining({
          value: 'Mystery',
          sourceId: 'common_static_option',
          selectable: true,
        }),
        expect.objectContaining({
          value: 'Studio Ghibli',
          sourceId: 'operator_added_custom',
          selectable: true,
        }),
      ]),
    }));
    expect(projection.options.find(option => option.value === 'Animation').sourceId).toBe('already_declared');
    expect(projection.sourceSummaries).toHaveLength(7);
    expect(buildPolicyIntentSignalOptionProjectionAudit(projection)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('converts unsupported broad template, common, or custom identity values into a disabled reason', () => {
    const projection = buildPolicyIntentSignalOptionProjection({
      starterTemplateSuggestions: [{
        templateId: 'animation',
        templateName: 'Animation',
        signalType: 'genres',
        value: 'Sci-Fi',
        explanation: 'Suggested by the optional Animation starter template.',
      }],
      commonOptions: [{ signalType: 'genres', value: 'Animation' }],
      customValueCandidates: [{
        signalType: 'genres',
        value: 'Drama',
        explanation: 'Operator entered a broad value.',
      }],
    });

    expect(projection.options).toEqual(expect.arrayContaining([
      expect.objectContaining({
        value: 'Sci-Fi',
        sourceId: 'unavailable_conflicting_intent',
        selectable: false,
      }),
      expect.objectContaining({ value: 'Animation', sourceId: 'unavailable_conflicting_intent' }),
      expect.objectContaining({ value: 'Drama', sourceId: 'unavailable_conflicting_intent' }),
    ]));
    expect(projection.options.every(option => option.canAutoDeclare === false)).toBe(true);
  });

  test('retains observed evidence when the same broad identity is suggested by another source', () => {
    const projection = buildPolicyIntentSignalOptionProjection({
      observedProjection: observedProjection(),
      starterTemplateSuggestions: [{
        templateId: 'animation',
        templateName: 'Animation',
        signalType: 'genres',
        value: 'Animation',
        explanation: 'Suggested by the optional Animation starter template.',
      }],
    });

    const animationOptions = projection.options.filter(option => option.value === 'Animation');

    expect(animationOptions).toEqual([
      expect.objectContaining({
        sourceId: 'suggested_from_observed_profile',
        selectable: true,
        evidence: { count: 48, confidence: 0.84 },
      }),
    ]);
  });

  test('keeps a just-submitted custom candidate within the bounded projection', () => {
    const projection = buildPolicyIntentSignalOptionProjection({
      observedProjection: {
        selectableSuggestions: Array.from({ length: 20 }, (_value, index) => ({
          signalType: 'keywords',
          value: `Observed ${index}`,
          explanation: `Observed value ${index} is supported by the library.`,
        })),
      },
      starterTemplateSuggestions: Array.from({ length: 24 }, (_value, index) => ({
        signalType: 'keywords',
        value: `Template ${index}`,
        explanation: `Template suggestion ${index}.`,
      })),
      customValueCandidates: [{
        signalType: 'keywords',
        value: 'Specific custom value',
        explanation: 'The operator provided a destination-specific value.',
      }],
    });

    expect(projection.options).toHaveLength(32);
    expect(projection.options[0]).toEqual(expect.objectContaining({
      value: 'Specific custom value',
      sourceId: 'operator_added_custom',
      selectable: true,
    }));
  });

  test('fails closed for malformed source candidates and detects authority tampering', () => {
    const projection = buildPolicyIntentSignalOptionProjection({
      commonOptions: [{ signalType: 'ratings', value: 'PG' }, null],
    });

    expect(projection.options).toEqual([]);
    projection.authority.canAutoDeclareIntent = true;

    expect(buildPolicyIntentSignalOptionProjectionAudit(projection)).toEqual(expect.objectContaining({
      ok: false,
      issues: expect.arrayContaining(['unsafe_authority']),
    }));
  });
});
