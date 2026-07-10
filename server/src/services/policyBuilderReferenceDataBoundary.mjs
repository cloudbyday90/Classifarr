const REFERENCE_DATA_CATEGORY_IDS = Object.freeze({
  STATIC_OPTION: 'static_option',
  CONFIGURED_LIBRARY: 'configured_library',
  STARTER_TEMPLATE: 'starter_template',
  OBSERVED_PROFILE_SUGGESTION: 'observed_profile_suggestion',
  ROUTING_MAPPING_STATUS: 'routing_mapping_status',
  MIGRATION_NOTICE: 'migration_notice',
  SERVER_PROJECTION_DISPLAY: 'server_projection_display',
});

const REFERENCE_DATA_SOURCE_IDS = Object.freeze({
  STATIC_PRESET_SIGNAL_VALUES: 'static_preset_signal_values',
  MEDIA_SERVER_LIBRARY_LIST: 'media_server_library_list',
  ATTACHABLE_PRESETS: 'attachable_presets',
  PRESET_SUGGESTIONS: 'preset_suggestions',
  LIBRARY_PROFILE: 'library_profile',
  LIBRARY_PROFILE_REFRESH: 'library_profile_refresh',
  GENERAL_SETTINGS_MIGRATION_REPORT: 'general_settings_migration_report',
  FUTURE_ROUTING_STATUS_ENDPOINT: 'future_routing_status_endpoint',
});

const REFERENCE_DATA_AUTHORITY_IDS = Object.freeze({
  OPTION_ONLY: 'option_only',
  CONFIGURATION_CONTEXT: 'configuration_context',
  DRAFT_SEED: 'draft_seed',
  OBSERVED_EVIDENCE: 'observed_evidence',
  READINESS_CONTEXT: 'readiness_context',
  MIGRATION_CONTEXT: 'migration_context',
  NON_AUTHORITY_DISPLAY: 'non_authority_display',
});

const REFERENCE_DATA_RISK_IDS = Object.freeze({
  OPTION_EVIDENCE_CONFUSION: 'option_evidence_confusion',
  CLIENT_READINESS_INFERENCE: 'client_readiness_inference',
  PROVIDER_PAYLOAD_LEAK: 'provider_payload_leak',
  MIGRATION_STATE_CONFUSION: 'migration_state_confusion',
  ROUTING_STATUS_MISSING: 'routing_status_missing',
});

const REFERENCE_DATA_OPTION_SOURCE_IDS = Object.freeze({
  LIBRARY_PROFILE: 'library_profile',
  PRESET_REFERENCE: 'preset_reference',
});

const REFERENCE_DATA_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_RECORD: 'unknown_record',
  OPTION_AUTHORITY_MISMATCH: 'option_authority_mismatch',
  OBSERVED_EVIDENCE_SOURCE_MISMATCH: 'observed_evidence_source_mismatch',
  OBSERVED_EVIDENCE_NOT_MARKED_SUGGESTIVE: 'observed_evidence_not_marked_suggestive',
  CLIENT_READINESS_COMPUTATION: 'client_readiness_computation',
  POLICY_PERSISTENCE: 'policy_persistence',
  FUTURE_ROUTING_HAS_CLIENT_PATH: 'future_routing_has_client_path',
  MIGRATION_NOTICE_SUGGESTS_INTENT: 'migration_notice_suggests_intent',
  INVALID_OPTION_SOURCE: 'invalid_option_source',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  Object.values(value).forEach(item => {
    deepFreeze(item);
  });

  return value;
}

