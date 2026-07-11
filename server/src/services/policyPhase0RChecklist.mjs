const PHASE_0R_CHECKLIST_ITEM_IDS = Object.freeze({
  SOURCE_OF_TRUTH_IDENTIFIED: 'source_of_truth_identified',
  AUTHORITY_LEVEL_IDENTIFIED: 'authority_level_identified',
  LEARNING_SIDE_EFFECT_IDENTIFIED: 'learning_side_effect_identified',
  ROLLBACK_MIGRATION_IMPACT_IDENTIFIED: 'rollback_migration_impact_identified',
  OPERATOR_LANGUAGE_VALIDATED: 'operator_language_validated',
});

const PHASE_0R_ALIGNMENT_CATEGORIES = Object.freeze({
  REPLACE_PRODUCT_LANGUAGE: 'replace_product_language',
  LEGACY_INTERNAL_ONLY: 'legacy_internal_only',
  MAINTAINER_DIAGNOSTIC_ONLY: 'maintainer_diagnostic_only',
});

const PHASE_0R_IMPLEMENTATION_PHASE_IDS = Object.freeze({
  AUTHORITY_VOCABULARY: '0R.1',
  USER_MENTAL_MODEL: '0R.2',
  LEGACY_COMPATIBILITY_VOCABULARY: '0R.3',
  QUESTION_LEARNING_VOCABULARY: '0R.4',
  DOCUMENTATION_TEST_ALIGNMENT: '0R.5',
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

const PHASE_0R_CHECKLIST_ITEMS = deepFreeze([
  {
    id: PHASE_0R_CHECKLIST_ITEM_IDS.SOURCE_OF_TRUTH_IDENTIFIED,
    label: 'Source of truth identified',
    question: 'Which source owns the meaning for this change?',
    required: true,
    evidenceRequired: [
      'media-server observed application',
      'operator-declared intent',
      'manual final outcome',
      'AI suggestion',
      'metadata evidence',
      'legacy compatibility bridge',
    ],
    failureMode: 'The change can blur observed evidence, declared intent, AI output, and final outcome.',
  },
  {
    id: PHASE_0R_CHECKLIST_ITEM_IDS.AUTHORITY_LEVEL_IDENTIFIED,
    label: 'Authority level identified',
    question: 'What authority level is allowed to decide, suggest, or persist this behavior?',
    required: true,
    evidenceRequired: [
      'observed evidence',
      'declared intent',
      'guarded learning candidate',
      'final outcome',
      'enrichment evidence',
      'draft seed',
      'non-authority',
    ],
    failureMode: 'A non-authoritative source can accidentally behave like durable policy intent.',
  },
  {
    id: PHASE_0R_CHECKLIST_ITEM_IDS.LEARNING_SIDE_EFFECT_IDENTIFIED,
    label: 'Learning side effect identified',
    question: 'Does this change create learning, or is learning explicitly absent?',
    required: true,
    evidenceRequired: [
      'no learning side effect',
      'exact-item memory candidate',
      'compatibility evidence candidate',
      'identity evidence candidate',
      'explicit policy edit required',
    ],
    failureMode: 'Resolving one item can silently become a durable broad rule.',
  },
  {
    id: PHASE_0R_CHECKLIST_ITEM_IDS.ROLLBACK_MIGRATION_IMPACT_IDENTIFIED,
    label: 'Rollback or migration impact identified',
    question: 'Does this change affect legacy compatibility, rollback snapshots, or native intent migration?',
    required: true,
    evidenceRequired: [
      'no migration impact',
      'compatibility projection only',
      'rollback snapshot required',
      'native intent migration candidate',
      'legacy deletion gate',
    ],
    failureMode: 'Existing installs can change behavior without an explicit migration or rollback path.',
  },
  {
    id: PHASE_0R_CHECKLIST_ITEM_IDS.OPERATOR_LANGUAGE_VALIDATED,
    label: 'Operator-facing language validated',
    question: 'Does the visible language use Phase 0R vocabulary and avoid internal diagnostics?',
    required: true,
    evidenceRequired: [
      'destination-first wording',
      'observed evidence versus declared intent is clear',
      'runtime questions ask about destination fit',
      'internal diagnostics stay internal or maintainer-only',
      'legacy terms are marked legacy/internal when unavoidable',
    ],
    failureMode: 'Operators are asked to reason about scoring, provider gates, replay parity, or genre priority.',
  },
]);

const PHASE_0R_IMPLEMENTATION_RECORDS = deepFreeze([
  {
    phaseId: PHASE_0R_IMPLEMENTATION_PHASE_IDS.AUTHORITY_VOCABULARY,
    title: 'Authority Vocabulary',
    docPath: 'docs/architecture/policy-builder-phase-0r-authority-vocabulary.md',
    servicePath: 'server/src/services/policyAuthorityVocabulary.mjs',
    testPath: 'server/src/__tests__/services/policyAuthorityVocabulary.test.mjs',
    protects: [
      'source authority boundaries',
      'durable policy authority',
      'AI non-authority',
    ],
  },
  {
    phaseId: PHASE_0R_IMPLEMENTATION_PHASE_IDS.USER_MENTAL_MODEL,
    title: 'User Mental Model',
    docPath: 'docs/architecture/policy-authoring-user-mental-model.md',
    servicePath: 'server/src/services/policyUserMentalModel.mjs',
    testPath: 'server/src/__tests__/services/policyUserMentalModel.test.mjs',
    protects: [
      'destination-first setup language',
      'approved policy UX labels',
      'broad genre framing',
    ],
  },
  {
    phaseId: PHASE_0R_IMPLEMENTATION_PHASE_IDS.LEGACY_COMPATIBILITY_VOCABULARY,
    title: 'Legacy Compatibility Vocabulary',
    docPath: 'docs/architecture/policy-builder-phase-0r-legacy-compatibility-vocabulary.md',
    servicePath: 'server/src/services/policyLegacyCompatibilityVocabulary.mjs',
    testPath: 'server/src/__tests__/services/policyLegacyCompatibilityVocabulary.test.mjs',
    protects: [
      'starter-template language',
      'legacy internal terminology',
      'rollback snapshot boundaries',
    ],
  },
  {
    phaseId: PHASE_0R_IMPLEMENTATION_PHASE_IDS.QUESTION_LEARNING_VOCABULARY,
    title: 'Question And Learning Vocabulary',
    docPath: 'docs/architecture/policy-builder-phase-0r-question-learning-vocabulary.md',
    servicePath: 'server/src/services/policyQuestionLearningVocabulary.mjs',
    testPath: 'server/src/__tests__/services/policyQuestionLearningVocabulary.test.mjs',
    protects: [
      'runtime question framing',
      'answer outcome separation',
      'learning side-effect boundaries',
    ],
  },
  {
    phaseId: PHASE_0R_IMPLEMENTATION_PHASE_IDS.DOCUMENTATION_TEST_ALIGNMENT,
    title: 'Documentation And Test Alignment',
    docPath: 'docs/architecture/policy-builder-phase-0r-documentation-test-alignment.md',
    servicePath: 'server/src/services/policyPhase0RChecklist.mjs',
    testPath: 'server/src/__tests__/services/policyPhase0RChecklist.test.mjs',
    protects: [
      'future implementation checklist',
      'stale terminology classification',
      'Phase 1R entry guardrails',
    ],
  },
]);

const PHASE_0R_TERMINOLOGY_FLAGS = deepFreeze([
  {
    category: PHASE_0R_ALIGNMENT_CATEGORIES.REPLACE_PRODUCT_LANGUAGE,
    phrases: [
      'genre priority',
      'which genre should be prioritized',
      'which genre is most prominent',
      'scoring weight',
      'score weight',
    ],
    reason: 'Product language should ask about destination fit and readiness, not scoring or broad genre priority.',
    replacement: 'Use destination-first Phase 0R vocabulary.',
  },
  {
    category: PHASE_0R_ALIGNMENT_CATEGORIES.LEGACY_INTERNAL_ONLY,
    phrases: [
      'customSignals',
      'custom_signals',
      'policy_presets',
      'content_presets',
      'raw preset',
      'legacy preset',
    ],
    reason: 'Legacy payload names are allowed in storage, API, bridge, migration, and rollback docs only.',
    replacement: 'Use starter template, compatibility bridge, rollback snapshot, or native intent storage.',
  },
  {
    category: PHASE_0R_ALIGNMENT_CATEGORIES.MAINTAINER_DIAGNOSTIC_ONLY,
    phrases: [
      'provider gate',
      'replay parity',
      'tmdb coverage',
      'representative replay',
      'impact preview',
    ],
    reason: 'Diagnostics can support tests and migration verification but should not define the normal operator workflow.',
    replacement: 'Use readiness, evidence quality, route availability, or migration verifier language.',
  },
]);

function listPhase0RChecklistItems() {
  return PHASE_0R_CHECKLIST_ITEMS;
}

function getPhase0RChecklistItem(itemId) {
  return PHASE_0R_CHECKLIST_ITEMS.find(item => item.id === itemId) || null;
}

function listPhase0RImplementationRecords() {
  return PHASE_0R_IMPLEMENTATION_RECORDS;
}

function getPhase0RImplementationRecord(phaseId) {
  return PHASE_0R_IMPLEMENTATION_RECORDS.find(record => record.phaseId === phaseId) || null;
}

function listPhase0RTerminologyFlags() {
  return PHASE_0R_TERMINOLOGY_FLAGS;
}

function isChecklistItemSatisfied(value) {
  if (value === true) {
    return true;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  return value.satisfied === true || value.status === 'satisfied';
}

function validatePhase0RChecklistResponse(response = {}) {
  const missingItems = PHASE_0R_CHECKLIST_ITEMS
    .filter(item => item.required)
    .filter(item => !isChecklistItemSatisfied(response[item.id]))
    .map(item => ({
      id: item.id,
      label: item.label,
      question: item.question,
    }));

  return {
    valid: missingItems.length === 0,
    missingItemIds: missingItems.map(item => item.id),
    missingItems,
  };
}

function findPhase0RTerminologyFlags(text) {
  const normalizedText = String(text || '').toLowerCase();

  if (!normalizedText) {
    return [];
  }

  return PHASE_0R_TERMINOLOGY_FLAGS
    .map(flag => ({
      ...flag,
      matchedPhrases: flag.phrases.filter(phrase => normalizedText.includes(phrase.toLowerCase())),
    }))
    .filter(flag => flag.matchedPhrases.length > 0);
}

function hasPhase0RTerminologyFlags(text) {
  return findPhase0RTerminologyFlags(text).length > 0;
}

export {
  PHASE_0R_ALIGNMENT_CATEGORIES,
  PHASE_0R_CHECKLIST_ITEM_IDS,
  PHASE_0R_IMPLEMENTATION_PHASE_IDS,
  findPhase0RTerminologyFlags,
  getPhase0RChecklistItem,
  getPhase0RImplementationRecord,
  hasPhase0RTerminologyFlags,
  listPhase0RChecklistItems,
  listPhase0RImplementationRecords,
  listPhase0RTerminologyFlags,
  validatePhase0RChecklistResponse,
};
