import {
  REFERENCE_DATA_AUTHORITY_IDS,
  REFERENCE_DATA_CATEGORY_IDS,
  REFERENCE_DATA_SOURCE_IDS,
  canReferenceDataComputeReadiness,
  canReferenceDataPersistPolicy,
  getReferenceDataRecord,
  isReferenceDataObservedEvidence,
  listReferenceDataRecords,
  listReferenceDataRecordsByCategory,
  summarizeReferenceDataBoundary,
  validateReferenceDataOption,
} from '../../services/policyBuilderReferenceDataBoundary.mjs';

describe('policyBuilderReferenceDataBoundary', () => {
  test('defines Phase 1R.4 reference data categories', () => {
    const summary = summarizeReferenceDataBoundary();

    expect(summary.countsByCategory).toEqual({
      [REFERENCE_DATA_CATEGORY_IDS.STATIC_OPTION]: 2,
      [REFERENCE_DATA_CATEGORY_IDS.CONFIGURED_LIBRARY]: 1,
      [REFERENCE_DATA_CATEGORY_IDS.STARTER_TEMPLATE]: 2,
      [REFERENCE_DATA_CATEGORY_IDS.OBSERVED_PROFILE_SUGGESTION]: 2,
      [REFERENCE_DATA_CATEGORY_IDS.SERVER_PROJECTION_DISPLAY]: 2,
      [REFERENCE_DATA_CATEGORY_IDS.ROUTING_MAPPING_STATUS]: 1,
      [REFERENCE_DATA_CATEGORY_IDS.MIGRATION_NOTICE]: 1,
    });
    expect(summary.observedEvidenceRecordIds).toEqual([
      'library_profile',
      'library_profile_genre_options',
    ]);
    expect(summary.staticOptionRecordIds).toEqual([
      'available_ratings',
      'preset_genres',
    ]);
  });

  test('keeps static options distinct from observed evidence', () => {
    expect(getReferenceDataRecord('available_ratings')).toEqual(expect.objectContaining({
      category: REFERENCE_DATA_CATEGORY_IDS.STATIC_OPTION,
      authorityId: REFERENCE_DATA_AUTHORITY_IDS.OPTION_ONLY,
      sourceId: REFERENCE_DATA_SOURCE_IDS.STATIC_PRESET_SIGNAL_VALUES,
      maySuggestIntent: false,
      mayComputeReadiness: false,
      mayPersistPolicy: false,
    }));

    expect(getReferenceDataRecord('library_profile_genre_options')).toEqual(expect.objectContaining({
      category: REFERENCE_DATA_CATEGORY_IDS.OBSERVED_PROFILE_SUGGESTION,
      authorityId: REFERENCE_DATA_AUTHORITY_IDS.OBSERVED_EVIDENCE,
      sourceId: REFERENCE_DATA_SOURCE_IDS.LIBRARY_PROFILE,
      maySuggestIntent: true,
      mayComputeReadiness: false,
      mayPersistPolicy: false,
    }));
  });

  test('marks starter templates as draft seeds, not durable policy authority', () => {
    [
      'attachable_presets',
      'preset_suggestions',
    ].forEach(recordId => {
      expect(getReferenceDataRecord(recordId)).toEqual(expect.objectContaining({
        category: REFERENCE_DATA_CATEGORY_IDS.STARTER_TEMPLATE,
        authorityId: REFERENCE_DATA_AUTHORITY_IDS.DRAFT_SEED,
        maySuggestIntent: true,
        mayComputeReadiness: false,
        mayPersistPolicy: false,
      }));
    });
  });

  test('reserves routing status for future server-owned readiness projection', () => {
    const record = getReferenceDataRecord('routing_mapping_status');

    expect(record).toEqual(expect.objectContaining({
      category: REFERENCE_DATA_CATEGORY_IDS.ROUTING_MAPPING_STATUS,
      sourceId: REFERENCE_DATA_SOURCE_IDS.FUTURE_ROUTING_STATUS_ENDPOINT,
      authorityId: REFERENCE_DATA_AUTHORITY_IDS.READINESS_CONTEXT,
      owner: 'future Phase 6R/7R server projection',
      currentPath: null,
    }));
    expect(summarizeReferenceDataBoundary().futureServerProjectionRecordIds).toEqual([
      'routing_mapping_status',
    ]);
  });

  test('prevents reference data from computing readiness or persisting policy', () => {
    listReferenceDataRecords().forEach(record => {
      expect(canReferenceDataComputeReadiness(record.id)).toBe(false);
      expect(canReferenceDataPersistPolicy(record.id)).toBe(false);
    });
  });

  test('classifies observed evidence records through helpers', () => {
    expect(isReferenceDataObservedEvidence('library_profile')).toBe(true);
    expect(isReferenceDataObservedEvidence('library_profile_genre_options')).toBe(true);
    expect(isReferenceDataObservedEvidence('preset_genres')).toBe(false);
    expect(isReferenceDataObservedEvidence('unknown')).toBe(false);
  });

  test('validates genre option authority by source', () => {
    expect(validateReferenceDataOption({
      value: 'Animation',
      source: 'library_profile',
    })).toEqual({
      valid: true,
      authorityId: REFERENCE_DATA_AUTHORITY_IDS.OBSERVED_EVIDENCE,
      reason: 'Option is backed by observed library profile evidence.',
    });

    expect(validateReferenceDataOption({
      value: 'Comedy',
      source: 'preset_reference',
    })).toEqual({
      valid: true,
      authorityId: REFERENCE_DATA_AUTHORITY_IDS.OPTION_ONLY,
      reason: 'Option is a static starter-template value, not observed evidence.',
    });
  });

  test('rejects missing or unknown option sources', () => {
    expect(validateReferenceDataOption({
      value: '',
      source: 'library_profile',
    })).toEqual({
      valid: false,
      authorityId: null,
      reason: 'Option value is required.',
    });

    expect(validateReferenceDataOption({
      value: 'Animation',
      source: 'provider_payload',
    })).toEqual({
      valid: false,
      authorityId: null,
      reason: 'Unknown option source.',
    });
  });

  test('filters records by category', () => {
    expect(listReferenceDataRecordsByCategory(REFERENCE_DATA_CATEGORY_IDS.OBSERVED_PROFILE_SUGGESTION)
      .map(record => record.id)).toEqual([
      'library_profile',
      'library_profile_genre_options',
    ]);

    expect(listReferenceDataRecordsByCategory('unknown')).toEqual([]);
  });

  test('exposes immutable reference data records', () => {
    const records = listReferenceDataRecords();
    const observedRecords = listReferenceDataRecordsByCategory(REFERENCE_DATA_CATEGORY_IDS.OBSERVED_PROFILE_SUGGESTION);

    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(observedRecords[0])).toBe(true);
  });

  test('returns null or false for unknown records', () => {
    expect(getReferenceDataRecord('unknown')).toBeNull();
    expect(canReferenceDataComputeReadiness('unknown')).toBe(false);
    expect(canReferenceDataPersistPolicy('unknown')).toBe(false);
  });
});
