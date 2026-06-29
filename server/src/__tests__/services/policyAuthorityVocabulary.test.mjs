import {
  AUTHORITY_LEVELS,
  AUTHORITY_SOURCE_IDS,
  getPolicyAuthoritySource,
  isDurablePolicyAuthority,
  isLearningEligibleByDefault,
  listPolicyAuthorityGlossary,
  listPolicyAuthoritySources,
} from '../../services/policyAuthorityVocabulary.mjs';

describe('policyAuthorityVocabulary', () => {
  test('defines the required Phase 0R authority sources', () => {
    const sourceIds = listPolicyAuthoritySources().map(source => source.id);

    expect(sourceIds).toEqual([
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
      AUTHORITY_SOURCE_IDS.AI_OUTPUT,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    ]);
  });

  test('keeps operator declared intent as the only durable policy authority', () => {
    expect(isDurablePolicyAuthority(AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)).toBe(true);

    [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
      AUTHORITY_SOURCE_IDS.AI_OUTPUT,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    ].forEach(sourceId => {
      expect(isDurablePolicyAuthority(sourceId)).toBe(false);
    });
  });

  test('marks AI output as non-authoritative and blocks direct learning', () => {
    const aiOutput = getPolicyAuthoritySource(AUTHORITY_SOURCE_IDS.AI_OUTPUT);

    expect(aiOutput).toEqual(expect.objectContaining({
      authorityLevel: AUTHORITY_LEVELS.NON_AUTHORITY,
      durablePolicyAuthority: false,
      learningEligibleByDefault: false,
    }));
    expect(aiOutput.prohibited).toEqual(expect.arrayContaining([
      'Authorize durable learning.',
      'Write policy intent directly.',
      'Own final question text without server normalization.',
    ]));
  });

  test('treats media-server contents as observed evidence, not hard-limit authority', () => {
    const mediaServerContents = getPolicyAuthoritySource(AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS);

    expect(mediaServerContents.authorityLevel).toBe(AUTHORITY_LEVELS.OBSERVED_EVIDENCE);
    expect(mediaServerContents.allowed).toEqual(expect.arrayContaining([
      'Seed observed-profile evidence.',
      'Suggest belongs-here, helpful, avoid, or review candidates.',
    ]));
    expect(mediaServerContents.prohibited).toEqual(expect.arrayContaining([
      'Create hard limits without operator confirmation.',
      'Override declared intent.',
    ]));
  });

  test('requires guarded learning instead of default learning eligibility', () => {
    listPolicyAuthoritySources().forEach(source => {
      expect(isLearningEligibleByDefault(source.id)).toBe(false);
    });

    expect(getPolicyAuthoritySource(AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME).allowed)
      .toEqual(expect.arrayContaining([
        'Create a learning candidate only when the learning guard marks it eligible.',
      ]));
  });

  test('exposes immutable source and glossary records', () => {
    const sources = listPolicyAuthoritySources();
    const glossary = listPolicyAuthorityGlossary();

    expect(Object.isFrozen(sources)).toBe(true);
    expect(Object.isFrozen(sources[0])).toBe(true);
    expect(Object.isFrozen(sources[0].allowed)).toBe(true);
    expect(Object.isFrozen(glossary)).toBe(true);
    expect(Object.isFrozen(glossary[0])).toBe(true);
  });

  test('returns null for unknown authority sources', () => {
    expect(getPolicyAuthoritySource('unknown')).toBeNull();
    expect(isDurablePolicyAuthority('unknown')).toBe(false);
    expect(isLearningEligibleByDefault('unknown')).toBe(false);
  });
});
