/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, expect, it } from 'vitest'
import tooltip from '../directives/tooltip'

const elements = []
function target(value) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  tooltip.mounted(el, { value })
  elements.push(el)
  return el
}
const hover = el => el.dispatchEvent(new MouseEvent('mouseenter'))
const visible = () => document.querySelector('[role="tooltip"]')
afterEach(() => {
  for (const el of elements.splice(0)) { tooltip.unmounted(el); el.remove() }
})

describe('tooltip current binding and ownership', () => {
  it.each(['Healthy', 'Not Configured', 'Disabled', 'Unhealthy'])('uses updated %s on every subsequent hover', label => {
    const el = target('Status: Unknown')
    tooltip.updated(el, { value: `Status: ${label}`, oldValue: 'Status: Unknown' })
    for (let i = 0; i < 2; i++) {
      hover(el)
      expect(visible().textContent).toBe(`Status: ${label}`)
      el.dispatchEvent(new MouseEvent('mouseleave'))
      expect(visible()).toBeNull()
    }
  })
  it('updates shown text and removes it when cleared', () => {
    const el = target('Unknown')
    hover(el)
    tooltip.updated(el, { value: 'Healthy', oldValue: 'Unknown' })
    expect(visible().textContent).toBe('Healthy')
    tooltip.updated(el, { value: '', oldValue: 'Healthy' })
    expect(visible()).toBeNull()
    hover(el)
    expect(visible()).toBeNull()
  })
  it('ignores another target update, dismissal and unmount', () => {
    const first = target('First'), second = target('Second')
    hover(first)
    const shown = visible()
    tooltip.updated(second, { value: 'Updated second', oldValue: 'Second' })
    second.dispatchEvent(new MouseEvent('mouseleave'))
    second.click()
    tooltip.unmounted(second)
    expect(visible()).toBe(shown)
    tooltip.updated(first, { value: 'First', oldValue: 'First' })
    expect(visible()).toBe(shown)
    first.click()
    expect(visible()).toBeNull()
  })
  it('keeps one tooltip, renders literal text and removes listeners on unmount', () => {
    const first = target('First'), second = target('<img src=x onerror=alert(1)>')
    hover(first); hover(second)
    expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1)
    expect(visible().textContent).toBe('<img src=x onerror=alert(1)>')
    expect(visible().querySelector('img')).toBeNull()
    tooltip.unmounted(second)
    expect(visible()).toBeNull()
    hover(second)
    tooltip.updated(second, { value: 'Unregistered' })
    expect(visible()).toBeNull()
  })
})
