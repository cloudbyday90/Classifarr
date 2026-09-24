/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MoveRecoveryStatus from '@/components/history/MoveRecoveryStatus.vue'

describe('MoveRecoveryStatus', () => {
  it.each(['moving', 'files_verified'])('explains automatic %s recovery without approval', state => {
    const wrapper = mount(MoveRecoveryStatus, { props: { recovery: { operationId: 'test-reference', state } } })
    expect(wrapper.text()).toContain('retry verification automatically')
    expect(wrapper.text()).toContain('No additional approval is needed')
    expect(wrapper.find('summary').text()).toBe('Move recovery reference')
  })
  it('explains stopped recovery and preserves the reference as escaped text', () => {
    const wrapper = mount(MoveRecoveryStatus, { props: { recovery: {
      operationId: '<script>bad</script>', state: 'needs_attention', reasonCode: 'move_mapping_changed',
    } } })
    expect(wrapper.text()).toContain('Automatic recovery is stopped')
    expect(wrapper.text()).toContain('retry the original destination')
    expect(wrapper.find('script').exists()).toBe(false)
  })
  it('retains success after journal detail expires without inventing confidence', () => {
    const wrapper = mount(MoveRecoveryStatus, { props: { reconciled: true } })
    expect(wrapper.text()).toContain('Move completed and verified')
    expect(wrapper.text()).toContain('not a new classification confidence score')
    expect(wrapper.find('details').exists()).toBe(false)
  })
  it('keeps compact rows quiet and hides unknown/missing states', () => {
    const wrapper = mount(MoveRecoveryStatus, { props: { compact: true, recovery: { state: 'completed' } } })
    expect(wrapper.text()).toBe('Move completed and verified')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(mount(MoveRecoveryStatus).text()).toBe('')
    expect(mount(MoveRecoveryStatus, { props: { recovery: { state: 'unknown' } } }).text()).toBe('')
  })
})
