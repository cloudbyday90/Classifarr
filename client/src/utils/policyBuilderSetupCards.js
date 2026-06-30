/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const POLICY_BUILDER_SETUP_STEP_IDS = Object.freeze({
  OBSERVED_APPLICATION: 'observed_application',
  DECLARED_DESTINATION_RULES: 'declared_destination_rules',
  REVIEW_BEHAVIOR: 'review_behavior',
  ROUTING_AND_READINESS: 'routing_and_readiness',
});

const POLICY_BUILDER_SETUP_CARD_STATUS = Object.freeze({
  COMPLETE: 'complete',
  NEEDS_ACTION: 'needs_action',
  OPTIONAL: 'optional',
  LOADING: 'loading',
});

const POLICY_BUILDER_SETUP_ACTION_TARGET_IDS = Object.freeze({
  LIBRARY_CONTEXT: 'policy-builder-library-context',
  INTENT_EDITOR: 'policy-builder-intent-editor',
  DESTINATION_RULES: 'policy-builder-destination-rules',
  REVIEW_BEHAVIOR: 'policy-builder-review-behavior',
  ROUTING_READINESS: 'policy-builder-routing-readiness',
});

const POLICY_BUILDER_SETUP_CARDS = Object.freeze([
  Object.freeze({
    stepId: POLICY_BUILDER_SETUP_STEP_IDS.OBSERVED_APPLICATION,
    heading: 'What already belongs here?',
    helperText: 'Use the current library as suggestions. Accept only the values that should describe this destination going forward.',
    primaryActionLabel: 'Review suggestions',
    emptyState: 'Classifarr has not found enough current-library examples yet. You can still declare what belongs here.',
    completionSignal: 'Accepted observed suggestions become declared destination meaning.',
    termLabels: Object.freeze(['Belongs Here']),
    targetId: POLICY_BUILDER_SETUP_ACTION_TARGET_IDS.LIBRARY_CONTEXT,
  }),
  Object.freeze({
    stepId: POLICY_BUILDER_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
    heading: 'What should always or never belong here?',
    helperText: 'Add explicit operator intent for helpful matches, hard limits, and avoid values.',
    primaryActionLabel: 'Set destination rules',
    emptyState: 'No declared rules yet. Classifarr can use observed evidence, but clear rules improve automation.',
    completionSignal: 'Declared rules can define, block, or warn before this destination is chosen.',
    termLabels: Object.freeze(['Helpful Matches', 'Hard Limits', 'Avoid']),
    targetId: POLICY_BUILDER_SETUP_ACTION_TARGET_IDS.DESTINATION_RULES,
  }),
  Object.freeze({
    stepId: POLICY_BUILDER_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
    heading: 'When should Classifarr ask?',
    helperText: 'Choose review triggers for missing, conflicting, stale, or unsafe evidence.',
    primaryActionLabel: 'Set review triggers',
    emptyState: 'No review triggers configured. Classifarr will still ask when readiness is not safe enough to automate.',
    completionSignal: 'Review behavior controls when Classifarr asks instead of learning or routing automatically.',
    termLabels: Object.freeze(['Ask When Unsure', 'Readiness']),
    targetId: POLICY_BUILDER_SETUP_ACTION_TARGET_IDS.REVIEW_BEHAVIOR,
  }),
  Object.freeze({
    stepId: POLICY_BUILDER_SETUP_STEP_IDS.ROUTING_AND_READINESS,
    heading: 'Can this destination route?',
    helperText: 'Confirm where approved matches can be sent and show the next setup action when routing is incomplete.',
    primaryActionLabel: 'Check routing readiness',
    emptyState: 'No routing target is ready yet. Classification can still review matches before routing is enabled.',
    completionSignal: 'Routing readiness confirms the destination can apply approved matches safely.',
    termLabels: Object.freeze(['Routing Target', 'Readiness']),
    targetId: POLICY_BUILDER_SETUP_ACTION_TARGET_IDS.ROUTING_READINESS,
  }),
]);

function listPolicyBuilderSetupCards() {
  return POLICY_BUILDER_SETUP_CARDS;
}

function getPolicyBuilderSetupCard(stepId) {
  return POLICY_BUILDER_SETUP_CARDS.find(card => card.stepId === stepId) || null;
}

