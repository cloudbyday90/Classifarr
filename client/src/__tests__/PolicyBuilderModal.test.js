/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import PolicyBuilderModal from '../components/policies/PolicyBuilderModal.vue';
import api from '../api';
import { getDataRequest } from '../api/core';
import { buildIntentSignalCommandPlan } from '@/utils/policyIntentSignalDraft';
import { consumeRouteFocusHandoff } from '@/utils/routeFocusHandoff';

const buildConstraintDecisionModel = () => ({
  version: 'policy.constraint_decision_model.v1',
  authority: {
    displayProjection: true,
    automationDecision: false,
    policyPersistence: false,
    routingExecution: false,
    runtimeDecision: false,
    clientCanInferConstraintMeaning: false,
  },
  controls: [
    {
      controlId: 'hard_limit',
      intentId: 'blocking_constraint',
      label: 'Hard limit',
      questionId: 'what_should_not_go_here',
      description: 'Blocks items that violate this destination boundary.',
      draftCommandId: 'set_hard_limit',
      decisionEffectId: 'block_automatic_application',
      requiresExplicitOperatorAction: true,
      observedAbsenceBehaviorId: 'not_a_declaration_source',
      certificationSemanticId: 'max_allowed_rating',
      canBlockAutomaticApplication: true,
    },
    {
      controlId: 'avoid',
      intentId: 'advisory_avoid',
      label: 'Avoid',
      questionId: 'what_should_not_go_here',
      description: 'Lowers confidence or asks for review without becoming a hard block by default.',
      draftCommandId: 'add_avoid_value',
      decisionEffectId: 'reduce_confidence',
      requiresExplicitOperatorAction: true,
      observedAbsenceBehaviorId: 'not_a_declaration_source',
      certificationSemanticId: 'avoid_rating',
      canBlockAutomaticApplication: false,
    },
    {
      controlId: 'review_warning',
      intentId: 'non_blocking_warning',
      label: 'Review warning',
      questionId: 'when_should_classifarr_ask',
      description: 'Asks the operator when evidence is weak or missing.',
      draftCommandId: 'add_review_warning',
      decisionEffectId: 'request_review',
      requiresExplicitOperatorAction: false,
      observedAbsenceBehaviorId: 'review_warning_only',
      certificationSemanticId: null,
      canBlockAutomaticApplication: false,
    },
  ],
  rawPayloadExposed: false,
});

const buildConstraintValueEligibility = () => {
  const ratingOptions = ['G', 'PG', 'PG-13', 'R', 'NC-17']
    .map(value => ({ value, label: value, description: null }));

  return {
    version: 'policy.constraint_value_eligibility.v1',
    statusId: 'ready',
    libraryMediaTypeFamilyId: 'movie',
    authority: {
      displayProjection: true,
      serverOwnedAllowlist: true,
      policyPersistence: false,
      routingExecution: false,
      runtimeDecision: false,
      clientMayAddValues: false,
    },
    controls: [
      {
        controlId: 'hard_limit',
        valueKindId: 'certification',
        selectionModeId: 'single',
        allowsFreeText: false,
        options: ratingOptions,
      },
      {
        controlId: 'avoid',
        valueKindId: 'certification',
        selectionModeId: 'single',
        allowsFreeText: false,
        options: ratingOptions,
      },
      {
        controlId: 'review_warning',
        valueKindId: 'review_trigger',
        selectionModeId: 'single',
        allowsFreeText: false,
        options: [{
          value: 'evidence_missing',
          label: 'Evidence is missing',
          description: null,
        }],
      },
    ],
    rawPayloadExposed: false,
  };
};

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

const mockRouterPush = vi.hoisted(() => vi.fn());

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useRouter: () => ({ push: mockRouterPush }),
  };
});

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    getData: vi.fn(),
    getLibraries: vi.fn(),
    getGeneralSettings: vi.fn(),
    getLibraryProfile: vi.fn(),
    refreshLibraryProfile: vi.fn(),
  }
}));

vi.mock('../api/core', () => ({
  getDataRequest: vi.fn(),
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
  getSettingsRequest: vi.fn(),
  updateSettingsRequest: vi.fn()
}));

vi.mock('@/stores/toast', () => ({
  useToast: () => mockToast,
}));

