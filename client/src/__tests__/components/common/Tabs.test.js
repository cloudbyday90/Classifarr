/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Tabs from '@/components/common/Tabs.vue'

const tabs = [
  { id: 'one', label: 'One', icon: '📋', badge: 0 },
  { id: 'two', label: 'Two', badge: '3' },
  { id: 'three', label: 'Three' },
]
let wrapper, host
afterEach(() => {
  wrapper?.unmount()
  host?.remove()
})

function mountTabs(props = {}, options = {}) {
  host = document.createElement('fieldset')
  document.body.append(host)
  wrapper = mount(Tabs, {
    attachTo: host,
    props: { tabs, modelValue: 'one', label: 'Choices', 'onUpdate:modelValue': id => wrapper.setProps({ modelValue: id }), ...props },
    slots: { one: '<p>First panel</p>', two: '<button>Second action</button>', three: '<p>Third panel</p>' },
    ...options,
  })
  return wrapper.findAll('[role="tab"]')
}

describe('Tabs contracts', () => {
  it('provides named tabs, reciprocal panels, zero badges and one sequential tab stop', () => {
    const controls = mountTabs()
    expect(wrapper.get('[role="tablist"]').attributes()).toMatchObject({ 'aria-label': 'Choices', 'aria-orientation': 'horizontal' })
    expect(wrapper.find('nav').exists()).toBe(false)
    expect(controls.map(tab => tab.attributes('aria-selected'))).toEqual(['true', 'false', 'false'])
    expect(controls.map(tab => tab.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(controls.every(tab => tab.attributes('type') === 'button')).toBe(true)
    expect(controls[0].get('[aria-hidden="true"]').text()).toBe('📋')
    expect(controls[0].text()).toContain('0')
    for (const [index, tab] of controls.entries()) {
      const panel = document.getElementById(tab.attributes('aria-controls'))
      expect(panel.getAttribute('role')).toBe('tabpanel')
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.attributes('id'))
      expect(panel.hidden).toBe(index !== 0)
      expect(panel.tabIndex).toBe(0)
    }
    expect(wrapper.findAll('[role="tabpanel"]')[1].text()).toBe('')
  })

  it('separates arrow/Home/End focus from controlled selection and restores the selected entry point', async () => {
    const controls = mountTabs()
    controls[0].element.focus()
    for (const [key, target] of [['ArrowLeft', 2], ['ArrowRight', 0], ['End', 2], ['Home', 0], ['ArrowRight', 1]]) {
      const current = controls.find(tab => tab.element === document.activeElement)
      await current.trigger('keydown', { key })
      expect(document.activeElement).toBe(controls[target].element)
      expect(controls[target].attributes('tabindex')).toBe('0')
      expect(wrapper.findAll('[role="tab"][tabindex="0"]')).toHaveLength(1)
    }
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(controls[0].attributes('aria-selected')).toBe('true')
    wrapper.get('[role="tabpanel"]').element.focus()
    await nextTick()
    expect(controls[0].attributes('tabindex')).toBe('0')
    expect(controls[1].attributes('tabindex')).toBe('-1')
  })

  it('activates once, never on focus alone, and accepts parent-driven selection without stealing focus', async () => {
    const controls = mountTabs()
    controls[1].element.focus()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await controls[1].trigger('click')
    await controls[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['two']])
    expect(wrapper.findAll('[role="tabpanel"]')[0].text()).toBe('')
    expect(wrapper.findAll('[role="tabpanel"]')[1].text()).toBe('Second action')
    const outside = document.createElement('button')
    host.append(outside)
    outside.focus()
    await wrapper.setProps({ modelValue: 'three' })
    expect(document.activeElement).toBe(outside)
    expect(controls[2].attributes('aria-selected')).toBe('true')
    expect(controls[2].attributes('tabindex')).toBe('0')
  })

  it('keeps the parent authoritative when it does not accept a requested selection', async () => {
    const onUpdate = vi.fn()
    const controls = mountTabs({ 'onUpdate:modelValue': onUpdate })
    await controls[1].trigger('click')
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('two')
    expect(controls[0].attributes('aria-selected')).toBe('true')
    expect(controls[1].attributes('aria-selected')).toBe('false')
    expect(wrapper.findAll('[role="tabpanel"]')[0].text()).toBe('First panel')
  })

  it('reveals focused tabs with nearest, non-animated scrolling', async () => {
    const controls = mountTabs()
    const scrollIntoView = vi.fn()
    controls[1].element.scrollIntoView = scrollIntoView
    controls[0].element.focus()
    await controls[0].trigger('keydown', { key: 'ArrowRight' })
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it.each([
    { key: 'ArrowDown' }, { key: 'ArrowUp' }, { key: 'Tab' }, { key: 'Delete' },
    { key: 'ArrowRight', ctrlKey: true }, { key: 'ArrowLeft', altKey: true },
    { key: 'End', metaKey: true }, { key: 'Home', shiftKey: true }, { key: 'ArrowRight', isComposing: true },
  ])('leaves unrelated or modified keys native: %j', async options => {
    const controls = mountTabs()
    controls[0].element.focus()
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options })
    controls[0].element.dispatchEvent(event)
    await nextTick()
    expect(event.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(controls[0].element)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('uses current DOM order after reorder and keeps IDs stable', async () => {
    const controls = mountTabs()
    const ids = controls.map(tab => tab.attributes('id'))
    await wrapper.setProps({ tabs: [tabs[2], tabs[0], tabs[1]] })
    const reordered = wrapper.findAll('[role="tab"]')
    expect(reordered.map(tab => tab.attributes('id'))).toEqual([ids[2], ids[0], ids[1]])
    reordered[0].element.focus()
    await reordered[0].trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(reordered[1].element)
  })

  it('recovers focus when a focused tab disappears without auto-selecting a replacement', async () => {
    const controls = mountTabs({ modelValue: 'two' })
    controls[1].element.focus()
    await nextTick()
    await wrapper.setProps({ tabs: [tabs[0], tabs[2]] })
    expect(document.activeElement).toBe(wrapper.get('[role="tab"]').element)
    expect(wrapper.findAll('[role="tabpanel"]').every(panel => panel.element.hidden)).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.get('[role="tab"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['one']])
  })

  it('handles empty and invalid selections without rendering an arbitrary slot', async () => {
    mountTabs({ modelValue: 'private' }, { slots: { private: '<p>Unlisted content</p>' } })
    expect(wrapper.text()).not.toContain('Unlisted content')
    expect(wrapper.findAll('[role="tab"][tabindex="0"]')).toHaveLength(1)
    await wrapper.setProps({ tabs: [] })
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.find('[role="tabpanel"]').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('filters malformed entries/duplicates, escapes text and keeps raw IDs out of DOM IDs', () => {
    const id = 'one " ] # <bad> \ud800'
    const controls = mountTabs({ modelValue: id, tabs: [
      null, { id: '', label: 'Empty' }, { id: 2, label: 'Wrong' }, { id: 'blank', label: ' ' },
      { id, label: '<img src=x onerror=alert(1)>', icon: '<svg>', badge: 0 },
      { id, label: 'Duplicate' }, { id: 'bad-badge', label: 'Safe', badge: Infinity, icon: 42 },
    ] })
    expect(controls).toHaveLength(2)
    expect(controls[0].text()).toContain('<img src=x onerror=alert(1)>')
    expect(controls[0].attributes('id')).not.toContain(id)
    expect(wrapper.find('img,svg').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Duplicate')
    expect(controls[1].text()).toBe('Safe')
  })

  it('does not mount inactive content or retain it after changing panels', async () => {
    const firstMounted = vi.fn(), firstUnmounted = vi.fn(), secondMounted = vi.fn()
    const First = { template: '<p>First</p>', mounted: firstMounted, unmounted: firstUnmounted }
    const Second = { template: '<p>Second</p>', mounted: secondMounted }
    const controls = mountTabs({}, { slots: { one: First, two: Second } })
    expect(firstMounted).toHaveBeenCalledTimes(1)
    expect(secondMounted).not.toHaveBeenCalled()
    await controls[1].trigger('keydown', { key: 'Home' })
    expect(secondMounted).not.toHaveBeenCalled()
    await controls[1].trigger('click')
    expect(firstUnmounted).toHaveBeenCalledTimes(1)
    expect(secondMounted).toHaveBeenCalledTimes(1)
  })

  it('respects inherited disabled fieldsets even for synthetic clicks and keys', async () => {
    const controls = mountTabs()
    host.disabled = true
    controls[1].element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    controls[0].element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(document.activeElement).not.toBe(controls[1].element)
  })
})