function asCount(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function hasLibrary(library, form = {}) {
  return Boolean(library?.id || form?.library_id || form?.libraryId)
}

function getIntentCounts(intentSummary = {}) {
  return intentSummary?.counts && typeof intentSummary.counts === 'object'
    ? intentSummary.counts
    : {}
}

function sumCounts(counts, keys) {
  return keys.reduce((total, key) => total + asCount(counts[key]), 0)
}

function buildObservedApplicationState(context = {}) {
  const librarySelected = hasLibrary(context.library, context.form)
  const genreCount = Array.isArray(context.libraryProfileGenreSummary)
    ? context.libraryProfileGenreSummary.length
    : 0
  const freshnessStatus = context.libraryProfileFreshness?.status

  if (context.libraryProfileLoading) {
    return {
      status: POLICY_BUILDER_SETUP_CARD_STATUS.LOADING,
      statusLabel: 'Checking',
      statusMessage: 'Checking current-library evidence.',
    }
  }

  if (!librarySelected) {
    return {
      status: POLICY_BUILDER_SETUP_CARD_STATUS.NEEDS_ACTION,
      statusLabel: 'Needs library',
      statusMessage: 'Choose a media-server library before reviewing what already belongs here.',
    }
  }

  if (genreCount > 0) {
    return {
      status: POLICY_BUILDER_SETUP_CARD_STATUS.COMPLETE,
      statusLabel: 'Evidence ready',
      statusMessage: `${genreCount} current-library genre ${genreCount === 1 ? 'signal is' : 'signals are'} available as suggestions.`,
    }
  }

  if (freshnessStatus === 'missing' || freshnessStatus === 'stale') {
    return {
      status: POLICY_BUILDER_SETUP_CARD_STATUS.NEEDS_ACTION,
      statusLabel: 'Refresh profile',
      statusMessage: 'Refresh the library profile before relying on observed suggestions.',
    }
  }

  return {
    status: POLICY_BUILDER_SETUP_CARD_STATUS.OPTIONAL,
    statusLabel: 'Sparse evidence',
    statusMessage: 'No current-library suggestions are available yet; you can still declare intent manually.',
  }
}

function buildDestinationRulesState(context = {}) {
  const counts = getIntentCounts(context.intentSummary)
  const declaredCount = sumCounts(counts, [
    'identity_signals',
    'compatibility_signals',
    'strict_constraints',
    'boosters',
    'exclusions',
  ])

  if (declaredCount > 0) {
    return {
      status: POLICY_BUILDER_SETUP_CARD_STATUS.COMPLETE,
      statusLabel: 'Rules started',
      statusMessage: `${declaredCount} declared destination ${declaredCount === 1 ? 'signal is' : 'signals are'} in the draft.`,
    }
  }

  return {
    status: POLICY_BUILDER_SETUP_CARD_STATUS.NEEDS_ACTION,
    statusLabel: 'Needs rules',
    statusMessage: 'Add at least one belongs-here, helpful, hard-limit, boost, or avoid signal.',
  }
}

function buildReviewBehaviorState(context = {}) {
  const counts = getIntentCounts(context.intentSummary)
  const reviewTriggerCount = asCount(counts.review_triggers)

  if (reviewTriggerCount > 0) {
    return {
      status: POLICY_BUILDER_SETUP_CARD_STATUS.COMPLETE,
      statusLabel: 'Review set',
      statusMessage: `${reviewTriggerCount} ask-when-unsure ${reviewTriggerCount === 1 ? 'trigger is' : 'triggers are'} configured.`,
    }
  }

  return {
    status: POLICY_BUILDER_SETUP_CARD_STATUS.OPTIONAL,
    statusLabel: 'Default checks',
    statusMessage: 'No operator-declared triggers yet; Classifarr can still ask when readiness is unsafe.',
  }
}

function buildRoutingReadinessState(context = {}) {
  const readiness = context.routingReadiness || {}

  if (readiness.canRoute) {
    return {
      status: POLICY_BUILDER_SETUP_CARD_STATUS.COMPLETE,
      statusLabel: 'Ready',
      statusMessage: readiness.label || 'Routing target is ready.',
    }
  }

  return {
    status: POLICY_BUILDER_SETUP_CARD_STATUS.NEEDS_ACTION,
    statusLabel: 'Needs setup',
    statusMessage: readiness.label || 'Check routing readiness before relying on automatic routing.',
  }
}

function buildPolicyBuilderSetupCardState(stepId, context = {}) {
  if (stepId === POLICY_BUILDER_SETUP_STEP_IDS.OBSERVED_APPLICATION) {
    return buildObservedApplicationState(context)
  }

  if (stepId === POLICY_BUILDER_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES) {
    return buildDestinationRulesState(context)
  }

  if (stepId === POLICY_BUILDER_SETUP_STEP_IDS.REVIEW_BEHAVIOR) {
    return buildReviewBehaviorState(context)
  }

  if (stepId === POLICY_BUILDER_SETUP_STEP_IDS.ROUTING_AND_READINESS) {
    return buildRoutingReadinessState(context)
  }

  return {
    status: POLICY_BUILDER_SETUP_CARD_STATUS.OPTIONAL,
    statusLabel: 'Optional',
    statusMessage: 'This setup step is optional.',
  }
}

function buildPolicyBuilderSetupCardViewModels(context = {}) {
  const hasStarterTemplate = asCount(context.selectedPresetCount) > 0 ||
    (Array.isArray(context.selectedPresets) && context.selectedPresets.length > 0)
  const cards = POLICY_BUILDER_SETUP_CARDS.map(card => ({
    ...card,
    targetId: resolvePolicyBuilderSetupCardTargetId(card, { hasStarterTemplate }),
    state: buildPolicyBuilderSetupCardState(card.stepId, context),
  }))
  const recommendedStepId = findRecommendedSetupStepId(cards)

  return cards.map(card => ({
    ...card,
    isRecommendedNextAction: card.stepId === recommendedStepId,
  }))
}

function resolvePolicyBuilderSetupCardTargetId(card, { hasStarterTemplate } = {}) {
  if (hasStarterTemplate) return card.targetId

  if ([
    POLICY_BUILDER_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
    POLICY_BUILDER_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
  ].includes(card.stepId)) {
    return POLICY_BUILDER_SETUP_ACTION_TARGET_IDS.INTENT_EDITOR
  }

  return card.targetId
}

function findRecommendedSetupStepId(cards = []) {
  const needsAction = cards.find(card => card.state?.status === POLICY_BUILDER_SETUP_CARD_STATUS.NEEDS_ACTION)
  if (needsAction) return needsAction.stepId

  const optional = cards.find(card => card.state?.status === POLICY_BUILDER_SETUP_CARD_STATUS.OPTIONAL)
  if (optional) return optional.stepId

  return null
}

export {
  POLICY_BUILDER_SETUP_CARDS,
  POLICY_BUILDER_SETUP_ACTION_TARGET_IDS,
  POLICY_BUILDER_SETUP_CARD_STATUS,
  POLICY_BUILDER_SETUP_STEP_IDS,
  buildPolicyBuilderSetupCardState,
  buildPolicyBuilderSetupCardViewModels,
  getPolicyBuilderSetupCard,
  listPolicyBuilderSetupCards,
};