const REFERENCE_DATA_RECORDS = deepFreeze([
  {
    id: 'available_ratings',
    label: 'Available ratings',
    category: REFERENCE_DATA_CATEGORY_IDS.STATIC_OPTION,
    sourceId: REFERENCE_DATA_SOURCE_IDS.STATIC_PRESET_SIGNAL_VALUES,
    authorityId: REFERENCE_DATA_AUTHORITY_IDS.OPTION_ONLY,
    owner: 'usePolicyBuilderReferenceData',
    currentPath: 'availableRatings',
    maySuggestIntent: false,
    mayComputeReadiness: false,
    mayPersistPolicy: false,
    notes: 'Static rating values collected from attachable starter-template signals.',
  },
  {
    id: 'preset_genres',
    label: 'Starter-template genres',
    category: REFERENCE_DATA_CATEGORY_IDS.STATIC_OPTION,
    sourceId: REFERENCE_DATA_SOURCE_IDS.STATIC_PRESET_SIGNAL_VALUES,
    authorityId: REFERENCE_DATA_AUTHORITY_IDS.OPTION_ONLY,
    owner: 'usePolicyBuilderReferenceData',
    currentPath: 'presetGenres',
    maySuggestIntent: false,
    mayComputeReadiness: false,
    mayPersistPolicy: false,
    notes: 'Static genre values available from starter-template signals.',
  },
  {
    id: 'libraries',
    label: 'Configured libraries',
    category: REFERENCE_DATA_CATEGORY_IDS.CONFIGURED_LIBRARY,
    sourceId: REFERENCE_DATA_SOURCE_IDS.MEDIA_SERVER_LIBRARY_LIST,
    authorityId: REFERENCE_DATA_AUTHORITY_IDS.CONFIGURATION_CONTEXT,
    owner: 'usePolicyBuilderReferenceData',
    currentPath: 'libraries',
    maySuggestIntent: false,
    mayComputeReadiness: false,
    mayPersistPolicy: false,
    notes: 'Configured destination context only; contents and observed profile are separate.',
  },
  {
    id: 'attachable_presets',
    label: 'Attachable starter templates',
    category: REFERENCE_DATA_CATEGORY_IDS.STARTER_TEMPLATE,
    sourceId: REFERENCE_DATA_SOURCE_IDS.ATTACHABLE_PRESETS,
    authorityId: REFERENCE_DATA_AUTHORITY_IDS.DRAFT_SEED,
    owner: 'usePolicyBuilderReferenceData',
    currentPath: 'allPresets',
    maySuggestIntent: true,
    mayComputeReadiness: false,
    mayPersistPolicy: false,
    notes: 'Starter templates seed draft intent but are not durable authority.',
  },
  {
    id: 'preset_suggestions',
    label: 'Suggested starter templates',
    category: REFERENCE_DATA_CATEGORY_IDS.STARTER_TEMPLATE,
    sourceId: REFERENCE_DATA_SOURCE_IDS.PRESET_SUGGESTIONS,
    authorityId: REFERENCE_DATA_AUTHORITY_IDS.DRAFT_SEED,
    owner: 'usePolicyBuilderReferenceData',
    currentPath: 'suggestedPresets',
    maySuggestIntent: true,
    mayComputeReadiness: false,
    mayPersistPolicy: false,
    notes: 'Suggestions can seed operator review, not write policy by themselves.',
  },
  {
    id: 'library_profile',
    label: 'Library profile',
    category: REFERENCE_DATA_CATEGORY_IDS.OBSERVED_PROFILE_SUGGESTION,
    sourceId: REFERENCE_DATA_SOURCE_IDS.LIBRARY_PROFILE,
    authorityId: REFERENCE_DATA_AUTHORITY_IDS.OBSERVED_EVIDENCE,
    owner: 'usePolicyBuilderReferenceData',
    currentPath: 'libraryProfile',
    maySuggestIntent: true,
    mayComputeReadiness: false,
    mayPersistPolicy: false,
    notes: 'Observed media-server application can suggest intent but cannot create learning or hard limits by itself.',
  },
  {
    id: 'library_profile_genre_options',
    label: 'Library profile genre options',
    category: REFERENCE_DATA_CATEGORY_IDS.OBSERVED_PROFILE_SUGGESTION,
    sourceId: REFERENCE_DATA_SOURCE_IDS.LIBRARY_PROFILE,
    authorityId: REFERENCE_DATA_AUTHORITY_IDS.OBSERVED_EVIDENCE,
    owner: 'policyBuilderLibraryGenreOptions',
    currentPath: 'availableGenreOptions',
    maySuggestIntent: true,
    mayComputeReadiness: false,
    mayPersistPolicy: false,
    notes: 'Evidence-backed options must remain distinguishable from static starter-template options.',
  },
  {
    id: 'library_profile_freshness',
    label: 'Library profile freshness',
    category: REFERENCE_DATA_CATEGORY_IDS.SERVER_PROJECTION_DISPLAY,
    sourceId: REFERENCE_DATA_SOURCE_IDS.LIBRARY_PROFILE,
    authorityId: REFERENCE_DATA_AUTHORITY_IDS.NON_AUTHORITY_DISPLAY,
    owner: 'policyBuilderProfileFreshness',
    currentPath: 'libraryProfileFreshness',
    maySuggestIntent: false,
    mayComputeReadiness: false,
    mayPersistPolicy: false,
    notes: 'Client freshness labels guide operator action but do not decide automation readiness.',
  },
  {
    id: 'library_profile_refresh_result',
    label: 'Library profile refresh result',
    category: REFERENCE_DATA_CATEGORY_IDS.SERVER_PROJECTION_DISPLAY,
    sourceId: REFERENCE_DATA_SOURCE_IDS.LIBRARY_PROFILE_REFRESH,
    authorityId: REFERENCE_DATA_AUTHORITY_IDS.NON_AUTHORITY_DISPLAY,
    owner: 'policyBuilderProfileRefreshResult',
    currentPath: 'libraryProfileRefreshResult',
    maySuggestIntent: false,
    mayComputeReadiness: false,
    mayPersistPolicy: false,
    notes: 'Refresh result describes available profile signals after refresh.',
  },
  {
    id: 'routing_mapping_status',
    label: 'Routing and mapping status',
    category: REFERENCE_DATA_CATEGORY_IDS.ROUTING_MAPPING_STATUS,
    sourceId: REFERENCE_DATA_SOURCE_IDS.FUTURE_ROUTING_STATUS_ENDPOINT,
    authorityId: REFERENCE_DATA_AUTHORITY_IDS.READINESS_CONTEXT,
    owner: 'future server-owned readiness projection',
    currentPath: null,
    maySuggestIntent: false,
    mayComputeReadiness: false,
    mayPersistPolicy: false,
    notes: 'Current reference data lacks a dedicated routing readiness projection; future server endpoint should own it.',
  },
  {
    id: 'preset_migration_notice',
    label: 'Preset migration notice',
    category: REFERENCE_DATA_CATEGORY_IDS.MIGRATION_NOTICE,
    sourceId: REFERENCE_DATA_SOURCE_IDS.GENERAL_SETTINGS_MIGRATION_REPORT,
    authorityId: REFERENCE_DATA_AUTHORITY_IDS.MIGRATION_CONTEXT,
    owner: 'usePolicyBuilderReferenceData',
    currentPath: 'presetMigrationNotice',
    maySuggestIntent: false,
    mayComputeReadiness: false,
    mayPersistPolicy: false,
    notes: 'Migration notice is context only and must not mutate policy drafts.',
  },
]);