describe('PolicyBuilderModal.vue', () => {
  const mockLibraries = [
    { id: 1, name: 'Sci-Fi Movies', media_type: 'movie' }
  ];

  const mockPresets = [
    {
      id: 1,
      name: 'Sci-Fi',
      icon: '🚀',
      category: 'genres',
      description: 'Science fiction content',
      usage_count: 4,
      source: 'builtin',
      signals: {}
    },
    {
      id: 2,
      name: 'Family',
      icon: '👨‍👩‍👧‍👦',
      category: 'audience',
      description: 'Family friendly content',
      usage_count: 1,
      source: 'builtin',
      signals: {}
    },
    {
      id: 9,
      key: 'custom_family_mix',
      name: 'Family Remix',
      icon: '⚙️',
      category: 'custom',
      description: 'My custom family preset',
      usage_count: 2,
      source: 'custom',
      signals: {}
    }
  ];

  const buildOperatorWorkflowRead = () => ({
    version: 'policy.operator_workflow_read.v3',
    library: {
      id: 1,
      name: 'Sci-Fi Movies',
    },
    observedProfile: {
      available: true,
      current: true,
      suggestionCount: 2,
      suggestions: [
        { key: 'genre:Science Fiction', label: 'Science Fiction', count: 18 },
        { key: 'genre:Adventure', label: 'Adventure', count: 12 },
      ],
      intentSignalProjection: {
        observedEvidence: [],
        options: [],
      },
    },
    workflow: {
      title: 'Destination setup',
      summary: 'Review what belongs here, what should not, when to ask, and whether confirmed matches can route.',
      readiness: {
        ready: false,
        nextAction: { label: 'Connect a routing target' },
      },
      sections: [
        ['what_belongs_here', 'What belongs here'],
        ['what_should_not_go_here', 'What should not go here'],
        ['what_helps_but_should_not_decide_alone', 'What helps but should not decide alone'],
        ['when_should_classifarr_ask', 'When should Classifarr ask'],
        ['can_this_route', 'Can this route'],
      ].map(([sectionId, heading]) => ({
        sectionId,
        heading,
        plainQuestion: `${heading}?`,
        helperText: 'Server-owned workflow guidance.',
        statusId: 'needs_action',
        editable: sectionId !== 'can_this_route',
        readiness: {},
      })),
    },
    constraintValueEligibility: buildConstraintValueEligibility(),
    authority: {
      displayProjection: true,
      automationDecision: false,
      policyPersistence: false,
      routingExecution: false,
    },
  });

  const buildNativeReadinessSummary = () => ({
    version: 'policy.native_readiness_summary.v1',
    statusId: 'native_policy_readiness_available',
    policyId: 1,
    nativeIntent: {
      authorityStateId: 'single_active_native_intent',
      authoritative: true,
      intentVersion: 1,
      purposeRuleCount: 1,
      validationStateId: 'valid',
    },
    readiness: {
      stateId: 'needs_routing',
      label: 'Needs routing',
      ready: false,
      nextAction: {
        actionId: 'configure_routing',
        label: 'Configure routing',
      },
      reasonCodes: ['routing_not_ready'],
    },
    profileRecovery: {
      stateId: 'not_required',
      label: 'Profile current',
      message: 'No automatic profile recovery is needed.',
    },
    authority: {
      displayProjection: true,
      automationDecision: false,
      policyPersistence: false,
      routingExecution: false,
    },
    sideEffects: {
      profileRefreshOutboxRead: false,
      profileRefreshCircuitRead: false,
      liveMediaServerLookupPerformed: false,
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      policyStorageMutated: false,
      routingExecuted: false,
    },
    rawPayloadExposed: false,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.warning.mockClear();
    mockToast.info.mockClear();
    mockRouterPush.mockResolvedValue(undefined);
    api.getLibraries.mockImplementation((...args) => api.get('/libraries', ...args).then((response) => response.data));
    api.getGeneralSettings.mockImplementation((...args) => api.get('/settings', ...args).then((response) => response.data));
    api.getLibraryProfile.mockImplementation((libraryId) => api.get(`/libraries/${libraryId}/profile`).then((response) => response.data));
    api.refreshLibraryProfile.mockImplementation((libraryId) => api.get(`/libraries/${libraryId}/profile/refresh`).then((response) => response.data));
    getDataRequest.mockImplementation((url, config) => api.get(url, config).then((response) => response.data));
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  it('closes only after a confirmed mapping navigation and hands focus to the mapping target', async () => {
    const workflowRead = buildOperatorWorkflowRead();
    const mappingState = {
      stateId: 'unmapped_library',
      sectionId: 'can_this_route',
      label: 'Library routing needs a mapping',
      description: 'Connect this library to a routing target before automation can apply approved matches.',
      nextAction: {
        actionId: 'map_routing_destination',
        label: 'Open library mapping',
        busyLabel: 'Opening library mapping...',
        mode: 'open_library_mapping',
      },
    };
    workflowRead.emptyStateProjection = { states: [mappingState] };

    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/operator-workflow/libraries/1') return Promise.resolve({ data: workflowRead });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
      },
      attachTo: document.body,
    });

    await flushPromises();
    await wrapper.vm.handleEmptyStateAction(mappingState);

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: 'LibraryDetail',
      params: { id: 1 },
    });
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false]);
    expect(wrapper.vm.restoreFocusAfterClose).toBe(false);
    expect(consumeRouteFocusHandoff('LibraryDetail')).toEqual({
      targetId: 'library-arr-mapping',
      fallbackTargetId: 'library-detail-title',
    });
  });

  it('keeps raw template attachment controls and suggestion requests out of compatibility editing', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: []
        },
        libraryId: 1
      },
      attachTo: document.body
    });

    await flushPromises();
    expect(document.body.textContent).not.toContain('Starter Template Accelerator');
    expect(document.body.textContent).not.toContain('My Presets');
    expect(document.body.textContent).not.toContain('Family Remix');
    expect(document.body.textContent).not.toContain('Used in 4 policies');
    expect(document.body.textContent).not.toContain('Used in 1 policy');
    expect(api.get).not.toHaveBeenCalledWith('/policies/presets/suggest/1');
  });

  it('renders a persisted native policy as a server-reported read-only view', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/1/native-intent/readiness-summary') {
        return Promise.resolve({ data: buildNativeReadinessSummary() });
      }
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          policy_intent_contract: {
            source: 'native_intent',
            validation: { valid: true },
            purpose: [{
              signal_type: 'genres',
              values: { require_any: ['Science Fiction'] },
            }],
          },
          policy_intent_read_trace: {
            source: 'native_intent',
            status: 'native_intent_active',
          },
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Native policy summary');
    expect(document.body.textContent).toContain('Genres: Science Fiction');
    expect(document.body.textContent).toContain('Current policy readiness');
    expect(document.body.textContent).toContain('Configure routing');
    expect(document.body.textContent).toContain('Profile recovery');
    expect(document.body.textContent).toContain('Profile current');
    expect(document.body.textContent).not.toContain('Refresh profile');
    expect(document.body.textContent).not.toContain('What belongs here');
    expect(wrapper.find('#policy-builder-intent-editor').exists()).toBe(false);
    expect(wrapper.find('#policy-builder-advanced-settings').exists()).toBe(false);
    expect(wrapper.find('#policy-builder-save-status').exists()).toBe(false);
    expect(api.get).not.toHaveBeenCalledWith('/policies/presets/all');
    expect(api.get).not.toHaveBeenCalledWith('/settings');
    expect(api.get).not.toHaveBeenCalledWith('/policies/operator-workflow/libraries/1', undefined);
  });

  it('keeps an invalid native read policy read-only without requesting native readiness', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          policy_intent_contract: {
            source: 'native_intent',
            validation: { valid: false },
            purpose: [],
          },
          policy_intent_read_trace: {
            source: 'native_intent',
            status: 'native_intent_invalid',
          },
        },
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Native policy recovery in progress');
    expect(document.body.textContent).toContain('server-owned reconciliation');
    expect(document.body.textContent).not.toContain('Native policy summary');
    expect(wrapper.find('#policy-compatibility-maintenance').exists()).toBe(false);
    expect(wrapper.find('#policy-builder-intent-editor').exists()).toBe(false);
    expect(wrapper.find('#policy-builder-advanced-settings').exists()).toBe(false);
    expect(wrapper.find('#policy-builder-save-status').exists()).toBe(false);
    expect(api.get).not.toHaveBeenCalledWith('/policies/1/native-intent/readiness-summary');
    expect(api.get).not.toHaveBeenCalledWith('/policies/presets/all');
    expect(api.get).not.toHaveBeenCalledWith('/settings');
    expect(api.get).not.toHaveBeenCalledWith('/policies/operator-workflow/libraries/1', undefined);
  });

  it('preserves hidden compatibility decision values in the legacy save payload', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          profile_weight: 0.25,
          preset_weight: 0.35,
          pattern_weight: 0.15,
          rag_weight: 0.15,
          history_weight: 0.10,
          presets: [
            { id: 1, name: 'Sci-Fi', icon: '🚀', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).not.toContain('Advanced Settings');
    expect(document.body.textContent).not.toContain('Scoring Weights');
    expect(document.body.textContent).not.toContain('Classification Thresholds');
    expect(document.body.textContent).not.toContain('Ready to save');
    expect(document.body.textContent).not.toContain('routing still needs setup');
    expect(wrapper.find('#policy-builder-save-status').exists()).toBe(false);

    await wrapper.vm.save();

    const emittedSave = wrapper.emitted('save');
    expect(emittedSave).toBeTruthy();
    expect(emittedSave[0][0]).toMatchObject({
      profile_weight: 0.25,
      preset_weight: 0.35,
      pattern_weight: 0.15,
      rag_weight: 0.15,
      history_weight: 0.10
    });
  });

  it('creates a native intent establishment payload only after observed values are explicitly accepted', async () => {
    const workflowRead = buildOperatorWorkflowRead();
    workflowRead.observedProfile.intentSignalProjection = { options: [{
      candidateId: 'genre:Science Fiction:purpose',
      value: 'Science Fiction',
      label: 'Science Fiction',
      signalType: 'genres',
      operator: 'require_any',
      questionId: 'what_belongs_here',
      sourceId: 'suggested_from_observed_profile',
      sourceLabel: 'Suggested from this library',
      selectionStateId: 'selectable_suggestion',
      selectable: true,
      readOnlyEvidence: false,
      commandId: 'add_signal_value',
      explanation: 'Science Fiction appears in 18 items in the current library.',
      evidence: { count: 18, confidence: 0.8 },
      requiresExplicitAcceptance: true,
      canAutoDeclare: false,
    }] };

    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      if (url === '/policies/operator-workflow/libraries/1') return Promise.resolve({ data: workflowRead });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Define this destination');
    expect(document.body.textContent).toContain('What should define this destination?');
    expect(document.body.textContent).not.toContain('Policy Intent Builder');
    expect(document.body.textContent).not.toContain('Starter Template Accelerator');
    expect(document.body.textContent).not.toContain('Advanced Settings');
    expect(document.body.textContent).not.toContain('routing still needs setup');
    expect(api.get).not.toHaveBeenCalledWith('/policies/presets/all');
    expect(api.get).not.toHaveBeenCalledWith('/settings');
    expect(api.get).not.toHaveBeenCalledWith('/policies/presets/suggest/1');

    wrapper.vm.applyIntentSignalCommandPlan(buildIntentSignalCommandPlan({
      commandId: 'add_signal_value',
      candidates: workflowRead.observedProfile.intentSignalProjection.options,
    }));
    await flushPromises();
    await wrapper.vm.save();

    const nativeCreatePayload = wrapper.emitted('save')[0][0]
    expect(nativeCreatePayload).toMatchObject({
      library_id: 1,
      native_intent_establishment: {
        declared_intent: {
          purpose: [{
            signal_type: 'genres',
            operator: 'require_any',
            values: { require_any: ['Science Fiction'] },
          }],
          hard_limits: [],
          helpful_hints: [],
          avoid: [],
        },
      },
    });
    expect(Object.keys(nativeCreatePayload).sort()).toEqual([
      'library_id',
      'name',
      'native_intent_establishment',
    ])
  });

  it('keeps staged constraint commands out of the native policy-create payload', async () => {
    const workflowRead = buildOperatorWorkflowRead();
    workflowRead.constraintDecisionModel = buildConstraintDecisionModel();
    workflowRead.observedProfile.intentSignalProjection = { options: [{
      candidateId: 'genre:Science Fiction:purpose',
      value: 'Science Fiction',
      label: 'Science Fiction',
      signalType: 'genres',
      operator: 'require_any',
      questionId: 'what_belongs_here',
      sourceId: 'suggested_from_observed_profile',
      sourceLabel: 'Suggested from this library',
      selectionStateId: 'selectable_suggestion',
      selectable: true,
      readOnlyEvidence: false,
      commandId: 'add_signal_value',
      explanation: 'Science Fiction appears in 18 items in the current library.',
      evidence: { count: 18, confidence: 0.8 },
      requiresExplicitAcceptance: true,
      canAutoDeclare: false,
    }] };

    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/operator-workflow/libraries/1') return Promise.resolve({ data: workflowRead });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
      },
      attachTo: document.body,
    });

    await flushPromises();

    const hardLimitValue = document.body.querySelector('#policy-intent-constraint-hard_limit-value');
    const hardLimitConfirmation = document.body.querySelector('#policy-intent-constraint-hard_limit-confirmation');
    const hardLimitButton = Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent.trim() === 'Stage hard limit');

    expect(hardLimitValue).toBeTruthy();
    expect(hardLimitConfirmation).toBeTruthy();
    expect(hardLimitButton).toBeTruthy();

    hardLimitValue.value = 'PG-13';
    hardLimitValue.dispatchEvent(new Event('change'));
    hardLimitConfirmation.checked = true;
    hardLimitConfirmation.dispatchEvent(new Event('change'));
    await flushPromises();
    hardLimitButton.click();
    await flushPromises();

    expect(document.body.textContent).toContain('1 local constraint is staged and not saved');

    wrapper.vm.applyIntentSignalCommandPlan(buildIntentSignalCommandPlan({
      commandId: 'add_signal_value',
      candidates: workflowRead.observedProfile.intentSignalProjection.options,
    }));
    await wrapper.vm.save();

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      library_id: 1,
      native_intent_establishment: {
        declared_intent: {
          hard_limits: [],
          avoid: [],
        },
      },
    });
    expect(wrapper.emitted('save')?.[0]?.[0]).not.toHaveProperty('constraint_draft_commands');
    expect(wrapper.emitted('save')?.[0]?.[0]).not.toHaveProperty('policyIntentConstraintDraft');
  });

  it('keeps native creation open for a persisted server-owned policy handoff', async () => {
    const workflowRead = buildOperatorWorkflowRead();
    workflowRead.observedProfile.intentSignalProjection = { options: [{
      candidateId: 'genre:Science Fiction:purpose',
      value: 'Science Fiction',
      label: 'Science Fiction',
      signalType: 'genres',
      operator: 'require_any',
      questionId: 'what_belongs_here',
      sourceId: 'suggested_from_observed_profile',
      sourceLabel: 'Suggested from this library',
      selectionStateId: 'selectable_suggestion',
      selectable: true,
      readOnlyEvidence: false,
      commandId: 'add_signal_value',
      explanation: 'Science Fiction appears in 18 items in the current library.',
      evidence: { count: 18, confidence: 0.8 },
      requiresExplicitAcceptance: true,
      canAutoDeclare: false,
    }] };
    const submitPolicy = vi.fn().mockResolvedValue({
      data: {
        id: 91,
        name: 'Sci-Fi Movies Policy',
        library_name: 'Sci-Fi Movies',
        native_intent_establishment: {
          statusId: 'initial_intent_established',
          intentId: 501,
          routingConfigured: false,
          ruleCount: 1,
        },
      },
    });

    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/operator-workflow/libraries/1') return Promise.resolve({ data: workflowRead });
      if (url === '/policies/91') {
        return Promise.resolve({
          data: {
            id: 91,
            name: 'Sci-Fi Movies Policy',
            library_name: 'Sci-Fi Movies',
            policy_intent_contract: {
              source: 'native_intent',
              purpose: [{ signal_type: 'genres' }],
              hard_limits: [],
              helpful_hints: [],
              avoid: [],
            },
          },
        });
      }
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        submitPolicy,
      },
      attachTo: document.body,
    });

    await flushPromises();
    wrapper.vm.applyIntentSignalCommandPlan(buildIntentSignalCommandPlan({
      commandId: 'add_signal_value',
      candidates: workflowRead.observedProfile.intentSignalProjection.options,
    }));
    await wrapper.vm.save();
    await flushPromises();

    expect(submitPolicy).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/policies/91', undefined);
    expect(document.body.textContent).toContain('Policy created');
    expect(document.body.textContent).toContain('Declared destination intent');
    expect(document.body.textContent).toContain('Routing setup still needed');
    expect(document.body.textContent).not.toContain('Policy Intent Builder');
    expect(document.activeElement?.id).toBe('policy-native-create-handoff-title');

    await Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent.includes('Done'))
      .click();

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('shows insufficient native evidence without a browser recovery action', async () => {
    const workflowRead = buildOperatorWorkflowRead();
    workflowRead.observedProfile = {
      available: false,
      current: false,
      suggestionCount: 0,
      suggestions: [],
      intentSignalProjection: { options: [] },
    };

    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/operator-workflow/libraries/1') return Promise.resolve({ data: workflowRead });
      if (url === '/libraries/1/profile') return Promise.resolve({ data: null });
      return Promise.resolve({ data: { suggestions: [] } });
    });
    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Profile unavailable');
    expect(document.body.textContent).not.toContain('What should define this destination?');
    expect(Array.from(document.body.querySelectorAll('button')).some(button => (
      button.textContent.includes('Refresh library profile')
      || button.textContent.includes('Try evidence check again')
    ))).toBe(false);
    expect(api.refreshLibraryProfile).not.toHaveBeenCalled();
  });

  it('awaits the parent save operation and shows an actionable save failure', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });
    const submitPolicy = vi.fn().mockRejectedValue({
      response: {
        data: {
          error: 'The policy intent draft is invalid.',
        },
      },
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [],
        },
        submitPolicy,
      },
      attachTo: document.body,
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Save Policy');

    await wrapper.vm.save();

    expect(submitPolicy).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('save')).toBeFalsy();
    expect(document.body.querySelector('#policy-builder-save-error')?.textContent)
      .toContain('The policy intent draft is invalid.');
    expect(mockToast.error).toHaveBeenCalledWith(
      'The policy intent draft is invalid.',
      'Failed to save policy',
    );
  });

  it('keeps modal public events bounded to visibility, close, and delegated save payloads', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            { id: 1, name: 'Sci-Fi', icon: '🚀', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    wrapper.vm.isOpen = false;
    await flushPromises();
    await wrapper.vm.save();

    const deferButton = Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent.includes('Defer for now'));
    expect(deferButton).toBeTruthy();
    deferButton.click();
    await flushPromises();

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
    expect(wrapper.emitted('close')).toEqual([[]]);
    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual(expect.objectContaining({
      library_id: 1,
      name: 'Sci-Fi Movies Policy',
      presets: [expect.objectContaining({ preset_id: 1, weight: 1 })],
      policyIntentDraft: expect.objectContaining({
        schema_version: 1,
        source: 'legacy_policy_builder',
      }),
    }));
    expect(Object.keys(wrapper.emitted()).sort()).toEqual([
      'close',
      'save',
      'update:modelValue',
    ]);
  });

  it('does not use blocking browser alerts for save presentation', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            { id: 1, name: 'Sci-Fi', icon: '🚀', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();
    await wrapper.vm.save();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(wrapper.emitted('save')).toBeTruthy();

    alertSpy.mockRestore();
  });

  it('isolates compatibility maintenance from the destination-first workflow and retired diagnostics', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      if (url === '/policies/operator-workflow/libraries/1') return Promise.resolve({ data: buildOperatorWorkflowRead() });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        showMigrationVerifierPanels: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            { id: 1, name: 'Sci-Fi', icon: '🚀', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Maintain destination intent');
    expect(document.body.textContent).toContain('Update the destination signals for this existing policy.');
    expect(document.body.textContent).toContain('Edit destination intent');
    expect(document.body.textContent).not.toContain('New policies use destination-first setup');
    expect(document.body.textContent).not.toContain('preserves its decision behavior');
    expect(document.body.textContent).not.toContain('Advanced Settings');
    expect(document.body.textContent).not.toContain('Scoring Weights');
    expect(document.body.textContent).not.toContain('Policy setup');
    expect(document.body.textContent).not.toContain('What Classifarr sees in Sci-Fi Movies');
    expect(document.body.textContent).not.toMatch(/Science Fiction\s*18\s*currently here/);
    expect(document.body.textContent).not.toContain('Policy Setup');
    expect(document.body.textContent).not.toContain('What already belongs here?');
    expect(document.body.textContent).not.toContain('Set destination rules');
    expect(document.body.textContent).not.toContain('Routing Readiness');
    expect(document.body.textContent).not.toContain('Intent Impact Preview');
    expect(document.body.textContent).not.toContain('Representative Replay Preview');
    expect(document.body.textContent).not.toContain('Preview Impact');
    expect(document.body.textContent).not.toContain('Preview Replay');
    expect(api.get).not.toHaveBeenCalledWith('/policies/operator-workflow/libraries/1', undefined);
  });

  it('shows the intent-first editor and saves intent edits as structured custom signals', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') {
        return Promise.resolve({
          data: [{
            id: 1,
            name: 'Starter',
            icon: '📦',
            category: 'audience',
            description: 'Starter preset',
            usage_count: 0,
            source: 'builtin',
            signals: {
              genres: { prefer: ['Comedy'] },
              certifications: { include: ['PG', 'PG-13', 'R'] }
            }
          }]
        });
      }
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            { id: 1, name: 'Starter', icon: '📦', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Edit destination intent');
    expect(document.body.textContent).not.toContain('The media server shows how this library is used today');
    expect(document.body.textContent).toContain('Belongs Here');
    expect(document.body.textContent).toContain('Hard Limits');
    expect(document.body.textContent).not.toContain('Starter Template Accelerator');
    expect(document.body.textContent).not.toContain('Combined Signals');

    wrapper.vm.addIntentSignal({
      presetId: 1,
      signalType: 'genres',
      key: 'require_any',
      value: 'Family',
      extras: { semantics: 'identity' }
    });
    wrapper.vm.setIntentSignalConfig({
      presetId: 1,
      signalType: 'certifications',
      config: {
        mode: 'max',
        max: 'PG-13',
        constraint_mode: 'strict'
      }
    });
    await flushPromises();
    await wrapper.vm.save();

    const emittedSave = wrapper.emitted('save');
    expect(emittedSave).toBeTruthy();
    expect(emittedSave[0][0].presets[0]).toMatchObject({
      preset_id: 1,
      customSignals: {
        genres: {
          require_any: ['Family'],
          semantics: 'identity'
        },
        certifications: {
          mode: 'max',
          max: 'PG-13',
          constraint_mode: 'strict'
        }
      }
    });
    expect(emittedSave[0][0].policyIntentDraft).toMatchObject({
      schema_version: 1,
      source: 'legacy_policy_builder',
      migration_state: 'legacy_compatible',
      summary: {
        preset_count: 1
      }
    });
    expect(emittedSave[0][0].policyIntentDraft.presets[0]).toMatchObject({
      preset_id: 1,
    });
  });

  it('shows direct intent editing without a client-derived behavior summary or raw scoring section', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            { id: 1, name: 'Sci-Fi', icon: '🚀', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    const text = document.body.textContent;

    expect(text).toContain('Edit destination intent');
    expect(text).not.toContain('Policy Behavior Summary');
    expect(text).not.toContain('Advanced Settings');
    expect(text).not.toContain('Scoring Weights');
    expect(text).not.toContain('Classification Thresholds');
  });

  it('preserves unchanged legacy custom signals when saving through the draft bridge', async () => {
    const legacyCustomSignals = {
      genres: {
        require_any: ['Family'],
        semantics: 'identity',
        source_note: 'operator-confirmed'
      },
      certifications: {
        mode: 'max',
        max: 'PG-13',
        constraint_mode: 'strict'
      },
      language: {
        strict: true
      },
      removed: {
        genres: {
          prefer: ['Comedy']
        }
      },
      custom_block: {
        arbitrary: ['keep-me']
      }
    };

    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') {
        return Promise.resolve({
          data: [{
            id: 1,
            name: 'Starter',
            icon: '📦',
            category: 'audience',
            description: 'Starter preset',
            usage_count: 0,
            source: 'builtin',
            signals: {}
          }]
        });
      }
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          description: 'Existing description',
          enabled: true,
          priority: 7,
          auto_classify_threshold: 82,
          prompt_threshold: 61,
          presets: [
            {
              id: 1,
              preset_id: 1,
              name: 'Starter',
              icon: '📦',
              weight: 1.25,
              customSignals: legacyCustomSignals
            }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();
    await wrapper.vm.save();

    const emittedSave = wrapper.emitted('save');
    expect(emittedSave).toBeTruthy();
    expect(emittedSave[0][0].presets).toEqual([
      {
        preset_id: 1,
        weight: 1.25,
        customSignals: legacyCustomSignals
      }
    ]);
  });

  it('preserves unchanged API-shaped preset custom_signals on modal save', async () => {
    const customSignals = {
      keywords: {
        require_any: ['princess'],
        semantics: 'identity'
      },
      language: {
        strict: false,
        runtime_mode: 'advisory'
      }
    };

    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            {
              preset_id: 2,
              name: 'Family',
              icon: '👨‍👩‍👧‍👦',
              weight: 0.8,
              custom_signals: customSignals
            }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();
    await wrapper.vm.save();

    const emittedSave = wrapper.emitted('save');
    expect(emittedSave).toBeTruthy();
    expect(emittedSave[0][0].presets).toEqual([
      {
        preset_id: 2,
        weight: 0.8,
        customSignals
      }
    ]);
  });

  it('renders policy intent entries from the draft state boundary', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') {
        return Promise.resolve({
          data: [{
            id: 1,
            name: 'Starter',
            icon: '📦',
            category: 'audience',
            description: 'Starter preset',
            usage_count: 0,
            source: 'builtin',
            signals: {}
          }]
        });
      }
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            { id: 1, name: 'Starter', icon: '📦', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    wrapper.vm.intentDraft.presets[0].buckets.identity_signals.push({
      bucket: 'identity_signals',
      signal_type: 'genres',
      values: { require_any: ['Family'] },
      metadata: { semantics: 'identity' },
      source: 'intent_draft'
    });
    await flushPromises();

    expect(document.body.textContent).toContain('Belongs here: Family');
  });

  it('shows preset migration notice when auto-drop report exists', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') {
        return Promise.resolve({
          data: {
            preset_semantics_v2_auto_drop_report: JSON.stringify({
              dropped_count: 2,
              affected_policy_count: 1,
              executed_at: '2026-03-13T23:30:00Z',
              dropped_attachments: [
                { preset_name: 'Scandinavian' },
                { preset_name: 'Korean' }
              ]
            })
          }
        });
      }
      return Promise.resolve({ data: { suggestions: [] } });
    });

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: []
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).toContain('2 incompatible preset attachments were removed automatically across 1 policy.');
    expect(document.body.textContent).toContain('Affected presets: Scandinavian, Korean');
    expect(document.body.textContent).not.toContain('Legacy preset attachments were auto-dropped after upgrade');
    expect(document.body.textContent).not.toContain('Reapply corrected presets where needed.');
  });

  it('lets users dismiss the preset migration notice and keeps it hidden for the same report', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') {
        return Promise.resolve({
          data: {
            preset_semantics_v2_auto_drop_report: JSON.stringify({
              dropped_count: 1,
              affected_policy_count: 1,
              executed_at: '2026-03-13T23:45:00Z',
              dropped_attachments: [
                { preset_name: 'Scandinavian' }
              ]
            })
          }
        });
      }
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: []
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).toContain('1 incompatible preset attachment was removed automatically across 1 policy.');

    expect(typeof wrapper.vm.dismissPresetMigrationNotice).toBe('function');
    wrapper.vm.dismissPresetMigrationNotice();
    await flushPromises();

    expect(document.body.textContent).not.toContain('1 incompatible preset attachment was removed automatically across 1 policy.');
    expect(window.localStorage.getItem('classifarr.presetMigrationNotice.dismissed')).toBe('2026-03-13T23:45:00Z');

    wrapper.unmount();

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          id: 1,
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: []
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).not.toContain('1 incompatible preset attachment was removed automatically across 1 policy.');
  });
});
