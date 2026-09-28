/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ResourceAdmissionStatus from '@/components/queue/ResourceAdmissionStatus.vue'

describe('Resource admission status', () => {
  it.each(['busy', 'memory_pressure', 'memory_unknown'])('explains %s without counts, focus changes or alerts', async reason => {
    const wrapper = mount(ResourceAdmissionStatus, { props: { stats: { workerRunning: true, resourceWaitReason: reason } } })
    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(wrapper.text()).toContain('checks again automatically')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await wrapper.setProps({ unavailable: true })
    expect(wrapper.text()).toBe('Work capacity status is updating.')
    await wrapper.setProps({ unavailable: false, stats: { workerRunning: true, resourceWaitReason: null } })
    expect(wrapper.find('p').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it.each([{}, { workerRunning: false, resourceWaitReason: 'busy' }, { workerRunning: true, resourceWaitReason: '<script>private</script>' },
    { workerRunning: true, resourceWaitReason: '__proto__' }])('hides absent, stopped or unrecognized status: %j', stats => {
    const wrapper = mount(ResourceAdmissionStatus, { props: { stats } })
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })
  it('does not invent a wait when a first request is unavailable', () => {
    const wrapper = mount(ResourceAdmissionStatus, { props: { unavailable: true } })
    expect(wrapper.text()).toBe(''); wrapper.unmount()
  })
})
