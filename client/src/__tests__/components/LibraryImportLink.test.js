/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount, RouterLinkStub } from '@vue/test-utils'
import { expect, it } from 'vitest'
import LibraryImportLink from '@/components/library/LibraryImportLink.vue'

it.each(['awaiting_import', 'legacy_owner_unknown', 'retry_wait', 'active'])('links %s to the affected library using text, not color', state => {
  const wrapper = mount(LibraryImportLink, { props: { library: { id: 57, name: 'Any library', ingestion_status: { state } } },
    global: { stubs: { RouterLink: RouterLinkStub } } })
  expect(wrapper.getComponent(RouterLinkStub).props('to')).toBe('/libraries/57')
  expect(wrapper.get('a').attributes('aria-label')).toContain('Any library')
  expect(wrapper.text().length).toBeGreaterThan(5)
  wrapper.unmount()
})

it('does not claim a complete library needs recovery', () => {
  const wrapper = mount(LibraryImportLink, { props: { library: { id: 57, ingestion_status: { state: 'complete' } } } })
  expect(wrapper.find('a').exists()).toBe(false)
  wrapper.unmount()
})