function listReferenceDataRecords() {
  return REFERENCE_DATA_RECORDS;
}

function getReferenceDataRecord(recordId) {
  return REFERENCE_DATA_RECORDS.find(record => record.id === recordId) || null;
}

function listReferenceDataRecordsByCategory(categoryId) {
  return REFERENCE_DATA_RECORDS.filter(record => record.category === categoryId);
}

function isReferenceDataObservedEvidence(recordId) {
  return getReferenceDataRecord(recordId)?.authorityId === REFERENCE_DATA_AUTHORITY_IDS.OBSERVED_EVIDENCE;
}

function canReferenceDataComputeReadiness(recordId) {
  return getReferenceDataRecord(recordId)?.mayComputeReadiness === true;
}

function canReferenceDataPersistPolicy(recordId) {
  return getReferenceDataRecord(recordId)?.mayPersistPolicy === true;
}

function summarizeReferenceDataBoundary() {
  const countsByCategory = REFERENCE_DATA_RECORDS.reduce((counts, record) => {
    counts[record.category] = (counts[record.category] || 0) + 1;
    return counts;
  }, {});

  return {
    total: REFERENCE_DATA_RECORDS.length,
    countsByCategory,
    observedEvidenceRecordIds: REFERENCE_DATA_RECORDS
      .filter(record => record.authorityId === REFERENCE_DATA_AUTHORITY_IDS.OBSERVED_EVIDENCE)
      .map(record => record.id),
    staticOptionRecordIds: REFERENCE_DATA_RECORDS
      .filter(record => record.category === REFERENCE_DATA_CATEGORY_IDS.STATIC_OPTION)
      .map(record => record.id),
    futureServerProjectionRecordIds: REFERENCE_DATA_RECORDS
      .filter(record => record.sourceId === REFERENCE_DATA_SOURCE_IDS.FUTURE_ROUTING_STATUS_ENDPOINT)
      .map(record => record.id),
  };
}

