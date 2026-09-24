/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const getSourceLibraryDiscovery = vi.fn()
vi.mock('@/api', () => ({ default: { getSourceLibraryDiscovery: (...args) => getSourceLibraryDiscovery(...args) } }))
import SourceLibraryDiscovery from '@/components/library/SourceLibraryDiscovery.vue'

beforeEach(() => getSourceLibraryDiscovery.mockReset())

describe('SourceLibraryDiscovery', () => {
  it('shows only a read-only section summary and refreshes after sync', async () => {
    getSourceLibraryDiscovery.mockResolvedValue({ version: 'source_library_discovery.v1',
      admission: 'read_only', truncated: false,
      libraries: [{ id: 1, name: 'My Music', mediaType: 'music',
        isPresent: true, firstSeenAt: '2026-09-24T10:00:00Z', lastSeenAt: '2026-09-24T11:00:00Z' }] })
    const wrapper = mount(SourceLibraryDiscovery)
    await flushPromises()
    expect(wrapper.text()).toContain('My Music · music · present at last sync · read-only')
    expect(wrapper.text()).toContain('does not scan their items')
    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.setProps({ refreshKey: 1 })
    await flushPromises()
    expect(getSourceLibraryDiscovery).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('shows a safe unavailable state for an invalid response', async () => {
    getSourceLibraryDiscovery.mockResolvedValue({ admission: 'routing_inventory' })
    const wrapper = mount(SourceLibraryDiscovery)
    await flushPromises()
    expect(wrapper.text()).toContain('Source library discovery is unavailable')
  })
})
