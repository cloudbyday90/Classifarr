import { mount, flushPromises } from '@vue/test-utils'
import Activity from '../Activity.vue'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Subcomponents via module mocks (required for script setup)
vi.mock('@/components/common/Card.vue', () => ({ default: { template: '<div data-testid="card"><slot name="header"></slot><slot></slot></div>' } }))
vi.mock('@/components/common/Badge.vue', () => ({ default: { template: '<span data-testid="badge"><slot></slot></span>' } }))
vi.mock('@/components/common/Button.vue', () => ({ default: { template: '<button data-testid="button"><slot></slot></button>' } }))
vi.mock('@/components/common/Spinner.vue', () => ({ default: { template: '<div data-testid="spinner"></div>' } }))
vi.mock('@/components/activity/GlobalProgressBar.vue', () => ({ default: { template: '<div data-testid="global-progress-bar"></div>', props: ['task'] } }))
// Important: Mock ActivityItemProgress so we can find it by testid
vi.mock('@/components/activity/ActivityItemProgress.vue', () => ({ default: { template: '<div data-testid="activity-item-progress"></div>', props: ['task'] } }))

// Mock API and Socket
vi.mock('@/api', () => ({
  default: {
    getLiveStats: vi.fn().mockResolvedValue({ data: { health: {}, today: {}, queue: {}, gapAnalysis: {}, enrichment: {} } }),
    getLiveFeed: vi.fn().mockResolvedValue({ data: { items: [] } }),
    getPendingTasks: vi.fn().mockResolvedValue({ data: [] }),
    getOllamaStatus: vi.fn().mockResolvedValue({ data: { isActive: false } }),
    getClassificationProgress: vi.fn().mockResolvedValue({ data: [] }),
    getQueueSettings: vi.fn().mockResolvedValue({ data: {} })
  }
}))

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  disconnect: vi.fn(),
  connected: false // Force disconnected so component uses HTTP data
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}))

describe('Activity.vue', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Active Classifications', async () => {
    // Setup initial data
    const mockTasks = [
      { taskId: 1, title: 'Movie A', method: 'ai_analysis', percent: 50 },
      { taskId: 2, title: 'Sync Library', method: 'source_library', percent: 10 },
      { taskId: 3, title: 'Show B', method: 'manual_correction', percent: 80 }
    ]
    
    // We mock the API to return our test data
    const api = (await import('@/api')).default
    api.getClassificationProgress.mockResolvedValue({ data: mockTasks })

    wrapper = mount(Activity, {
      global: {
        stubs: {
          TransitionGroup: false
        }
      }
    })

    // Wait for all promises (API calls) to resolve
    await flushPromises()
    
    const otherTasks = wrapper.findAll('[data-testid="activity-item-progress"]')
    
    // Expectation: 2 items in "Other" (Sync Library + Show B) if NOT filtered by frontend
    // Since backend filtering is implemented, the frontend just displays what it gets.
    // This test confirms frontend logic is "dumb pipe".
    expect(otherTasks.length).toBe(2)
  })
})
