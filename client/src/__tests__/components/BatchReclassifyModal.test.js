import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BatchReclassifyModal from '@/components/BatchReclassifyModal.vue'
import { useLibrariesStore } from '@/stores/libraries'

const apiMock = vi.hoisted(() => ({
  createReclassificationBatch: vi.fn(),
  validateReclassificationBatch: vi.fn(),
  executeReclassificationBatch: vi.fn(),
  pauseReclassificationBatch: vi.fn(),
  resumeReclassificationBatch: vi.fn(),
  cancelReclassificationBatch: vi.fn(),
  getReclassificationBatchStatus: vi.fn(),
  skipReclassificationItem: vi.fn(),
  retryReclassificationItem: vi.fn()
}))

vi.mock('@/api', () => ({
  default: apiMock
}))

const ModalStub = {
  props: ['modelValue', 'title'],
  emits: ['update:modelValue'],
  template: `<div v-if="modelValue" data-test="modal">
    <div data-test="modal-title">{{ title }}</div>
    <slot /><slot name="footer" />
  </div>`
}

const ButtonStub = {
  props: ['variant', 'size', 'disabled'],
  emits: ['click'],
  template: '<button :data-variant="variant" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
}

const BadgeStub = {
  props: ['variant'],
  template: '<span data-test="badge" :data-variant="variant"><slot /></span>'
}

const SpinnerStub = {
  template: '<div data-test="spinner">Loading...</div>'
}

const mockLibraries = [
  { id: 10, name: 'Movies HD', media_type: 'movie' },
  { id: 20, name: 'TV Shows', media_type: 'series' },
  { id: 30, name: 'Anime Movies', media_type: 'movie' }
]

const mockItems = [
  { id: 1, title: 'Inception', media_type: 'movie', library_name: 'Movies SD' },
  { id: 2, title: 'Interstellar', media_type: 'movie', library_name: 'Movies SD' }
]

function mountModal(props = {}) {
  return mount(BatchReclassifyModal, {
    props: {
      modelValue: true,
      items: mockItems,
      ...props
    },
    global: {
      plugins: [pinia],
      stubs: {
        Modal: ModalStub,
        Button: ButtonStub,
        Badge: BadgeStub,
        Spinner: SpinnerStub
      }
    }
  })
}

let pinia

function seedLibraries() {
  pinia = createPinia()
  setActivePinia(pinia)
  const store = useLibrariesStore()
  store.libraries = mockLibraries
}

