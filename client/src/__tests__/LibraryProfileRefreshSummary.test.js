/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LibraryProfileRefreshSummary from '@/components/command-center/LibraryProfileRefreshSummary.vue'

describe('LibraryProfileRefreshSummary', () => {
  it('shows a compact status and native disclosure without implying automatic routing', () => {
    const wrapper = mount(LibraryProfileRefreshSummary, { props: { report: {
      windowTruncated: false,
      summary: { current: 1, queued: 1, processing: 0, retry_wait: 0,
        waiting: 0, cooldown: 1, paused: 0, unverified: 0, no_inventory: 1 },
      libraries: [
        { libraryId: 1, name: 'Movies', statusId: 'current' },
        { libraryId: 2, name: 'TV', statusId: 'queued' },
        { libraryId: 3, name: 'Anime', statusId: 'cooldown' },
        { libraryId: 4, name: 'Empty', statusId: 'no_inventory' },
      ],
    } } })
    expect(wrapper.find('[role="status"]').text()).toContain('1 awaiting or running refresh')
    expect(wrapper.find('details summary').text()).toBe('Show per-library status')
    expect(wrapper.text()).toContain('Waiting for automatic recovery')
    expect(wrapper.find('[role="status"]').text()).toContain('1 without synced inventory')
    expect(wrapper.text()).not.toContain('route')
  })

  it('does not report a current state when the read fails', () => {
    const wrapper = mount(LibraryProfileRefreshSummary, { props: {
      errorMessage: 'Library profile refresh status is unavailable. Try again later.',
    } })
    expect(wrapper.find('[role="status"]').text()).toContain('unavailable')
    expect(wrapper.find('details').exists()).toBe(false)
  })

  it('uses installation-wide counts without presenting partial source coverage as complete', () => {
    const wrapper = mount(LibraryProfileRefreshSummary, { props: {
      report: { summary: {}, libraries: [], windowTruncated: true },
      readiness: { libraryCount: 350, activeLibraryCount: 320,
        profile: { current: 300, queued: 10, processing: 2, retryWait: 1, waiting: 3,
          cooldown: 4, unverified: 5, paused: 15, noInventory: 10 },
        recovery: { plannerOverdue: 1, workerOverdue: 2, leaseRecoveryOverdue: 0 },
        workerHealth: { statusId: 'no_recent_completion', claimableCount: 2,
          oldestClaimableAgeMinutes: 25 },
        sourceIdentity: { completeCaptureLibraryCount: 90, unresolvedItemCount: 2,
          conflictingProviderItemCount: 2 } },
    } })
    expect(wrapper.find('[role="status"]').text()).toContain('350 libraries:')
    expect(wrapper.text()).toContain('cover 90 of 320 active libraries')
    expect(wrapper.text()).toContain('3 active libraries are overdue')
    expect(wrapper.text()).toContain('2 jobs are due (oldest 25 min), with no completion')
  })

  it('explains a failed worker cycle without asserting that the process is offline', () => {
    const wrapper = mount(LibraryProfileRefreshSummary, { props: {
      report: { summary: {}, libraries: [], windowTruncated: false },
      readiness: { libraryCount: 1, activeLibraryCount: 1, profile: { current: 0, queued: 1,
        processing: 0, retryWait: 0, waiting: 0, cooldown: 0, unverified: 0, paused: 0,
        noInventory: 0 }, recovery: { plannerOverdue: 0, workerOverdue: 1,
        leaseRecoveryOverdue: 0 }, sourceIdentity: { completeCaptureLibraryCount: 0,
        unresolvedItemCount: 0 }, workerHealth: { statusId: 'cycle_failed', claimableCount: 1,
        lastSuccessAgeMinutes: 18 },
    } } })
    expect(wrapper.text()).toContain('last full success 18 min ago')
    expect(wrapper.text()).not.toContain('offline')
  })
})
