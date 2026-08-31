/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AI from '@/views/settings/AI.vue'
import api from '@/api'

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
}

vi.mock('@/api', () => ({
  default: {
    getAIConfig: vi.fn(),
    getAIConfigForUpdate: vi.fn(),
    getAIUsage: vi.fn(),
    getPatternConfig: vi.fn(),
    getCostSummary: vi.fn(),
    getAIVerificationCapability: vi.fn(),
    testAIVerificationCapability: vi.fn(),
    runOllamaVerificationCompatibilityMatrix: vi.fn(),
    getAIVerificationCapabilityChangeReceipts: vi.fn(),
    getOllamaVerificationRuntimeMismatchSummary: vi.fn(),
    getOllamaVerificationCapabilityOutcomeHistory: vi.fn(),
    getRouteSafetyReadiness: vi.fn(),
    getAIModels: vi.fn(),
    testAIConnection: vi.fn(),
    preflightAIVerificationConfig: vi.fn(),
    updateAIConfig: vi.fn(),
    updatePatternConfig: vi.fn(),
    testOllama: vi.fn(),
    getOllamaModels: vi.fn(),
    getLastOllamaPreflight: vi.fn()
  }
}))

vi.mock('@/stores/toast', () => ({
  useToast: () => toast
}))

const ButtonStub = {
  props: ['disabled', 'variant', 'size'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>'
}

const CardStub = {
  props: ['title'],
  template: '<section><slot /></section>'
}

const ToggleStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />'
}

const SpinnerStub = {
  template: '<div>spinner</div>'
}

const PasswordInputStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />'
}

const baseConfig = {
  primary_provider: 'openai',
  api_endpoint: 'https://api.openai.com/v1',
  api_key: 'sk-masked',
  model: 'gpt-5-mini'
}
const AI_SETTINGS_WRITE_PRECONDITION = '"00000000-0000-4000-8000-000000000401"'

function mountView() {
  return mount(AI, {
    global: {
      mocks: {
        $router: {
          push: vi.fn()
        }
      },
      stubs: {
        Card: CardStub,
        Button: ButtonStub,
        Toggle: ToggleStub,
        Spinner: SpinnerStub,
        PasswordInput: PasswordInputStub,
        RouterLink: { template: '<a><slot /></a>' }
      }
    }
  })
}

async function openAiReadinessDiagnostics(wrapper) {
  const diagnostics = wrapper.get('[data-testid="ai-readiness-diagnostics"]')
  diagnostics.element.open = true
  await diagnostics.trigger('toggle')
  await flushPromises()
}