describe('BatchReclassifyModal.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    seedLibraries()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('configure step', () => {
    it('renders with configure step by default', () => {
      const wrapper = mountModal()
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Batch Reclassification')
    })

    it('shows item count', () => {
      const wrapper = mountModal()
      expect(wrapper.text()).toContain('2 item(s) selected for reclassification')
    })

    it('shows item titles and current libraries', () => {
      const wrapper = mountModal()
      expect(wrapper.text()).toContain('Inception')
      expect(wrapper.text()).toContain('Interstellar')
      expect(wrapper.text()).toContain('Movies SD')
    })

    it('shows compatible libraries for each item media type', () => {
      const wrapper = mountModal()
      const selects = wrapper.findAll('select')
      expect(selects).toHaveLength(2)
      const movieOptions = selects[0].findAll('option')
      const movieLibNames = movieOptions.map(o => o.text())
      expect(movieLibNames).toContain('Movies HD')
      expect(movieLibNames).toContain('Anime Movies')
      expect(movieLibNames).not.toContain('TV Shows')
    })

    it('disables validate button when not all items have targets', () => {
      const wrapper = mountModal()
      const buttons = wrapper.findAll('button')
      const validateBtn = buttons.find(b => b.text().includes('Validate'))
      expect(validateBtn.attributes('disabled')).not.toBeUndefined()
    })

    it('enables validate button when all items have targets', async () => {
      const wrapper = mountModal()
      const selects = wrapper.findAll('select')
      await selects[0].setValue('10')
      await selects[1].setValue('30')
      await flushPromises()

      const buttons = wrapper.findAll('button')
      const validateBtn = buttons.find(b => b.text().includes('Validate'))
      expect(validateBtn.attributes('disabled')).toBeUndefined()
    })

    it('shows pause on error checkbox checked by default', () => {
      const wrapper = mountModal()
      const checkbox = wrapper.find('input[type="checkbox"]')
      expect(checkbox.element.checked).toBe(true)
    })

    it('closes on cancel button click', async () => {
      const wrapper = mountModal()
      const buttons = wrapper.findAll('button')
      const cancelBtn = buttons.find(b => b.text().includes('Cancel'))
      await cancelBtn.trigger('click')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('handles empty items list', () => {
      const wrapper = mountModal({ items: [] })
      expect(wrapper.text()).toContain('0 item(s) selected for reclassification')
    })
  })

  describe('validation flow', () => {
    it('transitions to validating step on validate click', async () => {
      apiMock.createReclassificationBatch.mockResolvedValue({
        data: { id: 'batch-1' }
      })
      apiMock.validateReclassificationBatch.mockResolvedValue({
        data: {
          status: 'validated',
          items: [
            { id: 1, title: 'Inception', status: 'validated', original_library_name: 'Movies SD', target_library_name: 'Movies HD' },
            { id: 2, title: 'Interstellar', status: 'validated', original_library_name: 'Movies SD', target_library_name: 'Anime Movies' }
          ]
        }
      })

      const wrapper = mountModal()
      const selects = wrapper.findAll('select')
      await selects[0].setValue('10')
      await selects[1].setValue('30')
      await flushPromises()

      const buttons = wrapper.findAll('button')
      const validateBtn = buttons.find(b => b.text().includes('Validate'))
      await validateBtn.trigger('click')
      await flushPromises()

      expect(apiMock.createReclassificationBatch).toHaveBeenCalledWith(
        [
          { classificationId: 1, targetLibraryId: 10 },
          { classificationId: 2, targetLibraryId: 30 }
        ],
        true
      )
      expect(apiMock.validateReclassificationBatch).toHaveBeenCalledWith('batch-1')
    })

    it('shows validating spinner while validating', async () => {
      let resolveCreate
      apiMock.createReclassificationBatch.mockReturnValue(new Promise(r => { resolveCreate = r }))

      const wrapper = mountModal()
      const selects = wrapper.findAll('select')
      await selects[0].setValue('10')
      await selects[1].setValue('30')
      await flushPromises()

      const buttons = wrapper.findAll('button')
      const validateBtn = buttons.find(b => b.text().includes('Validate'))
      await validateBtn.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('Validating')
      expect(wrapper.find('[data-test="spinner"]').exists()).toBe(true)

      resolveCreate({ data: { id: 'batch-1' } })
      apiMock.validateReclassificationBatch.mockResolvedValue({
        data: { status: 'validated', items: [] }
      })
      await flushPromises()
    })

    it('shows validation results with valid and invalid counts', async () => {
      apiMock.createReclassificationBatch.mockResolvedValue({ data: { id: 'batch-1' } })
      apiMock.validateReclassificationBatch.mockResolvedValue({
        data: {
          status: 'validated',
          items: [
            { id: 1, title: 'Inception', status: 'validated', original_library_name: 'Movies SD', target_library_name: 'Movies HD' },
            { id: 2, title: 'Interstellar', status: 'invalid', original_library_name: 'Movies SD', target_library_name: 'Anime Movies' }
          ]
        }
      })

      const wrapper = mountModal()
      const selects = wrapper.findAll('select')
      await selects[0].setValue('10')
      await selects[1].setValue('30')
      await flushPromises()

      await wrapper.vm.startValidation()
      await flushPromises()

      expect(wrapper.text()).toContain('1 Valid')
      expect(wrapper.text()).toContain('1 Invalid')
      expect(wrapper.text()).toContain('Some items failed validation')
    })

    it('shows execute button with valid count when items are valid', async () => {
      apiMock.createReclassificationBatch.mockResolvedValue({ data: { id: 'batch-1' } })
      apiMock.validateReclassificationBatch.mockResolvedValue({
        data: {
          status: 'validated',
          items: [
            { id: 1, title: 'Inception', status: 'validated', original_library_name: 'A', target_library_name: 'B' }
          ]
        }
      })

      const wrapper = mountModal()
      const selects = wrapper.findAll('select')
      await selects[0].setValue('10')
      await selects[1].setValue('30')
      await flushPromises()

      await wrapper.vm.startValidation()
      await flushPromises()

      const buttons = wrapper.findAll('button')
      const execBtn = buttons.find(b => b.text().includes('Execute'))
      expect(execBtn).toBeTruthy()
      expect(execBtn.text()).toContain('Execute 1 Items')
    })

    it('does not show execute button when no valid items', async () => {
      apiMock.createReclassificationBatch.mockResolvedValue({ data: { id: 'batch-1' } })
      apiMock.validateReclassificationBatch.mockResolvedValue({
        data: {
          status: 'validated',
          items: [
            { id: 1, title: 'Inception', status: 'invalid', original_library_name: 'A', target_library_name: 'B' }
          ]
        }
      })

      const wrapper = mountModal({ items: [mockItems[0]] })
      const selects = wrapper.findAll('select')
      await selects[0].setValue('10')
      await flushPromises()

      await wrapper.vm.startValidation()
      await flushPromises()

      const buttons = wrapper.findAll('button')
      const execBtn = buttons.find(b => b.text().includes('Execute'))
      expect(execBtn).toBeUndefined()
    })

    it('goes back to configure on back button', async () => {
      apiMock.createReclassificationBatch.mockResolvedValue({ data: { id: 'batch-1' } })
      apiMock.validateReclassificationBatch.mockResolvedValue({
        data: { status: 'validated', items: [] }
      })

      const wrapper = mountModal()
      const selects = wrapper.findAll('select')
      await selects[0].setValue('10')
      await selects[1].setValue('30')
      await flushPromises()

      await wrapper.vm.startValidation()
      await flushPromises()

      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Validation Complete')

      const buttons = wrapper.findAll('button')
      const backBtn = buttons.find(b => b.text().includes('Back'))
      await backBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Batch Reclassification')
    })

    it('handles validation failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      apiMock.createReclassificationBatch.mockRejectedValue(new Error('Server error'))

      const wrapper = mountModal()
      const selects = wrapper.findAll('select')
      await selects[0].setValue('10')
      await selects[1].setValue('30')
      await flushPromises()

      await wrapper.vm.startValidation()
      await flushPromises()

      expect(consoleSpy).toHaveBeenCalledWith('Validation failed:', expect.any(Error))
      expect(alertSpy).toHaveBeenCalledWith('Validation failed: Server error')
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Batch Reclassification')

      consoleSpy.mockRestore()
      alertSpy.mockRestore()
    })
  })

  describe('execution flow', () => {
    async function setupToExecute(wrapper) {
      apiMock.createReclassificationBatch.mockResolvedValue({ data: { id: 'batch-1' } })
      apiMock.validateReclassificationBatch.mockResolvedValue({
        data: {
          status: 'validated',
          items: [
            { id: 1, title: 'Inception', status: 'validated', original_library_name: 'A', target_library_name: 'B' },
            { id: 2, title: 'Interstellar', status: 'validated', original_library_name: 'A', target_library_name: 'C' }
          ]
        }
      })

      const selects = wrapper.findAll('select')
      await selects[0].setValue('10')
      await selects[1].setValue('30')
      await flushPromises()

      await wrapper.vm.startValidation()
      await flushPromises()
    }

    it('starts execution and shows progress', async () => {
      apiMock.executeReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'executing',
        progress: { total: 2, completed: 1, failed: 0, skipped: 0, percentage: 50 }
      })

      const wrapper = mountModal()
      await setupToExecute(wrapper)

      await wrapper.vm.startExecution()
      await flushPromises()

      expect(apiMock.executeReclassificationBatch).toHaveBeenCalledWith('batch-1')
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Executing Batch')

      vi.advanceTimersByTime(2000)
      await flushPromises()

      expect(wrapper.text()).toContain('1/2')
      expect(wrapper.text()).toContain('1 Completed')
    })

    it('polls for status updates during execution', async () => {
      apiMock.executeReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus
        .mockResolvedValueOnce({
          status: 'executing',
          progress: { total: 2, completed: 0, failed: 0, skipped: 0, percentage: 0 }
        })
        .mockResolvedValueOnce({
          status: 'completed',
          progress: { total: 2, completed: 2, failed: 0, skipped: 0, percentage: 100 }
        })

      const wrapper = mountModal()
      await setupToExecute(wrapper)

      await wrapper.vm.startExecution()
      await flushPromises()

      vi.advanceTimersByTime(2000)
      await flushPromises()

      expect(apiMock.getReclassificationBatchStatus).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(2000)
      await flushPromises()

      expect(apiMock.getReclassificationBatchStatus).toHaveBeenCalledTimes(2)
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Batch Complete')
    })

    it('transitions to complete when batch finishes', async () => {
      apiMock.executeReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'completed',
        progress: { total: 2, completed: 2, failed: 0, skipped: 0, percentage: 100 }
      })

      const wrapper = mountModal()
      await setupToExecute(wrapper)

      await wrapper.vm.startExecution()
      await flushPromises()

      vi.advanceTimersByTime(2000)
      await flushPromises()
      vi.advanceTimersByTime(2000)
      await flushPromises()

      expect(wrapper.text()).toContain('2 Completed')
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Batch Complete')
      expect(wrapper.emitted('complete')).toBeTruthy()
    })

    it('shows failed and skipped counts', async () => {
      apiMock.executeReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus
        .mockResolvedValueOnce({
          status: 'executing',
          progress: { total: 3, completed: 0, failed: 0, skipped: 0, percentage: 0 }
        })
        .mockResolvedValueOnce({
          status: 'completed',
          progress: { total: 3, completed: 1, failed: 1, skipped: 1, percentage: 33 }
        })

      const wrapper = mountModal()
      await setupToExecute(wrapper)

      await wrapper.vm.startExecution()
      await flushPromises()

      vi.advanceTimersByTime(2000)
      await flushPromises()
      vi.advanceTimersByTime(2000)
      await flushPromises()

      expect(wrapper.text()).toContain('1 Completed')
      expect(wrapper.text()).toContain('1 Failed')
      expect(wrapper.text()).toContain('1 Skipped')
    })

    it('shows warning icon when batch finishes with issues', async () => {
      apiMock.executeReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'cancelled',
        progress: { total: 2, completed: 1, failed: 0, skipped: 1, percentage: 50 }
      })

      const wrapper = mountModal()
      await setupToExecute(wrapper)

      await wrapper.vm.startExecution()
      await flushPromises()

      vi.advanceTimersByTime(2000)
      await flushPromises()

      expect(wrapper.text()).toContain('Batch Finished with Issues')
    })

    it('stops polling on close', async () => {
      apiMock.executeReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'executing',
        progress: { total: 2, completed: 0, failed: 0, skipped: 0, percentage: 0 }
      })

      const wrapper = mountModal()
      await setupToExecute(wrapper)

      await wrapper.vm.startExecution()
      await flushPromises()

      const pollCountBefore = apiMock.getReclassificationBatchStatus.mock.calls.length

      wrapper.vm.close()
      await flushPromises()

      vi.advanceTimersByTime(10000)
      await flushPromises()

      expect(apiMock.getReclassificationBatchStatus.mock.calls.length).toBe(pollCountBefore)
    })
  })

  describe('pause and resume', () => {
    it('pauses batch', async () => {
      apiMock.pauseReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'paused',
        items: [{ id: 1, title: 'Inception', status: 'failed', original_library_name: 'A', target_library_name: 'B' }],
        progress: { total: 1, completed: 0, failed: 1, skipped: 0, percentage: 0 },
        error_message: 'Item failed processing'
      })

      const wrapper = mountModal({ items: [mockItems[0]] })
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.step = 'executing'
      wrapper.vm.batchStatus = {
        status: 'executing',
        progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 }
      }
      await flushPromises()

      await wrapper.vm.pauseBatch()
      await flushPromises()

      expect(apiMock.pauseReclassificationBatch).toHaveBeenCalledWith('batch-1')
      expect(wrapper.vm.batchStatus.status).toBe('paused')
      expect(wrapper.text()).toContain('Execution Paused')
      expect(wrapper.text()).toContain('Item failed processing')
    })

    it('resumes batch', async () => {
      apiMock.resumeReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'executing',
        progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 }
      })

      const wrapper = mountModal({ items: [mockItems[0]] })
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.step = 'executing'
      wrapper.vm.batchStatus = { status: 'paused', progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 } }
      await flushPromises()

      await wrapper.vm.resumeBatch()
      await flushPromises()

      expect(apiMock.resumeReclassificationBatch).toHaveBeenCalledWith('batch-1')
    })
  })

  describe('skip and retry on paused batch', () => {
    it('skips failed item and resumes', async () => {
      apiMock.skipReclassificationItem.mockResolvedValue({})
      apiMock.resumeReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'executing',
        progress: { total: 1, completed: 0, failed: 0, skipped: 1, percentage: 0 }
      })

      const wrapper = mountModal({ items: [mockItems[0]] })
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.step = 'executing'
      wrapper.vm.batchStatus = {
        status: 'paused',
        items: [{ id: 1, title: 'Inception', status: 'failed', original_library_name: 'A', target_library_name: 'B' }],
        progress: { total: 1, completed: 0, failed: 1, skipped: 0, percentage: 0 },
        error_message: 'Processing error'
      }
      await flushPromises()

      await wrapper.vm.skipCurrentItem()
      await flushPromises()

      expect(apiMock.skipReclassificationItem).toHaveBeenCalledWith('batch-1', 1)
      expect(apiMock.resumeReclassificationBatch).toHaveBeenCalled()
    })

    it('retries failed item', async () => {
      apiMock.retryReclassificationItem.mockResolvedValue({})
      apiMock.resumeReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'executing',
        progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 }
      })

      const wrapper = mountModal({ items: [mockItems[0]] })
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.step = 'executing'
      wrapper.vm.batchStatus = {
        status: 'paused',
        items: [{ id: 1, title: 'Inception', status: 'failed', original_library_name: 'A', target_library_name: 'B' }],
        progress: { total: 1, completed: 0, failed: 1, skipped: 0, percentage: 0 },
        error_message: 'Processing error'
      }
      await flushPromises()

      await wrapper.vm.retryCurrentItem()
      await flushPromises()

      expect(apiMock.retryReclassificationItem).toHaveBeenCalledWith('batch-1', 1)
      expect(apiMock.resumeReclassificationBatch).toHaveBeenCalled()
    })

    it('does nothing when no failed item exists for skip', async () => {
      const wrapper = mountModal({ items: [mockItems[0]] })
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.batchStatus = {
        status: 'paused',
        items: [{ id: 1, title: 'Inception', status: 'validated' }],
        progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 }
      }
      await flushPromises()

      await wrapper.vm.skipCurrentItem()
      await flushPromises()

      expect(apiMock.skipReclassificationItem).not.toHaveBeenCalled()
    })

    it('handles skip API error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      apiMock.skipReclassificationItem.mockRejectedValue(new Error('Skip failed'))

      const wrapper = mountModal({ items: [mockItems[0]] })
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.batchStatus = {
        status: 'paused',
        items: [{ id: 1, title: 'Inception', status: 'failed' }],
        progress: { total: 1, completed: 0, failed: 1, skipped: 0, percentage: 0 }
      }
      await flushPromises()

      await wrapper.vm.skipCurrentItem()
      await flushPromises()

      expect(consoleSpy).toHaveBeenCalledWith('Skip failed:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('handles retry API error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      apiMock.retryReclassificationItem.mockRejectedValue(new Error('Retry failed'))

      const wrapper = mountModal({ items: [mockItems[0]] })
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.batchStatus = {
        status: 'paused',
        items: [{ id: 1, title: 'Inception', status: 'failed' }],
        progress: { total: 1, completed: 0, failed: 1, skipped: 0, percentage: 0 }
      }
      await flushPromises()

      await wrapper.vm.retryCurrentItem()
      await flushPromises()

      expect(consoleSpy).toHaveBeenCalledWith('Retry failed:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('cancel batch', () => {
    it('cancels remaining items and transitions to complete', async () => {
      apiMock.cancelReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'cancelled',
        progress: { total: 2, completed: 1, failed: 0, skipped: 1, percentage: 50 }
      })

      const wrapper = mountModal()
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.step = 'executing'
      await flushPromises()

      await wrapper.vm.cancelBatch()
      await flushPromises()

      expect(apiMock.cancelReclassificationBatch).toHaveBeenCalledWith('batch-1')
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Batch Complete')
    })

    it('handles cancel API error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      apiMock.cancelReclassificationBatch.mockRejectedValue(new Error('Cancel failed'))

      const wrapper = mountModal()
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.step = 'executing'
      await flushPromises()

      await wrapper.vm.cancelBatch()
      await flushPromises()

      expect(consoleSpy).toHaveBeenCalledWith('Cancel failed:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('modal close and cleanup', () => {
    it('resets state on close', async () => {
      const wrapper = mountModal()
      wrapper.vm.step = 'validated'
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.batchStatus = { status: 'validated' }
      wrapper.vm.itemTargets = { 1: '10' }
      await flushPromises()

      wrapper.vm.close()
      await flushPromises()

      expect(wrapper.vm.step).toBe('configure')
      expect(wrapper.vm.batchId).toBeNull()
      expect(wrapper.vm.batchStatus).toBeNull()
      expect(wrapper.vm.itemTargets).toEqual({})
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('initializes item targets from items prop', async () => {
      const wrapper = mountModal({ items: [{ id: 5, title: 'Test', media_type: 'movie' }] })
      await flushPromises()
      expect(wrapper.vm.itemTargets).toEqual({ 5: '' })
    })

    it('re-initializes item targets when items prop changes', async () => {
      const wrapper = mountModal()
      await flushPromises()
      expect(wrapper.vm.itemTargets).toEqual({ 1: '', 2: '' })

      await wrapper.setProps({
        items: [{ id: 3, title: 'New Item', media_type: 'movie', library_name: 'Lib' }]
      })
      await flushPromises()

      expect(wrapper.vm.itemTargets).toEqual({ 3: '' })
    })

    it('stops polling when modal closes via prop change', async () => {
      apiMock.executeReclassificationBatch.mockResolvedValue({})
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'executing',
        progress: { total: 2, completed: 0, failed: 0, skipped: 0, percentage: 0 }
      })

      const wrapper = mountModal()

      apiMock.createReclassificationBatch.mockResolvedValue({ data: { id: 'batch-1' } })
      apiMock.validateReclassificationBatch.mockResolvedValue({
        data: { status: 'validated', items: [{ id: 1, title: 'A', status: 'validated', original_library_name: 'X', target_library_name: 'Y' }] }
      })

      const selects = wrapper.findAll('select')
      await selects[0].setValue('10')
      await selects[1].setValue('30')
      await flushPromises()

      await wrapper.vm.startValidation()
      await flushPromises()
      await wrapper.vm.startExecution()
      await flushPromises()

      const pollCount = apiMock.getReclassificationBatchStatus.mock.calls.length

      await wrapper.setProps({ modelValue: false })
      await flushPromises()

      vi.advanceTimersByTime(10000)
      await flushPromises()

      expect(apiMock.getReclassificationBatchStatus.mock.calls.length).toBe(pollCount)
    })
  })

  describe('refreshBatchStatus edge cases', () => {
    it('does nothing when batchId is null', async () => {
      const wrapper = mountModal()
      wrapper.vm.batchId = null
      await flushPromises()

      await wrapper.vm.refreshBatchStatus()
      await flushPromises()

      expect(apiMock.getReclassificationBatchStatus).not.toHaveBeenCalled()
    })

    it('handles status refresh error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      apiMock.getReclassificationBatchStatus.mockRejectedValue(new Error('Network error'))

      const wrapper = mountModal()
      wrapper.vm.batchId = 'batch-1'
      await flushPromises()

      await wrapper.vm.refreshBatchStatus()
      await flushPromises()

      expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh status:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('transitions to complete on cancelled status', async () => {
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'cancelled',
        progress: { total: 1, completed: 0, failed: 0, skipped: 1, percentage: 0 }
      })

      const wrapper = mountModal()
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.step = 'executing'
      await flushPromises()

      await wrapper.vm.refreshBatchStatus()
      await flushPromises()

      expect(wrapper.vm.step).toBe('complete')
      expect(wrapper.emitted('complete')).toBeTruthy()
    })

    it('transitions to complete on failed status', async () => {
      apiMock.getReclassificationBatchStatus.mockResolvedValue({
        status: 'failed',
        progress: { total: 1, completed: 0, failed: 1, skipped: 0, percentage: 0 }
      })

      const wrapper = mountModal()
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.step = 'executing'
      await flushPromises()

      await wrapper.vm.refreshBatchStatus()
      await flushPromises()

      expect(wrapper.vm.step).toBe('complete')
    })
  })

  describe('execution error handling', () => {
    it('handles execute API error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      apiMock.executeReclassificationBatch.mockRejectedValue(new Error('Exec failed'))

      const wrapper = mountModal()
      wrapper.vm.batchId = 'batch-1'
      wrapper.vm.step = 'validated'
      await flushPromises()

      await wrapper.vm.startExecution()
      await flushPromises()

      expect(consoleSpy).toHaveBeenCalledWith('Execution failed:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('handles pause API error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      apiMock.pauseReclassificationBatch.mockRejectedValue(new Error('Pause failed'))

      const wrapper = mountModal()
      wrapper.vm.batchId = 'batch-1'
      await flushPromises()

      await wrapper.vm.pauseBatch()
      await flushPromises()

      expect(consoleSpy).toHaveBeenCalledWith('Pause failed:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('handles resume API error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      apiMock.resumeReclassificationBatch.mockRejectedValue(new Error('Resume failed'))

      const wrapper = mountModal()
      wrapper.vm.batchId = 'batch-1'
      await flushPromises()

      await wrapper.vm.resumeBatch()
      await flushPromises()

      expect(consoleSpy).toHaveBeenCalledWith('Resume failed:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })
})
