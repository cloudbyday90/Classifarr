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
})