function validateReferenceDataRecord(record = {}) {
  const canonicalRecord = getReferenceDataRecord(record.id);
  const candidate = {
    ...canonicalRecord,
    ...record,
  };
  const issues = [];

  if (!canonicalRecord) {
    issues.push({
      riskId: REFERENCE_DATA_AUDIT_RISK_IDS.UNKNOWN_RECORD,
      recordId: record.id,
      message: 'Reference data record is not part of the reference-data boundary contract.',
    });
  }

  if (candidate.category === REFERENCE_DATA_CATEGORY_IDS.STATIC_OPTION &&
      candidate.authorityId !== REFERENCE_DATA_AUTHORITY_IDS.OPTION_ONLY) {
    issues.push({
      riskId: REFERENCE_DATA_AUDIT_RISK_IDS.OPTION_AUTHORITY_MISMATCH,
      recordId: record.id,
      message: 'Static options must remain option-only reference data.',
    });
  }

  if (candidate.authorityId === REFERENCE_DATA_AUTHORITY_IDS.OBSERVED_EVIDENCE &&
      candidate.sourceId !== REFERENCE_DATA_SOURCE_IDS.LIBRARY_PROFILE) {
    issues.push({
      riskId: REFERENCE_DATA_AUDIT_RISK_IDS.OBSERVED_EVIDENCE_SOURCE_MISMATCH,
      recordId: record.id,
      message: 'Observed evidence reference data must come from the library profile source.',
    });
  }

  if (candidate.authorityId === REFERENCE_DATA_AUTHORITY_IDS.OBSERVED_EVIDENCE &&
      candidate.maySuggestIntent !== true) {
    issues.push({
      riskId: REFERENCE_DATA_AUDIT_RISK_IDS.OBSERVED_EVIDENCE_NOT_MARKED_SUGGESTIVE,
      recordId: record.id,
      message: 'Observed evidence records should be explicit suggestions, not hidden policy rules.',
    });
  }

  if (candidate.mayComputeReadiness === true) {
    issues.push({
      riskId: REFERENCE_DATA_AUDIT_RISK_IDS.CLIENT_READINESS_COMPUTATION,
      recordId: record.id,
      message: 'Reference data cannot compute automation readiness in the client.',
    });
  }

  if (candidate.mayPersistPolicy === true) {
    issues.push({
      riskId: REFERENCE_DATA_AUDIT_RISK_IDS.POLICY_PERSISTENCE,
      recordId: record.id,
      message: 'Reference data cannot persist policy state directly.',
    });
  }

  if (candidate.sourceId === REFERENCE_DATA_SOURCE_IDS.FUTURE_ROUTING_STATUS_ENDPOINT &&
      candidate.currentPath) {
    issues.push({
      riskId: REFERENCE_DATA_AUDIT_RISK_IDS.FUTURE_ROUTING_HAS_CLIENT_PATH,
      recordId: record.id,
      message: 'Future routing readiness must remain a server projection until implemented.',
    });
  }

  if (candidate.category === REFERENCE_DATA_CATEGORY_IDS.MIGRATION_NOTICE &&
      candidate.maySuggestIntent === true) {
    issues.push({
      riskId: REFERENCE_DATA_AUDIT_RISK_IDS.MIGRATION_NOTICE_SUGGESTS_INTENT,
      recordId: record.id,
      message: 'Migration notices are context only and cannot suggest policy intent.',
    });
  }

  return {
    ok: issues.length === 0,
    recordId: record.id,
    issues,
  };
}

