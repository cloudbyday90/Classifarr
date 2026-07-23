import {
  buildPolicyStarterTemplateIntentSignalSuggestions,
  buildPolicyStarterTemplateSuggestions,
} from '../../services/policyStarterTemplateSuggestions.mjs';

describe('policyStarterTemplateSuggestions', () => {
  const library = { id: 7, name: 'Anime Movies', media_type: 'movie' };
  const presets = [
    {
      id: 11,
      key: 'anime',
      name: 'Anime Collection',
      description: 'Animated Japanese films.',
      category: 'animation',
      signals: {
        genres: { require_any: ['Animation'] },
        keywords: { require_any: ['anime'] },
      },
    },
    {
      id: 12,
      key: 'crime',
      name: 'Crime',
      description: 'Detective stories.',
      category: 'drama',
      signals: { genres: { require_any: ['Crime'] } },
    },
  ];

  test('reuses bounded library/template matching for optional starter-template suggestions', () => {
    const suggestions = buildPolicyStarterTemplateSuggestions({ library, presets });

    expect(suggestions).toEqual([
      expect.objectContaining({
        id: 11,
        name: 'Anime Collection',
        suggestion_score: expect.any(Number),
        suggestion_reasons: expect.arrayContaining(['key_token_match']),
        match_score: expect.any(Number),
      }),
    ]);
    expect(suggestions[0].suggestion_score).toBeGreaterThan(0);
  });

  test('projects only bounded supported require-any values without exposing raw templates', () => {
    const suggestions = buildPolicyStarterTemplateIntentSignalSuggestions({
      suggestions: buildPolicyStarterTemplateSuggestions({ library, presets }),
    });

    expect(suggestions).toEqual([
      {
        templateId: '11',
        templateName: 'Anime Collection',
        signalType: 'genres',
        value: 'Animation',
        label: 'Animation',
        explanation: 'Suggested by the optional Anime Collection starter template.',
      },
      {
        templateId: '11',
        templateName: 'Anime Collection',
        signalType: 'keywords',
        value: 'anime',
        label: 'anime',
        explanation: 'Suggested by the optional Anime Collection starter template.',
      },
    ]);
    expect(suggestions[0]).not.toHaveProperty('signals');
    expect(suggestions[0]).not.toHaveProperty('description');
  });

  test('fails closed when there is no usable library context or template identity', () => {
    expect(buildPolicyStarterTemplateSuggestions({ presets })).toEqual([]);
    expect(buildPolicyStarterTemplateIntentSignalSuggestions({
      suggestions: [{ id: 11, signals: { genres: { require_any: ['Animation'] } } }],
    })).toEqual([]);
  });
});
