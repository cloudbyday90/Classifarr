/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import LibraryRecoveryBanner from '@/components/command-center/LibraryRecoveryBanner.vue'
import { libraryRecoveryReport } from '@/utils/libraryRecoveryGuidance'

const report = (count = 1, mode = 'review') => libraryRecoveryReport(Array.from({ length: count }, (_, i) => ({
  id: i + 1, name: i ? `Library ${i + 1}` : '<img src=x onerror=alert(1)>', media_type: 'movie',
  ingestion_status: { state: 'legacy_owner_unknown', recoveryMode: mode },
})))
const mountBanner = data => mount(LibraryRecoveryBanner, { props: { report: data }, global: { plugins: [
  createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] }),
] } })

describe('library recovery banner', () => {
  it('bounds rows, escapes names, exposes navigation only and emits a read-only refresh', async () => {
    const wrapper = mountBanner(report(8))
    expect(wrapper.findAll('li')).toHaveLength(5)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual(['/libraries/1', '/libraries/2', '/libraries/3', '/libraries/4', '/libraries/5', '/libraries'])
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    await wrapper.setProps({ refreshing: true })
    expect(wrapper.get('button').attributes('aria-disabled')).toBe('true')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
  it('keeps the live region mounted through resolution and unavailable status', async () => {
    const wrapper = mountBanner(report())
    const region = wrapper.get('[role="status"]').element
    expect(wrapper.get('[role="status"]').attributes('aria-atomic')).toBe('true')
    await wrapper.setProps({ report: libraryRecoveryReport([], { unavailable: true }) })
    expect(wrapper.findAll('a')).toHaveLength(0)
    expect(wrapper.text()).toContain('Library status unavailable')
    await wrapper.setProps({ report: libraryRecoveryReport([]) })
    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').element).toBe(region)
    expect(wrapper.get('[role="status"]').text()).toBe('No library import issues reported.')
  })
  it('keeps normal recovery collapsed and gives bounded deployment guidance when verified', () => {
    const progress = mountBanner(report(1, 'automatic'))
    expect(progress.get('details').attributes('open')).toBeUndefined()
    expect(progress.text()).toContain('No action is needed')
    const deployment = mountBanner(report(1, 'deployment_required'))
    expect(deployment.text()).toContain('Setup check unavailable')
    expect(deployment.text()).not.toContain('ownership')
    expect(deployment.text()).not.toContain('Compose')
    expect(deployment.findAll('button')).toHaveLength(2)
    expect(deployment.findAll('button')[1].text()).toBe('View migration diagnostics')
  })
})
