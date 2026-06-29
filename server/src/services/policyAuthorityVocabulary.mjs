const AUTHORITY_LEVELS = Object.freeze({
  OBSERVED_EVIDENCE: 'observed_evidence',
  DECLARED_INTENT: 'declared_intent',
  GUARDED_LEARNING_CANDIDATE: 'guarded_learning_candidate',
  FINAL_OUTCOME: 'final_outcome',
  ENRICHMENT_EVIDENCE: 'enrichment_evidence',
  DRAFT_SEED: 'draft_seed',
  NON_AUTHORITY: 'non_authority',
});

const AUTHORITY_SOURCE_IDS = Object.freeze({
  MEDIA_SERVER_CONTENTS: 'media_server_contents',
  OPERATOR_DECLARED_INTENT: 'operator_declared_intent',
  MANUAL_OUTCOME: 'manual_outcome',
  AI_OUTPUT: 'ai_output',
  METADATA_PROVIDER: 'metadata_provider',
  LEGACY_TEMPLATE: 'legacy_template',
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

const POLICY_AUTHORITY_SOURCES = deepFreeze([
  {
    id: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    term: 'Observed application',
    authorityLevel: AUTHORITY_LEVELS.OBSERVED_EVIDENCE,
    owns: [
      'What currently exists in a connected media-server library.',
      'Which destination the operator has already used for existing items.',
    ],
    allowed: [
      'Seed observed-profile evidence.',
      'Suggest belongs-here, helpful, avoid, or review candidates.',
      'Support automation readiness when evidence quality is sufficient.',
    ],
    prohibited: [
      'Create hard limits without operator confirmation.',
      'Override declared intent.',
      'Authorize durable learning by itself.',
    ],
    durablePolicyAuthority: false,
    learningEligibleByDefault: false,
  },
  {
    id: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    term: 'Declared intent',
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    owns: [
      'What the operator explicitly says should belong or not belong.',
      'Hard limits and avoid rules that can block routing or classification.',
    ],
    allowed: [
      'Become durable policy intent after server validation.',
      'Override noisy observed evidence.',
      'Define destination identity, constraints, and review behavior.',
    ],
    prohibited: [
      'Bypass server-side validation.',
      'Mutate legacy or native storage through raw client state.',
    ],
    durablePolicyAuthority: true,
    learningEligibleByDefault: false,
  },
  {
    id: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    term: 'Final outcome',
    authorityLevel: AUTHORITY_LEVELS.FINAL_OUTCOME,
    owns: [
      'What happened to one classification or routing decision.',
      'The operator-selected resolution for a specific pending item.',
    ],
    allowed: [
      'Resolve the current item.',
      'Create a learning candidate only when the learning guard marks it eligible.',
      'Feed audit and decision history.',
    ],
    prohibited: [
      'Become a broad rule automatically.',
      'Create hard limits without explicit policy edit.',
      'Change policy intent when the question contract marks the answer non-learning.',
    ],
    durablePolicyAuthority: false,
    learningEligibleByDefault: false,
  },
  {
    id: AUTHORITY_SOURCE_IDS.AI_OUTPUT,
    term: 'AI suggestion',
    authorityLevel: AUTHORITY_LEVELS.NON_AUTHORITY,
    owns: [
      'Candidate explanations, uncertainty hints, and structured suggestions.',
    ],
    allowed: [
      'Suggest uncertainty or evidence for deterministic normalization.',
      'Explain why a decision needs review.',
      'Propose intent changes for later validation and operator review.',
    ],
    prohibited: [
      'Authorize durable learning.',
      'Write policy intent directly.',
      'Own final question text without server normalization.',
      'Execute routing or provider actions without deterministic gates.',
    ],
    durablePolicyAuthority: false,
    learningEligibleByDefault: false,
  },
  {
    id: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    term: 'Metadata evidence',
    authorityLevel: AUTHORITY_LEVELS.ENRICHMENT_EVIDENCE,
    owns: [
      'External facts used to enrich an item or library profile.',
      'Provider availability, freshness, and confidence signals.',
    ],
    allowed: [
      'Improve evidence completeness.',
      'Support observed-profile quality and decision confidence.',
      'Contribute to readiness when provider data is trusted and current.',
    ],
    prohibited: [
      'Own policy meaning.',
      'Create destination identity without corroborating intent or observed evidence.',
      'Expose provider payloads, credentials, or cache keys to product UI.',
    ],
    durablePolicyAuthority: false,
    learningEligibleByDefault: false,
  },
  {
    id: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    term: 'Starter template',
    authorityLevel: AUTHORITY_LEVELS.DRAFT_SEED,
    owns: [
      'A reusable shortcut for drafting policy intent.',
      'Legacy preset/custom-signal compatibility while migration is incomplete.',
    ],
    allowed: [
      'Seed an editable intent draft.',
      'Preserve existing policy behavior through compatibility bridges.',
      'Provide provenance for migrated or template-seeded drafts.',
    ],
    prohibited: [
      'Remain the durable authority model after native intent conversion.',
      'Obscure observed library evidence.',
      'Bypass deletion gates for replaced legacy behavior.',
    ],
    durablePolicyAuthority: false,
    learningEligibleByDefault: false,
  },
]);

const POLICY_AUTHORITY_GLOSSARY = deepFreeze([
  {
    term: 'Observed application',
    definition: 'Evidence from existing media-server library contents and placement.',
  },
  {
    term: 'Declared intent',
    definition: 'Operator-authored policy meaning after server validation.',
  },
  {
    term: 'Evidence',
    definition: 'Normalized facts that may support an intent, decision, or readiness state.',
  },
  {
    term: 'Learning',
    definition: 'A guarded durable update derived from eligible outcomes, not every answer.',
  },
  {
    term: 'Starter template',
    definition: 'A shortcut that seeds a draft; it is not the future policy authority model.',
  },
]);

function listPolicyAuthoritySources() {
  return POLICY_AUTHORITY_SOURCES;
}

function getPolicyAuthoritySource(sourceId) {
  return POLICY_AUTHORITY_SOURCES.find(source => source.id === sourceId) || null;
}

function listPolicyAuthorityGlossary() {
  return POLICY_AUTHORITY_GLOSSARY;
}

function isDurablePolicyAuthority(sourceId) {
  return Boolean(getPolicyAuthoritySource(sourceId)?.durablePolicyAuthority);
}

function isLearningEligibleByDefault(sourceId) {
  return Boolean(getPolicyAuthoritySource(sourceId)?.learningEligibleByDefault);
}

export {
  AUTHORITY_LEVELS,
  AUTHORITY_SOURCE_IDS,
  getPolicyAuthoritySource,
  isDurablePolicyAuthority,
  isLearningEligibleByDefault,
  listPolicyAuthorityGlossary,
  listPolicyAuthoritySources,
};
