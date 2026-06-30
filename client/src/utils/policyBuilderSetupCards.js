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

const POLICY_BUILDER_SETUP_CARDS = Object.freeze([
  Object.freeze({
    stepId: POLICY_BUILDER_SETUP_STEP_IDS.OBSERVED_APPLICATION,
    heading: 'What already belongs here?',
    helperText: 'Use the current library as suggestions. Accept only the values that should describe this destination going forward.',
    primaryActionLabel: 'Review suggestions',
    emptyState: 'Classifarr has not found enough current-library examples yet. You can still declare what belongs here.',
    completionSignal: 'Accepted observed suggestions become declared destination meaning.',
    termLabels: Object.freeze(['Belongs Here']),
    targetId: 'policy-builder-library-context',
  }),
  Object.freeze({
    stepId: POLICY_BUILDER_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
    heading: 'What should always or never belong here?',
    helperText: 'Add explicit operator intent for helpful matches, hard limits, and avoid values.',
    primaryActionLabel: 'Set destination rules',
    emptyState: 'No declared rules yet. Classifarr can use observed evidence, but clear rules improve automation.',
    completionSignal: 'Declared rules can define, block, or warn before this destination is chosen.',
    termLabels: Object.freeze(['Helpful Matches', 'Hard Limits', 'Avoid']),
    targetId: 'policy-builder-destination-rules',
  }),
  Object.freeze({
    stepId: POLICY_BUILDER_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
    heading: 'When should Classifarr ask?',
    helperText: 'Choose review triggers for missing, conflicting, stale, or unsafe evidence.',
    primaryActionLabel: 'Set review triggers',
    emptyState: 'No review triggers configured. Classifarr will still ask when readiness is not safe enough to automate.',
    completionSignal: 'Review behavior controls when Classifarr asks instead of learning or routing automatically.',
    termLabels: Object.freeze(['Ask When Unsure', 'Readiness']),
    targetId: 'policy-builder-review-behavior',
  }),
  Object.freeze({
    stepId: POLICY_BUILDER_SETUP_STEP_IDS.ROUTING_AND_READINESS,
    heading: 'Can this destination route?',
    helperText: 'Confirm where approved matches can be sent and show the next setup action when routing is incomplete.',
    primaryActionLabel: 'Check routing readiness',
    emptyState: 'No routing target is ready yet. Classification can still review matches before routing is enabled.',
    completionSignal: 'Routing readiness confirms the destination can apply approved matches safely.',
    termLabels: Object.freeze(['Routing Target', 'Readiness']),
    targetId: 'policy-builder-advanced-settings',
  }),
]);

function listPolicyBuilderSetupCards() {
  return POLICY_BUILDER_SETUP_CARDS;
}

function getPolicyBuilderSetupCard(stepId) {
  return POLICY_BUILDER_SETUP_CARDS.find(card => card.stepId === stepId) || null;
}

export {
  POLICY_BUILDER_SETUP_CARDS,
  POLICY_BUILDER_SETUP_STEP_IDS,
  getPolicyBuilderSetupCard,
  listPolicyBuilderSetupCards,
};
