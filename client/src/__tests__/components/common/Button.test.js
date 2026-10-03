/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { expect, test, vi } from 'vitest'
import Button from '@/components/common/Button.vue'

test('Button forwards the original mouse event exactly once and never during rendering', async () => {
  const onClick = vi.fn()
  const wrapper = mount(Button, { attrs: { onClick }, slots: { default: 'Save' } })
  try {
    expect(onClick).not.toHaveBeenCalled()
    const event = new MouseEvent('click', { bubbles: true })
    wrapper.get('button').element.dispatchEvent(event)
    expect(onClick).toHaveBeenCalledExactlyOnceWith(event)
    expect(wrapper.emitted('click')).toEqual([[event]])
    await wrapper.setProps({ loading: true })
    expect(wrapper.get('button').element.disabled).toBe(true)
    expect(onClick).toHaveBeenCalledTimes(1)
  } finally {
    wrapper.unmount()
  }
})

test.each(['disabled', 'loading'])('Button suppresses dispatched clicks while %s', async state => {
  const onClick = vi.fn()
  const wrapper = mount(Button, { props: { [state]: true }, attrs: { onClick } })
  try {
    wrapper.get('button').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).not.toHaveBeenCalled()
    expect(wrapper.emitted('click')).toBeUndefined()
    await wrapper.setProps({ [state]: false })
    await wrapper.get('button').trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  } finally {
    wrapper.unmount()
  }
})