function validateReferenceDataOption(option = {}) {
  const source = typeof option?.source === 'string' ? option.source : '';
  const value = typeof option?.value === 'string' ? option.value.trim() : '';

  if (!value) {
    return {
      valid: false,
      authorityId: null,
      reason: 'Option value is required.',
    };
  }

  if (source === REFERENCE_DATA_OPTION_SOURCE_IDS.LIBRARY_PROFILE) {
    return {
      valid: true,
      authorityId: REFERENCE_DATA_AUTHORITY_IDS.OBSERVED_EVIDENCE,
      reason: 'Option is backed by observed library profile evidence.',
    };
  }

  if (source === REFERENCE_DATA_OPTION_SOURCE_IDS.PRESET_REFERENCE || !source) {
    return {
      valid: true,
      authorityId: REFERENCE_DATA_AUTHORITY_IDS.OPTION_ONLY,
      reason: 'Option is a static starter-template value, not observed evidence.',
    };
  }

  return {
    valid: false,
    authorityId: null,
    reason: 'Unknown option source.',
  };
}

function buildReferenceDataOptionAudit(options = []) {
  const optionResults = (Array.isArray(options) ? options : [])
    .map(option => ({
      option,
      result: validateReferenceDataOption(option),
    }));
  const issues = optionResults
    .filter(({ result }) => !result.valid)
    .map(({ option, result }) => ({
      riskId: REFERENCE_DATA_AUDIT_RISK_IDS.INVALID_OPTION_SOURCE,
      option,
      reason: result.reason,
      message: 'Reference data option has invalid value or provenance.',
    }));

  return {
    ok: issues.length === 0,
    checkedOptionCount: optionResults.length,
    optionResults,
    issues,
  };
}

function buildReferenceDataBoundaryAudit(records = REFERENCE_DATA_RECORDS) {
  const recordResults = (Array.isArray(records) ? records : [])
    .map(record => validateReferenceDataRecord(record));
  const issues = recordResults.flatMap(result => result.issues);

  return {
    ok: issues.length === 0,
    checkedRecordCount: recordResults.length,
    recordResults,
    issues,
  };
}

export {
  REFERENCE_DATA_AUDIT_RISK_IDS,
  REFERENCE_DATA_AUTHORITY_IDS,
  REFERENCE_DATA_CATEGORY_IDS,
  REFERENCE_DATA_OPTION_SOURCE_IDS,
  REFERENCE_DATA_RISK_IDS,
  REFERENCE_DATA_SOURCE_IDS,
  buildReferenceDataBoundaryAudit,
  buildReferenceDataOptionAudit,
  canReferenceDataComputeReadiness,
  canReferenceDataPersistPolicy,
  getReferenceDataRecord,
  isReferenceDataObservedEvidence,
  listReferenceDataRecords,
  listReferenceDataRecordsByCategory,
  summarizeReferenceDataBoundary,
  validateReferenceDataRecord,
  validateReferenceDataOption,
};