describe('AI Settings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.getAIConfigForUpdate.mockImplementation(async () => ({
      config: await api.getAIConfig(),
      writePrecondition: AI_SETTINGS_WRITE_PRECONDITION,
    }))
    api.getAIConfig.mockResolvedValue(baseConfig)
    api.getAIUsage.mockResolvedValue({ data: null })
    api.getPatternConfig.mockResolvedValue({})
    api.getCostSummary.mockResolvedValue(null)
    api.getAIVerificationCapability.mockResolvedValue({
      statusId: 'verification_ready',
      label: 'Strict verification is available',
      message: 'The saved primary AI path can admit strict candidate-bound verification.',
      guidance: []
    })
    api.getAIVerificationCapabilityChangeReceipts.mockResolvedValue({ receipts: [] })
    api.getOllamaVerificationRuntimeMismatchSummary.mockResolvedValue({
      modelDigestMismatchCount: '0',
      lastObservedAt: null
    })
    api.getOllamaVerificationCapabilityOutcomeHistory.mockResolvedValue({
      totalTests: '0',
      signal: {
        id: 'no_tests',
        label: 'No recent tests',
        message: 'Run Test Ollama Verification to establish a baseline.'
      },
      outcomes: []
    })
    api.getRouteSafetyReadiness.mockResolvedValue({
      version: 'classification.route_safety_readiness.v1',
      window: { days: 7 },
      observationCount: 2,
      primaryGates: [{ id: 'policy_confirmation_required', count: 2 }],
      status: { id: 'safeguards_observed' },
    })
    api.getLastOllamaPreflight.mockResolvedValue({ ai: null, embedding: null })
    api.runOllamaVerificationCompatibilityMatrix.mockResolvedValue({
      data: { stateId: 'completed', ollamaVersion: '0.12.4', outcomes: [] }
    })
    api.preflightAIVerificationConfig.mockResolvedValue({
      data: { requiresConfirmation: false }
    })
    api.updateAIConfig.mockResolvedValue({ data: { success: true } })
    api.updatePatternConfig.mockResolvedValue({ data: { success: true } })
  })

  it('renders only the bounded Ollama runtime mismatch summary', async () => {
    api.getOllamaVerificationRuntimeMismatchSummary.mockResolvedValue({
      modelDigestMismatchCount: '4',
      lastObservedAt: '2026-08-29T12:34:56.000Z',
      model: 'private-model-name',
      host: 'private-host.local',
      error: 'private provider failure'
    })

    const wrapper = mountView()
    await flushPromises()

    expect(api.getOllamaVerificationRuntimeMismatchSummary).not.toHaveBeenCalled()
    await openAiReadinessDiagnostics(wrapper)

    expect(api.getOllamaVerificationRuntimeMismatchSummary).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Runtime model integrity')
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).not.toContain('private-model-name')
    expect(wrapper.text()).not.toContain('private-host.local')
    expect(wrapper.text()).not.toContain('private provider failure')
  })

  it('automatically refreshes a content-free route-safety summary with saved AI readiness', async () => {
    api.getRouteSafetyReadiness.mockResolvedValue({
      version: 'classification.route_safety_readiness.v1',
      window: { days: 7 },
      observationCount: 5,
      primaryGates: [
        { id: 'policy_confirmation_required', count: 3 },
        { id: 'policy_destination_selection_required', count: 2 },
        { id: 'unknown_gate', count: 99, label: 'Untrusted label' },
      ],
      status: { id: 'safeguards_observed', message: 'Untrusted server message' },
      title: 'Private media title',
      provider: 'Private provider',
    })

    const wrapper = mountView()
    await flushPromises()

    expect(api.getRouteSafetyReadiness).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Route safeguards observed')
    expect(wrapper.text()).toContain('Policy confirmation')
    expect(wrapper.text()).toContain('Destination selection')
    expect(wrapper.text()).not.toContain('Untrusted label')
    expect(wrapper.text()).not.toContain('Untrusted server message')
    expect(wrapper.text()).not.toContain('Private media title')
    expect(wrapper.text()).not.toContain('Private provider')
  })

  it('renders only aggregate saved-test outcomes and refreshes them after a test', async () => {
    api.getAIConfig.mockResolvedValueOnce({
      primary_provider: 'ollama',
      ollama_host: 'private-ollama.internal',
      ollama_port: 11434,
      ollama_model: 'gemma4:e4b'
    })
    api.getAIVerificationCapability.mockResolvedValueOnce({
      label: 'Strict verification needs attention',
      message: 'Saved Ollama needs a test.',
      guidance: [],
      ollamaVerificationCapability: {
        statusId: 'not_checked',
        label: 'Ollama verification has not been tested',
        message: 'Strict verification will not call AI until tested.',
        guidance: [],
        testable: true
      }
    })
    api.getOllamaVerificationCapabilityOutcomeHistory
      .mockResolvedValueOnce({
        totalTests: '1',
        signal: { id: 'intermittent', label: 'Mixed test outcomes', message: 'History is advisory.' },
        outcomes: [{
          statusId: 'verification_ready',
          count: '1',
          lastObservedAt: '2026-08-29T12:34:56.000Z',
          model: 'private-model-name',
          response: 'private model output'
        }]
      })
      .mockResolvedValueOnce({
        totalTests: '2',
        signal: { id: 'consistently_ready', label: 'Consistently ready', message: 'Current saved capability is authoritative.' },
        outcomes: [{ statusId: 'verification_ready', count: '2', lastObservedAt: null }]
      })
    api.testAIVerificationCapability.mockResolvedValueOnce({
      data: {
        label: 'Strict verification is available',
        message: 'Saved Ollama is ready.',
        guidance: [],
        ollamaVerificationCapability: {
          statusId: 'verification_ready',
          label: 'Ollama verification is ready',
          message: 'The saved model passed the bounded test.',
          guidance: [],
          testable: true,
        }
      }
    })

    const wrapper = mountView()
    await flushPromises()

    await openAiReadinessDiagnostics(wrapper)

    expect(wrapper.text()).toContain('Saved test outcome trend')
    expect(wrapper.text()).toContain('Mixed test outcomes')
    expect(wrapper.text()).not.toContain('private-model-name')
    expect(wrapper.text()).not.toContain('private model output')

    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test saved Ollama verification'))
    expect(testButton).toBeDefined()
    await testButton.trigger('click')
    await flushPromises()

    expect(api.getOllamaVerificationCapabilityOutcomeHistory).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Consistently ready')
  })

  it('shows the in-band /settings/ai/models error and clears models', async () => {
    api.getAIModels.mockResolvedValue({
      data: {
        success: false,
        error: 'Stored API key is invalid',
        models: []
      }
    })

    const wrapper = mountView()
    await flushPromises()

    const fetchButton = wrapper.findAll('button').find((button) => button.text().includes('Fetch'))
    expect(fetchButton).toBeDefined()

    await fetchButton.trigger('click')
    await flushPromises()

    expect(api.getAIModels).toHaveBeenCalledWith({
      primary_provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: 'sk-masked'
    })
    expect(toast.error).toHaveBeenCalledWith('Stored API key is invalid')
    expect(wrapper.text()).toContain('Select a model...')
    expect(wrapper.text()).not.toContain('gpt-5-mini')
  })

  it('surfaces the /settings/ai/test route error payload when the request is rejected', async () => {
    api.testAIConnection.mockRejectedValue({
      response: {
        data: {
          error: 'API key is required'
        }
      }
    })

    const wrapper = mountView()
    await flushPromises()

    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test Connection'))
    expect(testButton).toBeDefined()

    await testButton.trigger('click')
    await flushPromises()

    expect(api.testAIConnection).toHaveBeenCalledWith({
      primary_provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: 'sk-masked'
    })
    expect(wrapper.text()).toContain('API key is required')
  })

  it('warns when AI config saves but pattern settings fail', async () => {
    api.updatePatternConfig.mockRejectedValueOnce(new Error('pattern service unavailable'))

    const wrapper = mountView()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    expect(saveButton).toBeDefined()

    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      primary_provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: 'sk-masked'
    }), AI_SETTINGS_WRITE_PRECONDITION)
    expect(api.updatePatternConfig).toHaveBeenCalledTimes(1)
    expect(toast.warning).toHaveBeenCalledWith(
      'AI provider settings were saved, but pattern settings failed: pattern service unavailable'
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('saves directly when a preflight would have produced an advisory', async () => {
    api.preflightAIVerificationConfig.mockResolvedValueOnce({
      data: {
        requiresConfirmation: true,
        label: 'Budget fallback remains advisory',
        message: 'The proposed primary AI path can admit strict verification, but its budget-exhaustion fallback remains advisory for that task.',
        guidance: ['General AI settings can still be saved.']
      }
    })

    const wrapper = mountView()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.preflightAIVerificationConfig).not.toHaveBeenCalled()
    expect(api.updateAIConfig).toHaveBeenCalledTimes(1)
    expect(api.updatePatternConfig).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain('Save AI Settings Anyway')
  })

  it('renders only the server-owned current verification capability and refreshes it on demand', async () => {
    api.getAIVerificationCapability
      .mockResolvedValueOnce({
        label: 'Strict verification is available',
        message: 'Saved capability is ready.',
        guidance: [],
        primary_provider: 'private-provider',
        model: 'private-model'
      })
      .mockResolvedValueOnce({
        label: 'Strict verification needs attention',
        message: 'Saved capability needs review.',
        guidance: ['Review the saved provider settings.']
      })

    const wrapper = mountView()
    await flushPromises()

    expect(api.getAIVerificationCapability).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Saved capability is ready.')
    expect(wrapper.text()).not.toContain('private-provider')
    expect(wrapper.text()).not.toContain('private-model')

    const refreshButton = wrapper.findAll('button').find((button) => button.text().includes('Refresh now'))
    await refreshButton.trigger('click')
    await flushPromises()

    expect(api.getAIVerificationCapability).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Saved capability needs review.')
  })

  it('keeps a bounded current-capability fallback when the read fails', async () => {
    api.getAIVerificationCapability.mockRejectedValueOnce(new Error('https://provider.example.test leaked sk-secret'))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('AI readiness is unavailable')
    expect(wrapper.text()).not.toContain('provider.example.test')
    expect(wrapper.text()).not.toContain('sk-secret')
  })

  it('tests only the saved Ollama configuration and renders the server-projected result', async () => {
    api.getAIConfig.mockResolvedValueOnce({
      primary_provider: 'ollama',
      ollama_host: 'private-ollama.internal',
      ollama_port: 11434,
      ollama_model: 'gemma4:e4b'
    })
    api.getAIVerificationCapability.mockResolvedValueOnce({
      label: 'Strict verification needs attention',
      message: 'Saved Ollama needs a test.',
      guidance: [],
      ollamaVerificationCapability: {
        label: 'Ollama verification has not been tested',
        message: 'Strict verification will not call AI until tested.',
        guidance: [],
        testable: true
      }
    })
    api.testAIVerificationCapability.mockResolvedValueOnce({
      data: {
        label: 'Strict verification is available',
        message: 'Saved Ollama is ready.',
        guidance: [],
        ollamaVerificationCapability: {
          statusId: 'verification_ready',
          label: 'Ollama verification is ready',
          message: 'The saved model passed the bounded test.',
          guidance: [],
          testable: true
        }
      }
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Ollama verification has not been tested')
    expect(wrapper.text()).not.toContain('private-ollama.internal')

    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test saved Ollama verification'))
    await testButton.trigger('click')
    await flushPromises()

    expect(api.testAIVerificationCapability).toHaveBeenCalledWith()
    expect(wrapper.text()).toContain('Ollama verification is ready')
    expect(toast.success).toHaveBeenCalledWith('Ollama verification passed. Strict candidate verification is ready.')
  })

  it('reports a completed strict-verification test that is not eligible for AI use', async () => {
    api.getAIConfig.mockResolvedValueOnce({
      primary_provider: 'ollama',
      ollama_host: 'private-ollama.internal',
      ollama_port: 11434,
      ollama_model: 'gemma4:e4b'
    })
    api.getAIVerificationCapability.mockResolvedValueOnce({
      label: 'Strict verification needs attention',
      message: 'Saved Ollama needs a test.',
      guidance: [],
      ollamaVerificationCapability: {
        statusId: 'not_checked',
        label: 'Ollama verification has not been tested',
        message: 'Strict verification will not call AI until tested.',
        guidance: [],
        testable: true
      }
    })
    api.testAIVerificationCapability.mockResolvedValueOnce({
      data: {
        label: 'Strict verification needs attention',
        message: 'Saved Ollama remains classification-only.',
        guidance: [],
        ollamaVerificationCapability: {
          statusId: 'classification_only',
          label: 'Ollama is classification-only',
          message: 'The saved model did not satisfy the bounded test.',
          guidance: [],
          testable: true
        }
      }
    })

    const wrapper = mountView()
    await flushPromises()

    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test saved Ollama verification'))
    await testButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Ollama is classification-only')
    expect(toast.warning).toHaveBeenCalledWith(
      'Ollama verification completed, but strict candidate verification is not available. General AI classification remains available.'
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('shows a model-change-only, aggregate-safe shortcut to the existing manual retest', async () => {
    api.getAIConfig.mockResolvedValueOnce({
      primary_provider: 'ollama',
      ollama_host: 'private-ollama.internal',
      ollama_port: 11434,
      ollama_model: 'gemma4:e4b'
    })
    api.getAIVerificationCapability.mockResolvedValueOnce({
      label: 'Strict verification needs attention',
      message: 'The saved primary AI path cannot admit strict candidate-bound verification.',
      guidance: [],
      ollamaVerificationCapability: {
        statusId: 'model_changed',
        label: 'Ollama model changed since verification',
        message: 'The configured Ollama model no longer matches the version that passed the strict verification test. Candidate verification will not call AI until this saved configuration is tested again.',
        guidance: ['Test the saved Ollama configuration again before relying on strict candidate verification.'],
        testable: true
      }
    })
    api.getOllamaVerificationRuntimeMismatchSummary.mockResolvedValueOnce({
      modelDigestMismatchCount: '0004',
      lastObservedAt: '2026-08-29T12:34:56.000Z',
      model: 'private-model-name',
      digest: 'private-digest',
      endpoint: 'private-ollama.internal',
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Ollama model changed since verification')
    expect(wrapper.text()).toContain('will not call AI until this saved configuration is tested again')
    expect(wrapper.text()).toContain('Needs verification')
    expect(wrapper.findAll('button').some((button) => button.text().includes('Re-test saved Ollama verification'))).toBe(true)
    expect(wrapper.findAll('button').some((button) => button.text().includes('Test saved Ollama verification'))).toBe(false)
    expect(wrapper.text()).not.toContain('private-ollama.internal')
    expect(wrapper.text()).not.toContain('private-model-name')
    expect(wrapper.text()).not.toContain('private-digest')

    await openAiReadinessDiagnostics(wrapper)
    expect(wrapper.text()).toContain('4')

    const retestButton = wrapper.findAll('button').find((button) => button.text().includes('Re-test saved Ollama verification'))
    await retestButton.trigger('click')
    await flushPromises()

    expect(api.testAIVerificationCapability).toHaveBeenCalledWith()
  })

  it('refreshes the saved verification capability after AI settings persist', async () => {
    const wrapper = mountView()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateAIConfig).toHaveBeenCalledTimes(1)
    expect(api.getAIVerificationCapability).toHaveBeenCalledTimes(2)
    expect(api.getAIVerificationCapabilityChangeReceipts).not.toHaveBeenCalled()
  })

  it('saves an unsaved Ollama target once and automatically runs its strict-verification test', async () => {
    api.getAIConfig.mockResolvedValueOnce({
      primary_provider: 'ollama',
      ollama_host: 'private-ollama.internal',
      ollama_port: 11434,
      ollama_model: 'qwen3.5:4b'
    })
    api.testAIVerificationCapability.mockResolvedValueOnce({
      data: {
        label: 'Strict verification is available',
        message: 'Saved Ollama is ready.',
        guidance: [],
        ollamaVerificationCapability: {
          statusId: 'verification_ready',
          label: 'Ollama verification is ready',
          message: 'The saved model passed the bounded test.',
          guidance: [],
          testable: true
        }
      }
    })

    const wrapper = mountView()
    await flushPromises()

    wrapper.vm.config.ollama_model = 'gemma4:e4b'
    await flushPromises()

    expect(wrapper.text()).toContain('Unsaved Ollama change')
    expect(wrapper.text()).toContain('Save Changes will save the selected Ollama configuration and immediately test')

    const saveButton = wrapper.findAll('button').find((button) => (
      button.text().includes('Save Changes and Test Strict Verification')
    ))
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.preflightAIVerificationConfig).not.toHaveBeenCalled()
    expect(api.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      primary_provider: 'ollama',
      ollama_model: 'gemma4:e4b'
    }), AI_SETTINGS_WRITE_PRECONDITION)
    expect(api.testAIVerificationCapability).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Strict-verification test completed')
    expect(wrapper.text()).toContain('Ollama verification passed. Strict candidate verification is ready.')
    expect(wrapper.text()).not.toContain('private-ollama.internal')
  })

  it('renders only server-projected capability receipts and refreshes them after saving', async () => {
    api.getAIVerificationCapabilityChangeReceipts
      .mockResolvedValueOnce({
        receipts: [{
          receiptId: '7',
          before: { label: 'Strict verification needs attention' },
          after: { label: 'Strict verification is available' },
          configurationRevision: '12',
          recordedAt: '2026-08-13T12:00:00.000Z',
          provider: 'private-provider',
          model: 'private-model',
        }],
      })
      .mockResolvedValueOnce({ receipts: [] })

    const wrapper = mountView()
    await flushPromises()
    await openAiReadinessDiagnostics(wrapper)

    expect(wrapper.text()).toContain('Strict verification needs attention to Strict verification is available')
    expect(wrapper.text()).toContain('Saved revision 12')
    expect(wrapper.text()).not.toContain('private-provider')
    expect(wrapper.text()).not.toContain('private-model')

    const refreshButton = wrapper.findAll('button').find((button) => button.text().includes('Refresh now'))
    await refreshButton.trigger('click')
    await flushPromises()

    expect(api.getAIVerificationCapabilityChangeReceipts).toHaveBeenCalledWith({ limit: 5 })
    expect(api.getAIVerificationCapabilityChangeReceipts).toHaveBeenCalledTimes(1)
  })

  it('keeps the newer saved capability when an earlier summary read resolves late', async () => {
    let resolveInitialCapability
    api.getAIVerificationCapability
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveInitialCapability = resolve
      }))
      .mockResolvedValueOnce({
        label: 'Strict verification needs attention',
        message: 'Saved settings need review.',
        guidance: []
      })

    const wrapper = mountView()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    await saveButton.trigger('click')
    await flushPromises()

    resolveInitialCapability({
      label: 'Strict verification is available',
      message: 'Stale saved capability.',
      guidance: []
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Saved settings need review.')
    expect(wrapper.text()).not.toContain('Stale saved capability.')
  })

  it('does not use a draft preflight as a second save confirmation', async () => {
    api.preflightAIVerificationConfig.mockResolvedValueOnce({
      data: {
        requiresConfirmation: true,
        label: 'Strict verification needs attention',
        message: 'The proposed primary AI path remains available for general AI use but cannot admit strict candidate-bound verification.',
        guidance: []
      }
    })

    const wrapper = mountView()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    await saveButton.trigger('click')
    await flushPromises()
    expect(api.updateAIConfig).toHaveBeenCalledTimes(1)
    expect(api.preflightAIVerificationConfig).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('Save AI Settings Anyway')
  })

  it('saves general AI configuration without depending on a draft preflight', async () => {
    api.preflightAIVerificationConfig.mockRejectedValueOnce(new Error('https://private.example.test rejected sk-secret'))

    const wrapper = mountView()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateAIConfig).toHaveBeenCalledTimes(1)
    expect(api.preflightAIVerificationConfig).not.toHaveBeenCalled()
    expect(api.testAIConnection).not.toHaveBeenCalled()
    expect(api.getAIModels).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('private.example.test')
    expect(wrapper.text()).not.toContain('sk-secret')
  })

  it('saves only AI provider-owned fields and does not echo stale RAG settings', async () => {
    api.getAIConfig.mockResolvedValueOnce({
      ...baseConfig,
      embedding_provider_mode: 'cloud',
      embedding_cloud_api_key: 'embedding-key',
      embedding_cloud_model: 'text-embedding-3-large',
      image_embedding_provider_mode: 'cloud',
      image_embedding_local_api_key: null,
      image_embedding_cloud_model: 'clip-large',
      rag_enabled: true
    })

    const wrapper = mountView()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    expect(saveButton).toBeDefined()

    await saveButton.trigger('click')
    await flushPromises()

    const payload = api.updateAIConfig.mock.calls[0][0]
    expect(payload).toEqual(expect.objectContaining({
      primary_provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: 'sk-masked',
      model: 'gpt-5-mini'
    }))
    expect(payload).not.toHaveProperty('rag_enabled')
    expect(payload).not.toHaveProperty('embedding_provider_mode')
    expect(payload).not.toHaveProperty('embedding_cloud_api_key')
    expect(payload).not.toHaveProperty('embedding_cloud_model')
    expect(payload).not.toHaveProperty('image_embedding_provider_mode')
    expect(payload).not.toHaveProperty('image_embedding_local_api_key')
    expect(payload).not.toHaveProperty('image_embedding_cloud_model')
  })

  it('stops before pattern settings when the AI config save fails', async () => {
    api.updateAIConfig.mockRejectedValueOnce(new Error('provider save failed'))

    const wrapper = mountView()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    expect(saveButton).toBeDefined()

    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updatePatternConfig).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('provider save failed')
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('parses a legacy Ollama URL into host and port fields on load', async () => {
    api.getAIConfig.mockResolvedValueOnce({
      primary_provider: 'ollama',
      ollama_host: 'http://192.168.50.95:11434',
      ollama_model: 'llama3.2'
    })

    const wrapper = mountView()
    await flushPromises()

    const hostInput = wrapper.find('input[placeholder="192.168.1.100"]')
    const portInput = wrapper.find('input[placeholder="11434"]')

    expect(hostInput.element.value).toBe('192.168.50.95')
    expect(portInput.element.value).toBe('11434')
  })

  it('clears provider-scoped credentials, selected model, and prior test result when the provider changes', async () => {
    api.testAIConnection.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Connection ready'
      }
    })
    api.getAIModels.mockResolvedValue({
      data: {
        models: [{ id: 'gpt-5', name: 'GPT-5' }]
      }
    })

    const wrapper = mountView()
    await flushPromises()

    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test Connection'))
    await testButton.trigger('click')
    await flushPromises()

    const providerSelect = wrapper.find('select')
    await providerSelect.setValue('gemini')
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      primary_provider: 'gemini',
      api_endpoint: '',
      api_key: '',
      model: ''
    }), AI_SETTINGS_WRITE_PRECONDITION)
    expect(wrapper.text()).not.toContain('Connection ready')
    expect(wrapper.text()).toContain('Select a model...')
  })

  it('fetches models after a successful provider connection test', async () => {
    api.testAIConnection.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Connection ready'
      }
    })
    api.getAIModels.mockResolvedValueOnce({
      data: {
        models: [{ id: 'gpt-5', name: 'GPT-5' }, { id: 'gpt-5-mini', name: 'GPT-5 Mini' }]
      }
    })

    const wrapper = mountView()
    await flushPromises()

    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test Connection'))
    await testButton.trigger('click')
    await flushPromises()

    expect(api.testAIConnection).toHaveBeenCalledWith({
      primary_provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: 'sk-masked'
    })
    expect(api.getAIModels).toHaveBeenCalledWith({
      primary_provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: 'sk-masked'
    })
    expect(toast.success).toHaveBeenCalledWith('Connection successful!')
    expect(wrapper.text()).toContain('Connection ready')
  })

  it('clears a stale selected cloud model when fetched models do not include it', async () => {
    api.getAIModels.mockResolvedValueOnce({
      data: {
        models: [{ id: 'gpt-5', name: 'GPT-5' }]
      }
    })

    const wrapper = mountView()
    await flushPromises()

    const fetchButton = wrapper.findAll('button').find((button) => button.text().includes('Fetch'))
    expect(fetchButton).toBeDefined()

    await fetchButton.trigger('click')
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      model: ''
    }), AI_SETTINGS_WRITE_PRECONDITION)
    expect(wrapper.text()).toContain('Select a model...')
  })

  it('filters embedding models out of the Ollama generation dropdown', async () => {
    api.getAIConfig.mockResolvedValueOnce({
      primary_provider: 'ollama',
      ollama_host: 'localhost',
      ollama_port: 11434,
      ollama_model: 'llama3.2'
    })
    api.getOllamaModels.mockResolvedValueOnce([
      { name: 'llama3.2' },
      { name: 'nomic-embed-text' },
      { name: 'bge-large' },
      { name: 'mistral' }
    ])

    const wrapper = mountView()
    await flushPromises()

    const fetchButtons = wrapper.findAll('button').filter((button) => button.text().includes('🔄'))
    await fetchButtons[0].trigger('click')
    await flushPromises()

    expect(api.getOllamaModels).toHaveBeenCalledWith('localhost', 11434)
    expect(wrapper.text()).toContain('llama3.2')
    expect(wrapper.text()).toContain('mistral')
    expect(wrapper.text()).not.toContain('nomic-embed-text')
    expect(wrapper.text()).not.toContain('bge-large')
  })

  it('tests Ollama connectivity and auto-fetches models on success', async () => {
    api.getAIConfig.mockResolvedValueOnce({
      primary_provider: 'ollama',
      ollama_host: 'localhost',
      ollama_port: 11434,
      ollama_model: 'llama3.2'
    })
    api.testOllama.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Ollama is reachable'
      }
    })
    api.getOllamaModels.mockResolvedValueOnce([
      { name: 'llama3.2' }
    ])

    const wrapper = mountView()
    await flushPromises()

    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test Connection'))
    await testButton.trigger('click')
    await flushPromises()

    expect(api.testOllama).toHaveBeenCalledWith({ host: 'localhost', port: 11434 })
    expect(api.getOllamaModels).toHaveBeenCalledWith('localhost', 11434)
    expect(toast.success).toHaveBeenCalledWith('Ollama connected!')
    expect(wrapper.text()).toContain('Ollama is reachable')
  })

  it('renders scheduled Ollama preflight failure details in the settings UI', async () => {
    api.getAIConfig.mockResolvedValueOnce({
      primary_provider: 'ollama',
      ollama_host: 'localhost',
      ollama_port: 11434,
      ollama_model: 'gemma3:12b'
    })
    api.getLastOllamaPreflight.mockResolvedValueOnce({
      ai: {
        success: false,
        model: 'gemma3:12b',
        checkedAt: '2026-04-18T01:40:37.126Z',
        failureType: 'generation_timeout',
        nextScheduledAt: '2026-04-18T01:45:37.126Z',
        error: 'Connected, but generation probe failed: timeout of 15000ms exceeded'
      },
      embedding: null
    })

    const wrapper = mountView()
    await flushPromises()
    await openAiReadinessDiagnostics(wrapper)

    expect(wrapper.text()).toContain('Scheduled local preflight')
    expect(wrapper.text()).toContain('Failure type')
    expect(wrapper.text()).toContain('generation_timeout')
    expect(wrapper.text()).toContain('Next scheduled attempt')
    expect(wrapper.text()).not.toContain('Connected, but generation probe failed: timeout of 15000ms exceeded')
  })
})
