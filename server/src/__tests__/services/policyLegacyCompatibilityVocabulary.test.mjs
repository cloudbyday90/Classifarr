import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  LEGACY_COMPATIBILITY_AUDIENCE,
  LEGACY_COMPATIBILITY_TERM_IDS,
  findLegacyTermsForInternalName,
  getLegacyCompatibilityTerm,
  isPermanentLegacyCompatibilityModel,
  isProductAllowedLegacyTerm,
  listLegacyCompatibilityTerms,
  listProductAllowedLegacyTermIds,
  shouldExposeLegacyInternalNameToProduct,
} from '../../services/policyLegacyCompatibilityVocabulary.mjs';

describe('policyLegacyCompatibilityVocabulary', () => {
  test('defines the required legacy compatibility vocabulary terms', () => {
    expect(listLegacyCompatibilityTerms().map(term => term.id)).toEqual([
      LEGACY_COMPATIBILITY_TERM_IDS.STARTER_TEMPLATE,
      LEGACY_COMPATIBILITY_TERM_IDS.LEGACY_PRESET_RECORD,
      LEGACY_COMPATIBILITY_TERM_IDS.COMPATIBILITY_BRIDGE,
      LEGACY_COMPATIBILITY_TERM_IDS.CUSTOM_SIGNAL_PAYLOAD,
      LEGACY_COMPATIBILITY_TERM_IDS.INTENT_DRAFT,
      LEGACY_COMPATIBILITY_TERM_IDS.ROLLBACK_SNAPSHOT,
      LEGACY_COMPATIBILITY_TERM_IDS.NATIVE_INTENT_STORAGE,
    ]);
  });

  test('allows only product-safe legacy terms in normal policy language', () => {
    expect(listProductAllowedLegacyTermIds()).toEqual([
      LEGACY_COMPATIBILITY_TERM_IDS.STARTER_TEMPLATE,
      LEGACY_COMPATIBILITY_TERM_IDS.INTENT_DRAFT,
      LEGACY_COMPATIBILITY_TERM_IDS.NATIVE_INTENT_STORAGE,
    ]);

    expect(isProductAllowedLegacyTerm(LEGACY_COMPATIBILITY_TERM_IDS.STARTER_TEMPLATE)).toBe(true);
    expect(isProductAllowedLegacyTerm(LEGACY_COMPATIBILITY_TERM_IDS.CUSTOM_SIGNAL_PAYLOAD)).toBe(false);
    expect(isProductAllowedLegacyTerm(LEGACY_COMPATIBILITY_TERM_IDS.ROLLBACK_SNAPSHOT)).toBe(false);
  });

  test('maps presets to starter templates for product language', () => {
    const starterTemplate = getLegacyCompatibilityTerm(LEGACY_COMPATIBILITY_TERM_IDS.STARTER_TEMPLATE);

    expect(starterTemplate).toEqual(expect.objectContaining({
      productLabel: 'Starter Template',
      audience: LEGACY_COMPATIBILITY_AUDIENCE.PRODUCT,
      authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
      permanentModel: false,
    }));
    expect(starterTemplate.internalTerms).toEqual(expect.arrayContaining([
      'preset',
      'content preset',
      'policy preset',
    ]));
    expect(starterTemplate.prohibitedProductUse).toEqual(expect.arrayContaining([
      'Describe the template as the final policy model.',
      'Expose raw preset JSON or custom signal payloads in normal setup.',
    ]));
  });

  test('keeps customSignals as internal compatibility payload language', () => {
    const payload = getLegacyCompatibilityTerm(LEGACY_COMPATIBILITY_TERM_IDS.CUSTOM_SIGNAL_PAYLOAD);

    expect(payload).toEqual(expect.objectContaining({
      productLabel: 'Compatibility payload',
      audience: LEGACY_COMPATIBILITY_AUDIENCE.INTERNAL,
      permanentModel: false,
    }));
    expect(payload.internalTerms).toEqual(expect.arrayContaining([
      'customSignals',
      'custom_signals',
    ]));
    expect(payload.prohibitedProductUse).toEqual(expect.arrayContaining([
      'Appear as normal product copy.',
      'Be directly edited by product components.',
    ]));
  });

  test('distinguishes rollback snapshots from permanent archives or editable policy models', () => {
    const rollbackSnapshot = getLegacyCompatibilityTerm(LEGACY_COMPATIBILITY_TERM_IDS.ROLLBACK_SNAPSHOT);

    expect(rollbackSnapshot).toEqual(expect.objectContaining({
      productLabel: 'Rollback snapshot',
      audience: LEGACY_COMPATIBILITY_AUDIENCE.MIGRATION,
      permanentModel: false,
    }));
    expect(rollbackSnapshot.prohibitedProductUse).toEqual(expect.arrayContaining([
      'Become a parallel editable policy model.',
      'Be described as an archive of the old product experience.',
      'Remain unbounded after deletion gates pass.',
    ]));
  });

  test('marks native intent storage as the only permanent final model', () => {
    expect(isPermanentLegacyCompatibilityModel(LEGACY_COMPATIBILITY_TERM_IDS.NATIVE_INTENT_STORAGE)).toBe(true);

    [
      LEGACY_COMPATIBILITY_TERM_IDS.STARTER_TEMPLATE,
      LEGACY_COMPATIBILITY_TERM_IDS.LEGACY_PRESET_RECORD,
      LEGACY_COMPATIBILITY_TERM_IDS.COMPATIBILITY_BRIDGE,
      LEGACY_COMPATIBILITY_TERM_IDS.CUSTOM_SIGNAL_PAYLOAD,
      LEGACY_COMPATIBILITY_TERM_IDS.INTENT_DRAFT,
      LEGACY_COMPATIBILITY_TERM_IDS.ROLLBACK_SNAPSHOT,
    ].forEach(termId => {
      expect(isPermanentLegacyCompatibilityModel(termId)).toBe(false);
    });
  });

  test('finds terms by exact internal names without exposing internal names to product', () => {
    expect(findLegacyTermsForInternalName('customSignals').map(term => term.id)).toEqual([
      LEGACY_COMPATIBILITY_TERM_IDS.CUSTOM_SIGNAL_PAYLOAD,
    ]);
    expect(findLegacyTermsForInternalName('preset').map(term => term.id)).toEqual([
      LEGACY_COMPATIBILITY_TERM_IDS.STARTER_TEMPLATE,
    ]);

    expect(shouldExposeLegacyInternalNameToProduct('customSignals')).toBe(false);
    expect(shouldExposeLegacyInternalNameToProduct('content_presets')).toBe(false);
    expect(shouldExposeLegacyInternalNameToProduct('preset')).toBe(true);
  });

  test('exposes immutable compatibility vocabulary records', () => {
    const terms = listLegacyCompatibilityTerms();
    const productAllowedTerms = listProductAllowedLegacyTermIds();

    expect(Object.isFrozen(terms)).toBe(true);
    expect(Object.isFrozen(terms[0])).toBe(true);
    expect(Object.isFrozen(terms[0].internalTerms)).toBe(true);
    expect(Object.isFrozen(productAllowedTerms)).toBe(true);
  });

  test('returns null or false for unknown terms', () => {
    expect(getLegacyCompatibilityTerm('unknown')).toBeNull();
    expect(isProductAllowedLegacyTerm('unknown')).toBe(false);
    expect(isPermanentLegacyCompatibilityModel('unknown')).toBe(false);
    expect(findLegacyTermsForInternalName('unknown')).toEqual([]);
    expect(shouldExposeLegacyInternalNameToProduct('unknown')).toBe(false);
  });
});
